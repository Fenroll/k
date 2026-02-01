# Cloudflare R2 Upload Setup Guide

## 📋 Prerequisites
- Cloudflare account
- R2 storage enabled (free tier available)
- Your website domain

## 🚀 Step-by-Step Setup

### 1. Create R2 Bucket
1. Go to Cloudflare Dashboard > R2
2. Click "Create bucket"
3. Name it (e.g., `medical-files`)
4. Click "Create bucket"

### 2. Create Cloudflare Worker
1. Go to Workers & Pages
2. Click "Create Worker"
3. Name it (e.g., `r2-upload`)
4. Click "Deploy"

### 3. Configure Worker
1. Click "Edit code"
2. Copy content from `cloudflare-r2-worker.js`
3. Paste into the worker editor
4. Click "Save and deploy"

### 4. Bind R2 Bucket to Worker
1. Go to your worker's Settings
2. Click on "Variables" tab
3. Scroll to "R2 Bucket Bindings"
4. Click "Add binding"
   - Variable name: `R2_BUCKET`
   - R2 bucket: Select your bucket from dropdown
5. Click "Save"

### 5. Configure Public Access (Optional)
If you want files to be publicly accessible:
1. Go to your R2 bucket settings
2. Enable "Public access" or set up a custom domain
3. Update the worker code with your public URL

### 6. Update tests.html
1. Open `tests.html`
2. Find this line:
   ```javascript
   const R2_WORKER_URL = 'https://upload.YOUR-WORKER.workers.dev';
   ```
3. Replace with your actual worker URL:
   ```javascript
   const R2_WORKER_URL = 'https://r2-upload.YOUR-USERNAME.workers.dev';
   ```

### 7. Restrict Access (Production)
In your worker code, change:
```javascript
'Access-Control-Allow-Origin': '*'
```
To your specific domain:
```javascript
'Access-Control-Allow-Origin': 'https://yourdomain.com'
```

## 🔒 Security Recommendations

### Option A: Add Authentication
Add this to your worker to require authentication:

```javascript
// Check for valid auth token
const authToken = request.headers.get('Authorization');
if (authToken !== 'Bearer YOUR_SECRET_TOKEN') {
  return new Response('Unauthorized', { status: 401, headers: corsHeaders });
}
```

Then in tests.html, add the token:
```javascript
const response = await fetch(R2_WORKER_URL, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_SECRET_TOKEN'
  },
  body: formData
});
```

### Option B: Check Firebase Auth
Integrate with your existing Firebase auth:

```javascript
// In tests.html, get Firebase token
const user = JSON.parse(localStorage.getItem('loggedInUser'));
if (!user || !user.uid) {
  alert('You must be logged in to upload files');
  return;
}

// Send user ID in request
formData.append('userId', user.uid);

// In worker, verify user has permission
const userId = formData.get('userId');
// Add your permission logic here
```

## 📁 File Organization

Files are automatically organized by date:
```
uploads/
  2026-02-01/
    folder-name/
      file1.pdf
      file2.jpg
  2026-02-02/
    ...
```

## 💰 Pricing

**R2 Storage (Free Tier):**
- 10 GB storage
- 1 million Class A operations/month
- 10 million Class B operations/month

**Workers (Free Tier):**
- 100,000 requests/day

## 🧪 Testing

1. Open `tests.html`
2. Select files or drag a folder
3. Click "Качи всички файлове"
4. Check your R2 bucket for uploaded files

## 🔧 Troubleshooting

**Error: "R2_BUCKET is not defined"**
- Make sure you bound the R2 bucket in worker settings

**Error: "CORS policy"**
- Check the `Access-Control-Allow-Origin` header in worker

**Files not appearing**
- Check worker logs in Cloudflare dashboard
- Verify R2 bucket name is correct

**Upload fails silently**
- Open browser DevTools > Console for errors
- Check Network tab for failed requests

## 📝 Next Steps

1. Test with a small file first
2. Add file type restrictions if needed
3. Implement file size limits
4. Add virus scanning (Cloudflare Stream supports this)
5. Set up automatic backups

## 🆘 Need Help?

Check Cloudflare documentation:
- R2: https://developers.cloudflare.com/r2/
- Workers: https://developers.cloudflare.com/workers/
