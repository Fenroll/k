# Cloudflare Worker Liveblocks Auth (Free)

This is a free (no billing-card required) 24/7 auth endpoint for Liveblocks.

## 1) Install Wrangler and login

```bash
npm install -g wrangler
wrangler login
```

## 2) Deploy

```bash
cd collab/liveblocks-auth/cloudflare-worker
wrangler secret put LIVEBLOCKS_SECRET_KEY
wrangler deploy
```

Enter your Liveblocks `sk_...` key when prompted.

## 3) Worker URL

After deploy, you get a URL like:

`https://coursebook-liveblocks-auth.<your-subdomain>.workers.dev/liveblocks-auth`

Set this URL in one of these ways:

- `localStorage.setItem("liveblocksAuthEndpoint", "https://.../liveblocks-auth")`
- or `window.LIVEBLOCKS_AUTH_ENDPOINT = "https://.../liveblocks-auth"` before app init.

## 4) Optional custom domain route

In Cloudflare dashboard, map your worker route to:

`https://coursebook.lol/liveblocks-auth`

Then `notes.html` can use this stable endpoint directly.
