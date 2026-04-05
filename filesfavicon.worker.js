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

		const keyCandidates = [];
		function addKeyCandidate(value) {
			const normalized = String(value || '').replace(/^\/+/, '').trim();
			if (!normalized) return;
			if (!keyCandidates.includes(normalized)) keyCandidates.push(normalized);
		}

		addKeyCandidate(key);
		addKeyCandidate(rawPath);

		const queryKey = url.searchParams.get('key') || url.searchParams.get('path') || '';
		if (queryKey) {
			addKeyCandidate(queryKey);
			try {
				addKeyCandidate(decodeURIComponent(queryKey));
			} catch {
				// Ignore malformed query encoding.
			}
		}

		try {
			const decodedRawPath = decodeURIComponent(rawPath);
			addKeyCandidate(decodedRawPath);
			const reEncodedPath = decodedRawPath
				.split('/')
				.map((segment) => encodeURIComponent(segment))
				.join('/');
			addKeyCandidate(reEncodedPath);
		} catch {
			// Ignore malformed path encoding.
		}

		const isPdf = key.toLowerCase().endsWith('.pdf');
		const forceRaw = url.searchParams.get('raw') === '1';
		const forceDownload = url.searchParams.get('download') === '1';
		const userAgent = String(request.headers.get('user-agent') || '').toLowerCase();
		const isAndroid = /android/i.test(userAgent);
		const isIosDevice = /(iphone|ipad|ipod)/i.test(userAgent);
		const isIpadDesktopUa = /macintosh/i.test(userAgent) && /mobile\//i.test(userAgent);
		const isSafariToken = /safari\//i.test(userAgent);
		const isIosAltBrowser = /(crios|fxios|edgios|opios|duckduckgo)/i.test(userAgent);
		const isAppleMobile = isIosDevice || isIpadDesktopUa;
		const isAppleWebkitBrowser = isSafariToken || isIosAltBrowser;
		const shouldBypassIframePdfForApple = isAppleMobile && isAppleWebkitBrowser;
		const hasChromeToken = /chrome\/[0-9]+/i.test(userAgent);
		const isExcludedChromiumBrand = /(edg|opr|samsungbrowser|duckduckgo)\//i.test(userAgent);
		const isAndroidChrome = isAndroid && hasChromeToken && !isExcludedChromiumBrand;
		const isSafariBrowser = isSafariToken && !hasChromeToken && !isIosAltBrowser && !/firefox\//i.test(userAgent);
		const shouldUsePdfJs = isAndroidChrome || isSafariBrowser;
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
			const rawUrl = new URL(url.toString());
			rawUrl.searchParams.set('raw', '1');

			// iOS/iPadOS browsers can be unreliable for PDF rendering inside iframe wrappers.
			// Send it to the raw stream and, when embedded, try to break out of the frame.
			if (shouldBypassIframePdfForApple && !isSafariBrowser) {
				const targetUrl = rawUrl.toString();
				if (secFetchDest === 'iframe') {
					const fallbackHref = targetUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
					const openerHtml = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Opening PDF</title>
	<style>
		html, body { margin: 0; width: 100%; height: 100%; background: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; }
		.wrap { min-height: 100%; display: flex; align-items: center; justify-content: center; padding: 16px; text-align: center; }
		a { color: #0f172a; }
	</style>
</head>
<body>
	<div class="wrap">
		<div>
			<div>Opening PDF...</div>
			<div style="margin-top:10px"><a href="${fallbackHref}" target="_top" rel="noopener">Open manually</a></div>
		</div>
	</div>
	<script>
		(function () {
			const target = ${JSON.stringify(targetUrl)};
			try {
				if (window.top && window.top !== window.self) {
					window.top.location.replace(target);
					return;
				}
			} catch {
				// Fall back to same-frame navigation.
			}
			window.location.replace(target);
		})();
	</script>
</body>
</html>`;

					return new Response(openerHtml, {
						status: 200,
						headers: {
							'content-type': 'text/html; charset=utf-8',
							'cache-control': 'no-store'
						}
					});
				}

				return Response.redirect(targetUrl, 302);
			}

			// Use PDF.js for Android Chrome and Safari.
			if (shouldUsePdfJs) {
				const siteBaseUrl = String(env.SITE_BASE_URL || 'https://coursebook.lol/');
				const chatScriptUrl = String(env.CHAT_SCRIPT_URL || 'https://coursebook.lol/js/chat.js');
				const presenceScriptUrl = String(env.PRESENCE_SCRIPT_URL || 'https://coursebook.lol/js/presence.js');
				const userIdentityScriptUrl = String(env.USER_IDENTITY_SCRIPT_URL || 'https://coursebook.lol/js/user-identity.js');
				const sessionBridgeUrl = String(env.SESSION_BRIDGE_URL || 'https://coursebook.lol/session-bridge.html');
				const firebaseAppCompatUrl = String(env.FIREBASE_APP_COMPAT_URL || 'https://www.gstatic.com/firebasejs/10.5.0/firebase-app-compat.js');
				const firebaseDbCompatUrl = String(env.FIREBASE_DB_COMPAT_URL || 'https://www.gstatic.com/firebasejs/10.5.0/firebase-database-compat.js');
				const firebaseDatabaseUrl = String(env.FIREBASE_DATABASE_URL || 'https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app');
				const firebaseProjectId = String(env.FIREBASE_PROJECT_ID || 'med-student-chat');
				const firebaseApiKey = String(env.FIREBASE_API_KEY || 'API_KEY');
				const firebaseAppId = String(env.FIREBASE_APP_ID || 'APP_ID');
				const firebaseSenderId = String(env.FIREBASE_MESSAGING_SENDER_ID || 'SENDER_ID');
				const firebaseAuthDomain = String(env.FIREBASE_AUTH_DOMAIN || `${firebaseProjectId}.firebaseapp.com`);
				const firebaseStorageBucket = String(env.FIREBASE_STORAGE_BUCKET || `${firebaseProjectId}.appspot.com`);
				const baseName = key.split('/').pop() || 'PDF';
				const safeTitle = baseName.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
				const pdfJsHtml = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${safeTitle}</title>
	<base href="${siteBaseUrl}">
	<style>
		html, body { margin: 0; width: 100%; height: 100%; background: #0f172a; }
		#pdf-viewer { width: 100%; height: 100%; overflow: auto; }
		#pdf-viewer canvas { width: 100%; height: auto; display: block; margin: 0 auto 8px; background: #fff; }
		@media (max-width: 768px) {
			#chat-widget, .chat-widget {
				bottom: calc(max(0px, env(safe-area-inset-bottom)) + 4px) !important;
			}
		}
	</style>
</head>
<body>
	<div id="pdf-viewer"></div>

	<script src="${firebaseAppCompatUrl}"></script>
	<script src="${firebaseDbCompatUrl}"></script>
	<script>
		(function () {
			if (typeof firebase === 'undefined' || !firebase.initializeApp) return;
			const firebaseConfig = {
				apiKey: ${JSON.stringify(firebaseApiKey)},
				authDomain: ${JSON.stringify(firebaseAuthDomain)},
				databaseURL: ${JSON.stringify(firebaseDatabaseUrl)},
				projectId: ${JSON.stringify(firebaseProjectId)},
				storageBucket: ${JSON.stringify(firebaseStorageBucket)},
				messagingSenderId: ${JSON.stringify(firebaseSenderId)},
				appId: ${JSON.stringify(firebaseAppId)}
			};
			if (!firebase.apps || !firebase.apps.length) {
				firebase.initializeApp(firebaseConfig);
			}
		})();
	</script>

	<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
	<script>
		const pdfUrl = ${JSON.stringify(rawUrl.toString())};
		pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

		async function renderPDF() {
			const loadingTask = pdfjsLib.getDocument(pdfUrl);
			const pdf = await loadingTask.promise;
			const container = document.getElementById('pdf-viewer');
			container.innerHTML = '';

			for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
				const page = await pdf.getPage(pageNum);
				const viewport = page.getViewport({ scale: 1.5 });
				const canvas = document.createElement('canvas');
				const context = canvas.getContext('2d');
				canvas.height = viewport.height;
				canvas.width = viewport.width;
				canvas.style.width = '100%';
				canvas.style.display = 'block';
				container.appendChild(canvas);
				await page.render({ canvasContext: context, viewport }).promise;
			}
		}

		renderPDF().catch((err) => console.error('Error rendering PDF:', err));
	</script>

	<script>
		(async function () {
			const bridgeUrl = ${JSON.stringify(sessionBridgeUrl)};
			const userIdentityUrl = ${JSON.stringify(userIdentityScriptUrl)};
			const presenceUrl = ${JSON.stringify(presenceScriptUrl)};
			const chatUrl = ${JSON.stringify(chatScriptUrl)};

			function loadScript(src, defer) {
				return new Promise((resolve, reject) => {
					const script = document.createElement('script');
					script.src = src;
					if (defer) script.defer = true;
					script.onload = () => resolve();
					script.onerror = () => reject(new Error('Failed to load: ' + src));
					document.body.appendChild(script);
				});
			}

			async function syncSessionFromMainDomain() {
				let bridgeOrigin;
				try {
					bridgeOrigin = new URL(bridgeUrl).origin;
				} catch {
					return;
				}

				await new Promise((resolve) => {
					let finished = false;
					let timer = null;
					const bridgeFrame = document.createElement('iframe');

					function done() {
						if (finished) return;
						finished = true;
						window.removeEventListener('message', onMessage);
						if (timer) clearTimeout(timer);
						if (bridgeFrame && bridgeFrame.parentNode) {
							bridgeFrame.parentNode.removeChild(bridgeFrame);
						}
						resolve();
					}

					function onMessage(event) {
						if (event.origin !== bridgeOrigin) return;
						const data = event.data || {};
						if (data.type !== 'COURSEBOOK_SESSION') return;

						if (typeof data.loggedInUser === 'string' && data.loggedInUser.trim()) {
							localStorage.setItem('loggedInUser', data.loggedInUser);
						}

						if (data.chatState && typeof data.chatState === 'object') {
							for (const [storageKey, storageValue] of Object.entries(data.chatState)) {
								if (typeof storageValue === 'string' && storageKey) {
									localStorage.setItem(storageKey, storageValue);
								}
							}
						}
						done();
					}

					window.addEventListener('message', onMessage);
					timer = setTimeout(done, 2000);

					bridgeFrame.style.display = 'none';
					bridgeFrame.src = bridgeUrl;
					bridgeFrame.onload = function () {
						try {
							bridgeFrame.contentWindow.postMessage({ type: 'COURSEBOOK_GET_SESSION' }, bridgeOrigin);
						} catch {
							done();
						}
					};

					document.body.appendChild(bridgeFrame);
				});
			}

			try {
				await syncSessionFromMainDomain();
			} catch {
				// Continue even if cross-domain session sync fails.
			}

			try {
				await loadScript(userIdentityUrl, false);
				await loadScript(presenceUrl, false);
				await loadScript(chatUrl, true);
			} catch (err) {
				console.error('PDF chat bootstrap error:', err);
			}
		})();
	</script>
</body>
</html>`;

				return new Response(pdfJsHtml, {
					status: 200,
					headers: {
						'content-type': 'text/html; charset=utf-8',
						'cache-control': 'public, max-age=300'
					}
				});
			}

			const faviconUrl = String(env.SITE_FAVICON_URL || 'https://coursebook.lol/favicon.ico');
			const siteTitle = String(env.SITE_TITLE || 'Coursebook');
			const siteBaseUrl = String(env.SITE_BASE_URL || 'https://coursebook.lol/');
			const chatScriptUrl = String(env.CHAT_SCRIPT_URL || 'https://coursebook.lol/js/chat.js');
			const presenceScriptUrl = String(env.PRESENCE_SCRIPT_URL || 'https://coursebook.lol/js/presence.js');
			const userIdentityScriptUrl = String(env.USER_IDENTITY_SCRIPT_URL || 'https://coursebook.lol/js/user-identity.js');
			const sessionBridgeUrl = String(env.SESSION_BRIDGE_URL || 'https://coursebook.lol/session-bridge.html');
			const firebaseAppCompatUrl = String(env.FIREBASE_APP_COMPAT_URL || 'https://www.gstatic.com/firebasejs/10.5.0/firebase-app-compat.js');
			const firebaseDbCompatUrl = String(env.FIREBASE_DB_COMPAT_URL || 'https://www.gstatic.com/firebasejs/10.5.0/firebase-database-compat.js');
			const firebaseDatabaseUrl = String(env.FIREBASE_DATABASE_URL || 'https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app');
			const firebaseProjectId = String(env.FIREBASE_PROJECT_ID || 'med-student-chat');
			const firebaseApiKey = String(env.FIREBASE_API_KEY || 'API_KEY');
			const firebaseAppId = String(env.FIREBASE_APP_ID || 'APP_ID');
			const firebaseSenderId = String(env.FIREBASE_MESSAGING_SENDER_ID || 'SENDER_ID');
			const firebaseAuthDomain = String(env.FIREBASE_AUTH_DOMAIN || `${firebaseProjectId}.firebaseapp.com`);
			const firebaseStorageBucket = String(env.FIREBASE_STORAGE_BUCKET || `${firebaseProjectId}.appspot.com`);
			const baseName = key.split('/').pop() || 'PDF';
			const safeTitle = baseName.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
			const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} - ${siteTitle}</title>
	<base href="${siteBaseUrl}">
  <link rel="icon" href="${faviconUrl}">
	<style>
		html,body{height:100%;margin:0;overflow:hidden;background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
		iframe{display:block;width:100%;height:100%;border:0;background:#fff}
		@media (max-width: 768px) {
			#chat-widget, .chat-widget {
				bottom: calc(max(0px, env(safe-area-inset-bottom)) + 2px) !important;
			}
		}
	</style>
</head>
<body>
  <iframe src="${rawUrl.toString()}" allow="fullscreen"></iframe>
	<script src="${firebaseAppCompatUrl}"></script>
	<script src="${firebaseDbCompatUrl}"></script>
	<script>
		(function () {
			if (typeof firebase === 'undefined' || !firebase.initializeApp) return;
			const firebaseConfig = {
				apiKey: ${JSON.stringify(firebaseApiKey)},
				authDomain: ${JSON.stringify(firebaseAuthDomain)},
				databaseURL: ${JSON.stringify(firebaseDatabaseUrl)},
				projectId: ${JSON.stringify(firebaseProjectId)},
				storageBucket: ${JSON.stringify(firebaseStorageBucket)},
				messagingSenderId: ${JSON.stringify(firebaseSenderId)},
				appId: ${JSON.stringify(firebaseAppId)}
			};
			if (!firebase.apps || !firebase.apps.length) {
				firebase.initializeApp(firebaseConfig);
			}
		})();
	</script>
	<script>
		(async function () {
			const bridgeUrl = ${JSON.stringify(sessionBridgeUrl)};
			const userIdentityUrl = ${JSON.stringify(userIdentityScriptUrl)};
				const presenceUrl = ${JSON.stringify(presenceScriptUrl)};
			const chatUrl = ${JSON.stringify(chatScriptUrl)};

			function loadScript(src, defer) {
				return new Promise((resolve, reject) => {
					const script = document.createElement('script');
					script.src = src;
					if (defer) script.defer = true;
					script.onload = () => resolve();
					script.onerror = () => reject(new Error('Failed to load: ' + src));
					document.body.appendChild(script);
				});
			}

			async function syncSessionFromMainDomain() {
				let bridgeOrigin;
				try {
					bridgeOrigin = new URL(bridgeUrl).origin;
				} catch {
					return;
				}

				await new Promise((resolve) => {
					let finished = false;
					let timer = null;
					const bridgeFrame = document.createElement('iframe');

					function done() {
						if (finished) return;
						finished = true;
						window.removeEventListener('message', onMessage);
						if (timer) clearTimeout(timer);
						if (bridgeFrame && bridgeFrame.parentNode) {
							bridgeFrame.parentNode.removeChild(bridgeFrame);
						}
						resolve();
					}

					function onMessage(event) {
						if (event.origin !== bridgeOrigin) return;
						const data = event.data || {};
						if (data.type !== 'COURSEBOOK_SESSION') return;

						if (typeof data.loggedInUser === 'string' && data.loggedInUser.trim()) {
							localStorage.setItem('loggedInUser', data.loggedInUser);
						}

						if (data.chatState && typeof data.chatState === 'object') {
							for (const [storageKey, storageValue] of Object.entries(data.chatState)) {
								if (typeof storageValue === 'string' && storageKey) {
									localStorage.setItem(storageKey, storageValue);
								}
							}
						}
						done();
					}

					window.addEventListener('message', onMessage);
					timer = setTimeout(done, 2000);

					bridgeFrame.style.display = 'none';
					bridgeFrame.src = bridgeUrl;
					bridgeFrame.onload = function () {
						try {
							bridgeFrame.contentWindow.postMessage({ type: 'COURSEBOOK_GET_SESSION' }, bridgeOrigin);
						} catch {
							done();
						}
					};

					document.body.appendChild(bridgeFrame);
				});
			}

			try {
				await syncSessionFromMainDomain();
			} catch {
				// Continue even if cross-domain session sync fails.
			}

			try {
				await loadScript(userIdentityUrl, false);
					await loadScript(presenceUrl, false);
				await loadScript(chatUrl, true);
			} catch (err) {
				console.error('PDF chat bootstrap error:', err);
			}
		})();
	</script>
</body>
</html>`;

			return new Response(html, {
				status: 200,
				headers: {
					'content-type': 'text/html; charset=utf-8',
					'cache-control': 'public, max-age=300'
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

		let object = null;
		let resolvedKey = key;
		for (const candidate of keyCandidates) {
			object = Object.keys(getOptions).length > 0
				? await bucket.get(candidate, getOptions)
				: await bucket.get(candidate);
			if (object) {
				resolvedKey = candidate;
				break;
			}
		}

		if (!object) {
			return new Response('Not Found', { status: 404 });
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('etag', object.httpEtag);
		headers.set('accept-ranges', 'bytes');
		headers.set('cache-control', headers.get('cache-control') || 'public, max-age=3600');

		if (Number.isFinite(object.size) && object.size >= 0) {
			headers.set('content-length', String(object.size));
		}

		// Force deterministic inline PDF headers to avoid mobile browsers downloading instead of opening.
		if (isPdf && !forceDownload) {
			const baseNameRaw = resolvedKey.split('/').pop() || 'document.pdf';
			let baseName = baseNameRaw;
			try { baseName = decodeURIComponent(baseNameRaw); } catch {}
			const safeAscii = baseName
				.replace(/[\r\n]/g, ' ')
				.replace(/[\\/]/g, '_')
				.replace(/"/g, "'")
				.replace(/[^\x20-\x7E]/g, '_');

			headers.set('content-type', 'application/pdf');
			headers.set(
				'content-disposition',
				`inline; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(baseName)}`
			);
			headers.set('x-content-type-options', 'nosniff');
			headers.delete('content-encoding');
		}

		if (object.range && Number.isFinite(object.range.offset) && Number.isFinite(object.range.length) && Number.isFinite(object.size)) {
			const start = object.range.offset;
			const end = object.range.offset + object.range.length - 1;
			headers.set('content-range', `bytes ${start}-${end}/${object.size}`);
			headers.set('content-length', String(object.range.length));
		}

		if (forceDownload) {
			const baseNameRaw = resolvedKey.split('/').pop() || 'download';
			let baseName = baseNameRaw;
			try { baseName = decodeURIComponent(baseNameRaw); } catch {}
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
