export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://files.coursebook.lol',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname !== '/session-bridge.html') {
      return new Response('Not Found', { status: 404 });
    }

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Session Bridge</title>
</head>
<body>
  <script>
    (function () {
      const allowedOrigins = new Set([
        'https://files.coursebook.lol',
        'https://chat.coursebook.lol',
        'https://coursebook.lol',
        'https://files.blackboard.lol',
        'https://blackboard.lol'
      ]);

      window.addEventListener('message', function (event) {
        if (!allowedOrigins.has(event.origin)) return;
        const data = event.data || {};
        if (data.type !== 'COURSEBOOK_GET_SESSION') return;

        const loggedInUser = localStorage.getItem('loggedInUser');
        event.source.postMessage(
          {
            type: 'COURSEBOOK_SESSION',
            loggedInUser: loggedInUser || null
          },
          event.origin
        );
      });
    })();
  </script>
</body>
</html>`;

    return new Response(request.method === 'HEAD' ? null : html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }
};
