# Cloudflare PDF Favicon Worker (Separate Worker)

File: `cloudflare-pdf-favicon-worker.js`

## What This Does

- Keeps direct file URLs unchanged (same paths and links).
- For browser page loads of `*.pdf`, returns an HTML wrapper with your favicon and embedded PDF.
- For raw/download/API/range requests, returns the original file bytes from R2.

## Required Cloudflare Setup

1. Create a **new** Worker (do not modify your existing upload worker).
2. Paste `cloudflare-pdf-favicon-worker.js` into this new Worker.
3. Add R2 binding:
- Variable name: `FILES_BUCKET`
- Bucket: your files bucket (the one behind `files.coursebook.lol`)
4. Optional env vars:
- `SITE_FAVICON_URL=https://coursebook.lol/favicon.ico`
- `SITE_TITLE=Coursebook`

## Route / Domain

Use this Worker on the host that serves your files, for example:
- Custom domain: `files.coursebook.lol`
  or
- Route: `files.coursebook.lol/*`

## Behavior Notes

- Existing links like `https://files.coursebook.lol/path/file.pdf` can stay as-is.
- PDF page navigation shows favicon because response is HTML shell.
- Direct/raw access is preserved with `?raw=1` and for non-HTML accepts.

## Quick Test

1. Open a PDF URL in a browser tab:
- `https://files.coursebook.lol/some/path/file.pdf`
2. Confirm:
- tab icon uses your favicon
- PDF still renders
3. Test raw endpoint:
- `https://files.coursebook.lol/some/path/file.pdf?raw=1`
- should return direct PDF bytes
