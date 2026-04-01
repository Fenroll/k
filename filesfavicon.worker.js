export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const accept = String(request.headers.get('accept') || '').toLowerCase();
		const secFetchDest = String(request.headers.get('sec-fetch-dest') || '').toLowerCase();

		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
					'Access-Control-Allow-Headers': 'Range, Content-Type'
				}
			});
		}

		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		const bucket = env.FILES_BUCKET;
		if (!bucket) {
			return new Response('FILES_BUCKET binding is missing', { status: 500 });
		}

		const rawPath = url.pathname.replace(/^\/+/, '');
		let key;
		try {
			key = decodeURIComponent(rawPath);
		} catch {
			key = rawPath;
		}

		if (!key) {
			return new Response('Not Found', { status: 404 });
		}

		const isPdf = key.toLowerCase().endsWith('.pdf');
		const forceRaw = url.searchParams.get('raw') === '1';
		const forceDownload = url.searchParams.get('download') === '1';
		const rangeHeader = request.headers.get('range');
		const isBrowserDocumentRequest =
			request.method === 'GET' &&
			!rangeHeader &&
			!forceRaw &&
			!forceDownload &&
			isPdf &&
			((accept.includes('text/html') && !accept.includes('application/json')) ||
				secFetchDest === 'document' ||
				secFetchDest === 'iframe');

		if (isBrowserDocumentRequest) {
			const faviconUrl = String(env.SITE_FAVICON_URL || 'https://coursebook.lol/favicon.ico');
			const siteTitle = String(env.SITE_TITLE || 'Coursebook');
			const baseName = key.split('/').pop() || 'PDF';
			const safeTitle = baseName.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
			const rawUrl = new URL(url.toString());
			rawUrl.searchParams.set('raw', '1');

			const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} - ${siteTitle}</title>
  <link rel="icon" href="${faviconUrl}">
	<style>
		html,body{height:100%;margin:0;overflow:hidden;background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
		iframe{display:block;width:100%;height:100%;border:0;background:#fff}
	</style>
</head>
<body>
  <iframe src="${rawUrl.toString()}" allow="fullscreen"></iframe>
</body>
</html>`;

			return new Response(html, {
				status: 200,
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'cache-control': 'public, max-age=300',
					'x-worker-version': '2026-04-01.2'
				}
			});
		}

		const getOptions = {};
		if (rangeHeader) {
			const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
			if (match) {
				const startRaw = match[1];
				const endRaw = match[2];

				if (startRaw && endRaw) {
					const start = Number(startRaw);
					const end = Number(endRaw);
					if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
						getOptions.range = { offset: start, length: (end - start) + 1 };
					}
				} else if (startRaw && !endRaw) {
					const start = Number(startRaw);
					if (Number.isFinite(start)) {
						getOptions.range = { offset: start };
					}
				} else if (!startRaw && endRaw) {
					const suffix = Number(endRaw);
					if (Number.isFinite(suffix)) {
						getOptions.range = { suffix };
					}
				}
			}
		}

		const object = Object.keys(getOptions).length > 0
			? await bucket.get(key, getOptions)
			: await bucket.get(key);

		if (!object) {
			return new Response('Not Found', { status: 404 });
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('etag', object.httpEtag);
		headers.set('accept-ranges', 'bytes');
		headers.set('cache-control', headers.get('cache-control') || 'public, max-age=3600');

		// Safari can fail on some inline PDFs when Content-Disposition has a broken fallback filename.
		// For normal PDF viewing, omit Content-Disposition entirely.
		if (isPdf && !forceDownload) {
			headers.delete('content-disposition');
		}

		if (forceDownload) {
			const baseName = key.split('/').pop() || 'download';
			const safeAscii = baseName
				.replace(/[\r\n]/g, ' ')
				.replace(/[\\/]/g, '_')
				.replace(/"/g, "'")
				.replace(/[^\x20-\x7E]/g, '_');
			headers.set(
				'content-disposition',
				`attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(baseName)}`
			);
		}

		if (request.method === 'HEAD') {
			return new Response(null, { status: object.range ? 206 : 200, headers });
		}

		return new Response(object.body, { status: object.range ? 206 : 200, headers });
	}
};
