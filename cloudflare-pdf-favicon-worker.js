/**
 * Cloudflare Worker: PDF favicon wrapper for files.coursebook.lol
 *
 * Purpose:
 * - Keep existing direct links unchanged.
 * - For browser page navigations to .pdf, return an HTML shell with your favicon
 *   and an embedded PDF viewer.
 * - For non-HTML requests (API clients, downloads, range requests), return the
 *   raw file bytes from R2.
 *
 * Required binding:
 * - FILES_BUCKET (R2 bucket that contains your files)
 *
 * Optional env vars:
 * - SITE_FAVICON_URL (default: https://coursebook.lol/favicon.ico)
 * - SITE_TITLE (default: Coursebook)
 */

const DEFAULT_FAVICON_URL = 'https://coursebook.lol/favicon.ico';
const DEFAULT_SITE_TITLE = 'Coursebook';

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHtmlNavigationRequest(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  // Browsers requesting a page typically send text/html in Accept.
  return accept.includes('text/html');
}

function isLikelyMobileBrowser(request) {
  const userAgent = (request.headers.get('user-agent') || '').toLowerCase();
  return /android|iphone|ipad|ipod|mobile/.test(userAgent);
}

function shouldWrapPdf(request, url) {
  if (request.method !== 'GET') return false;
  if (!url.pathname.toLowerCase().endsWith('.pdf')) return false;
  if (url.searchParams.get('raw') === '1') return false;
  // iOS/Android PDF viewers can fail for iframe-wrapped PDFs (especially with non-ASCII names).
  // Serving raw PDF directly on mobile is more reliable.
  if (isLikelyMobileBrowser(request)) return false;
  return isHtmlNavigationRequest(request);
}

function buildRawPdfUrl(url) {
  const rawUrl = new URL(url.toString());
  rawUrl.searchParams.set('raw', '1');
  return rawUrl.toString();
}

function buildPdfShellHtml({ title, faviconUrl, rawPdfUrl }) {
  const safeTitle = htmlEscape(title);
  const safeFavicon = htmlEscape(faviconUrl);
  const safePdfUrl = htmlEscape(rawPdfUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <link rel="icon" href="${safeFavicon}">
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7fb;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; background: var(--bg); }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      background: #fff;
    }
  </style>
</head>
<body>
  <iframe src="${safePdfUrl}" title="${safeTitle}"></iframe>
</body>
</html>`;
}

function parseRangeHeader(rangeHeader, size) {
  // Minimal byte-range parser: supports "bytes=start-end", "bytes=start-", "bytes=-suffix".
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) return null;

  const value = rangeHeader.slice('bytes='.length).trim();
  if (!value || value.includes(',')) return null;

  const [rawStart, rawEnd] = value.split('-');

  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { suffix: Math.floor(suffix) };
  }

  const start = Number(rawStart);
  if (!Number.isFinite(start) || start < 0) return null;

  if (!rawEnd) {
    return { offset: Math.floor(start) };
  }

  const end = Number(rawEnd);
  if (!Number.isFinite(end) || end < start) return null;

  return { offset: Math.floor(start), length: Math.floor(end - start + 1) };
}

function copyHttpMetadata(headers, object) {
  if (!object?.httpMetadata) return;
  object.writeHttpMetadata(headers);
}

function buildObjectHeaders(object, etag) {
  const headers = new Headers();
  copyHttpMetadata(headers, object);

  headers.set('Accept-Ranges', 'bytes');
  headers.set('ETag', etag);

  if (object.uploaded) {
    headers.set('Last-Modified', new Date(object.uploaded).toUTCString());
  }

  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=3600');
  }

  return headers;
}

function resolveObjectKeyFromPath(pathname) {
  const cleanPath = pathname.replace(/^\/+/, '');
  if (!cleanPath) return '';

  // URLs are percent-encoded, but R2 keys are stored as raw text.
  // Decode each segment to preserve path separators.
  return cleanPath
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/');
}

async function serveRawObject(request, env, url) {
  const key = resolveObjectKeyFromPath(url.pathname);
  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  const bucket = env.FILES_BUCKET;
  if (!bucket) {
    return new Response('FILES_BUCKET binding missing', { status: 500 });
  }

  const head = await bucket.head(key);
  if (!head) {
    return new Response('Not found', { status: 404 });
  }

  const rangeHeader = request.headers.get('range');
  const range = parseRangeHeader(rangeHeader, head.size);

  let object;
  if (range) {
    object = await bucket.get(key, { range });
  } else {
    object = await bucket.get(key);
  }

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const etag = object.httpEtag || head.httpEtag || object.etag || head.etag || '"unknown"';
  const headers = buildObjectHeaders(object, etag);

  if (request.method === 'HEAD') {
    const contentLength = object.range?.length ?? object.size;
    if (typeof contentLength === 'number') {
      headers.set('Content-Length', String(contentLength));
    }
    return new Response(null, { status: object.range ? 206 : 200, headers });
  }

  if (object.range && typeof object.range.offset === 'number' && typeof object.range.length === 'number') {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${head.size}`);
    headers.set('Content-Length', String(object.range.length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' }
      });
    }

    const url = new URL(request.url);

    if (shouldWrapPdf(request, url)) {
      const fileName = decodeURIComponent(url.pathname.split('/').pop() || 'PDF');
      const siteTitle = env.SITE_TITLE || DEFAULT_SITE_TITLE;
      const title = `${siteTitle} - ${fileName}`;
      const faviconUrl = env.SITE_FAVICON_URL || DEFAULT_FAVICON_URL;
      const rawPdfUrl = buildRawPdfUrl(url);
      const html = buildPdfShellHtml({ title, faviconUrl, rawPdfUrl });

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }

    return serveRawObject(request, env, url);
  }
};
