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
const WORKER_VERSION = '2026-03-12.3';

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
  headers.set('X-Worker-Version', WORKER_VERSION);

  if (object.uploaded) {
    headers.set('Last-Modified', new Date(object.uploaded).toUTCString());
  }

  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=3600');
  }

  return headers;
}

function toAsciiFilename(value) {
  return String(value)
    .replace(/[^\x20-\x7E]+/g, '_')
    .replace(/"/g, '')
    .trim() || 'file';
}

function setPdfContentDisposition(headers, key) {
  const fileName = key.split('/').pop() || 'file.pdf';
  const asciiFallback = toAsciiFilename(fileName);
  const utf8Encoded = encodeURIComponent(fileName);
  headers.set(
    'Content-Disposition',
    `inline; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`
  );
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

function decodeSegmentOnce(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function decodeSegmentTwice(segment) {
  const once = decodeSegmentOnce(segment);
  // Some clients may send double-encoded paths; a second decode can recover the real key.
  return once.includes('%') ? decodeSegmentOnce(once) : once;
}

function buildKeyCandidatesFromPath(pathname) {
  const cleanPath = pathname.replace(/^\/+/, '');
  if (!cleanPath) return [];

  const rawSegments = cleanPath.split('/');
  const decodedOnce = rawSegments.map(decodeSegmentOnce).join('/');
  const decodedTwice = rawSegments.map(decodeSegmentTwice).join('/');

  const candidates = [
    resolveObjectKeyFromPath(pathname),
    decodedOnce,
    decodedTwice,
    decodedOnce.normalize('NFC'),
    decodedOnce.normalize('NFD'),
    decodedTwice.normalize('NFC'),
    decodedTwice.normalize('NFD'),
    cleanPath
  ];

  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    unique.push(candidate);
  }

  return unique;
}

async function serveRawObject(request, env, url) {
  const keyCandidates = buildKeyCandidatesFromPath(url.pathname);
  if (!keyCandidates.length) {
    return new Response('Not found', { status: 404 });
  }

  const bucket = env.FILES_BUCKET;
  if (!bucket) {
    return new Response('FILES_BUCKET binding missing', { status: 500 });
  }

  let key = '';
  let head = null;
  for (const candidate of keyCandidates) {
    const testHead = await bucket.head(candidate);
    if (testHead) {
      key = candidate;
      head = testHead;
      break;
    }
  }

  if (!head || !key) {
    return new Response('Not found', { status: 404 });
  }

  const etag = head.httpEtag || head.etag || '"unknown"';
  const headHeaders = buildObjectHeaders(head, etag);
  if (key.toLowerCase().endsWith('.pdf')) {
    setPdfContentDisposition(headHeaders, key);
  }

  // Keep HEAD simple and deterministic: mobile download managers often probe
  // with HEAD before GET, and expect a normal 200 + full Content-Length.
  if (request.method === 'HEAD') {
    headHeaders.set('Content-Length', String(head.size));
    return new Response(null, { status: 200, headers: headHeaders });
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

  const requestedRange = Boolean(range);
  const responseEtag = object.httpEtag || head.httpEtag || object.etag || head.etag || '"unknown"';
  const headers = buildObjectHeaders(object, responseEtag);
  if (key.toLowerCase().endsWith('.pdf')) {
    setPdfContentDisposition(headers, key);
  }

  if (requestedRange && object.range && typeof object.range.offset === 'number' && typeof object.range.length === 'number') {
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
