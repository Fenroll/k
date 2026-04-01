export default {
	async fetch(request, env) {
		const url = new URL(request.url);

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
		const forceDownload = url.searchParams.get('download') === '1';
		const rangeHeader = request.headers.get('range');

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

		headers.set('x-worker-version', '2026-04-01.1');

		if (request.method === 'HEAD') {
			return new Response(null, { status: object.range ? 206 : 200, headers });
		}

		return new Response(object.body, { status: object.range ? 206 : 200, headers });
	}
};
