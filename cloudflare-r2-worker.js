/**
 * Cloudflare Worker for uploading files to R2 storage
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to Cloudflare Dashboard > Workers & Pages
 * 2. Create a new Worker
 * 3. Copy this code into the worker
 * 4. Bind your R2 bucket:
 *    - Go to Settings > Variables > R2 Bucket Bindings
 *    - Variable name: R2BUCKET (no hyphens or underscores!)
 *    - R2 bucket: Select your bucket
 * 5. Deploy the worker
 * 6. Update R2_WORKER_URL in tests.html with your worker URL
 */

const DEFAULT_MAX_BUCKET_SIZE = 10 * 1024 * 1024 * 1024;
const DEFAULT_UPLOAD_LIMITS_URL = 'https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app/settings/uploadLimits.json';
const UPLOAD_LIMITS_CACHE_TTL_MS = 60 * 1000;

let cachedUploadLimits = {
  fetchedAt: 0,
  data: null
};

function parsePositiveBytes(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function buildPublicObjectUrl(publicDomain, key) {
  const safePath = String(key || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${publicDomain}/${safePath}`;
}

function sanitizeDownloadFileName(name, fallback = 'download') {
  const value = String(name || '').trim() || fallback;
  return value
    .replace(/[\r\n]/g, ' ')
    .replace(/[\\/]/g, '_')
    .replace(/"/g, "'");
}

function inferContentType(fileName, fallback = 'application/octet-stream') {
  const name = String(fileName || '').toLowerCase();
  const extension = (name.split('.').pop() || '').trim();
  const byExt = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    mp4: 'video/mp4',
    webm: 'video/webm',
    txt: 'text/plain; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    json: 'application/json; charset=utf-8'
  };

  return byExt[extension] || fallback;
}

function resolveBucketFromType(env, bucketType = 'default') {
  if (bucketType === 'chat') {
    return env.CHATBUCKET;
  }
  return env.R2BUCKET || env.R2_BUCKET || env['r2-upload'];
}

function normalizeObjectKey(key) {
  return String(key || '').replace(/^\/+/, '').trim();
}

async function resolveUniqueObjectKey(bucket, desiredKey) {
  const current = await bucket.head(desiredKey);
  if (!current) {
    return { key: desiredKey, wasDuplicate: false };
  }

  const lastSlash = desiredKey.lastIndexOf('/');
  const dir = lastSlash >= 0 ? desiredKey.slice(0, lastSlash + 1) : '';
  const fileName = lastSlash >= 0 ? desiredKey.slice(lastSlash + 1) : desiredKey;
  const dot = fileName.lastIndexOf('.');
  const hasExtension = dot > 0;
  const baseName = hasExtension ? fileName.slice(0, dot) : fileName;
  const extension = hasExtension ? fileName.slice(dot) : '';

  for (let i = 2; i <= 200; i += 1) {
    const candidate = `${dir}${baseName} (${i})${extension}`;
    const exists = await bucket.head(candidate);
    if (!exists) {
      return { key: candidate, wasDuplicate: true };
    }
  }

  const fallback = `${dir}${baseName}-${Date.now()}${extension}`;
  return { key: fallback, wasDuplicate: true };
}

async function getUploadLimitsConfig(env) {
  const now = Date.now();
  if (cachedUploadLimits.data && (now - cachedUploadLimits.fetchedAt) < UPLOAD_LIMITS_CACHE_TTL_MS) {
    return cachedUploadLimits.data;
  }

  const configUrl = env.UPLOAD_LIMITS_URL || DEFAULT_UPLOAD_LIMITS_URL;
  const response = await fetch(configUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch upload limits (${response.status})`);
  }

  const data = await response.json();
  cachedUploadLimits = {
    fetchedAt: now,
    data: data || {}
  };

  return cachedUploadLimits.data;
}

async function resolveMaxBucketSize(env, bucketType) {
  const envDefaultLimit = parsePositiveBytes(env.UPLOAD_MAX_TOTAL_BYTES);
  const envChatLimit = parsePositiveBytes(env.CHAT_UPLOAD_MAX_TOTAL_BYTES);
  if (bucketType === 'chat' && envChatLimit) {
    return envChatLimit;
  }
  if (bucketType !== 'chat' && envDefaultLimit) {
    return envDefaultLimit;
  }

  try {
    const settings = await getUploadLimitsConfig(env);
    const firebaseDefaultLimit = parsePositiveBytes(settings.defaultMaxTotalBytes);
    const firebaseChatLimit = parsePositiveBytes(settings.chatMaxTotalBytes);

    if (bucketType === 'chat' && firebaseChatLimit) {
      return firebaseChatLimit;
    }
    if (bucketType !== 'chat' && firebaseDefaultLimit) {
      return firebaseDefaultLimit;
    }
  } catch (configError) {
    console.error('Error loading upload limits config:', configError);
  }

  return DEFAULT_MAX_BUCKET_SIZE;
}

export default {
  async fetch(request, env) {
    // CORS headers for your domain
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // Change to your domain in production
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle read-only list request
    if (request.method === 'GET') {
      try {
        const url = new URL(request.url);
        const action = url.searchParams.get('action') || '';

        const bucketType = url.searchParams.get('bucketType') || 'default';

        let bucket;
        if (bucketType === 'chat') {
          bucket = env.CHATBUCKET;
        } else {
          bucket = env.R2BUCKET || env.R2_BUCKET || env['r2-upload'];
        }

        if (!bucket) {
          return new Response(JSON.stringify({ error: 'Bucket not bound' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (action === 'download') {
          const key = (url.searchParams.get('key') || '').replace(/^\/+/, '');
          if (!key) {
            return new Response(JSON.stringify({ error: 'No key provided' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const object = await bucket.get(key);
          if (!object) {
            return new Response(JSON.stringify({ error: 'Object not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const requestedName = url.searchParams.get('filename') || key.split('/').pop() || 'download';
          const fileName = sanitizeDownloadFileName(requestedName, 'download');
          const headers = new Headers(corsHeaders);

          if (object.httpMetadata && typeof object.httpMetadata.contentType === 'string' && object.httpMetadata.contentType) {
            headers.set('Content-Type', object.httpMetadata.contentType);
          } else {
            headers.set('Content-Type', 'application/octet-stream');
          }

          if (Number.isFinite(object.size) && object.size >= 0) {
            headers.set('Content-Length', String(object.size));
          }

          headers.set('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
          headers.set('Cache-Control', 'private, no-store');

          return new Response(object.body, {
            status: 200,
            headers
          });
        }

        if (action !== 'list') {
          return new Response(JSON.stringify({ error: 'Unsupported GET action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const prefix = url.searchParams.get('prefix') || '';
        const cursor = url.searchParams.get('cursor') || undefined;
        const limitRaw = Number(url.searchParams.get('limit'));
        const limit = Number.isFinite(limitRaw) && limitRaw > 0
          ? Math.min(Math.floor(limitRaw), 1000)
          : 1000;

        const listed = await bucket.list({ prefix, cursor, limit });
        const publicDomain = bucketType === 'chat'
          ? 'https://chat.coursebook.lol'
          : 'https://files.coursebook.lol';
        const objects = (listed.objects || []).map((object) => ({
          key: object.key,
          size: object.size,
          uploaded: object.uploaded,
          etag: object.etag,
          httpEtag: object.httpEtag,
          url: buildPublicObjectUrl(publicDomain, object.key),
          contentType: object.httpMetadata && object.httpMetadata.contentType
            ? object.httpMetadata.contentType
            : null
        }));

        return new Response(JSON.stringify({
          success: true,
          bucketType,
          prefix,
          objects,
          truncated: Boolean(listed.truncated),
          cursor: listed.cursor || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'List failed',
          message: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle DELETE request
    if (request.method === 'DELETE') {
      try {
        const body = await request.json();
        const { key, bucketType = 'default' } = body;

        if (!key) {
          return new Response(JSON.stringify({ error: 'No key provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Select bucket
        let bucket;
        if (bucketType === 'chat') {
          bucket = env.CHATBUCKET;
        } else {
          bucket = env.R2BUCKET || env.R2_BUCKET || env['r2-upload'];
        }

        if (!bucket) {
          return new Response(JSON.stringify({ error: 'Bucket not bound' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Delete the object
        await bucket.delete(key);

        return new Response(JSON.stringify({ success: true, key }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Delete failed', 
          message: error.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Only allow POST requests for upload
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders 
      });
    }

    // Handle JSON actions (metadata repair) before multipart upload flow.
    const contentTypeHeader = String(request.headers.get('content-type') || '').toLowerCase();
    if (contentTypeHeader.includes('application/json')) {
      try {
        const body = await request.json();
        const action = String(body.action || '').trim();

        if (action !== 'repairMetadata') {
          return new Response(JSON.stringify({ error: 'Unsupported POST action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Optional protection: if env token exists, require it.
        const requiredToken = String(env.METADATA_REPAIR_TOKEN || '').trim();
        if (requiredToken) {
          const providedToken = String(
            request.headers.get('x-admin-token') || body.token || ''
          ).trim();
          if (!providedToken || providedToken !== requiredToken) {
            return new Response(JSON.stringify({ error: 'Unauthorized metadata repair request' }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        const bucketType = body.bucketType === 'chat' ? 'chat' : 'default';
        const bucket = resolveBucketFromType(env, bucketType);
        if (!bucket) {
          return new Response(JSON.stringify({ error: 'Bucket not bound' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const requestedContentType = String(body.contentType || '').trim();
        const dryRun = Boolean(body.dryRun);

        const rewriteObjectMetadata = async (rawKey) => {
          const key = normalizeObjectKey(rawKey);
          if (!key) {
            return { key, status: 'skipped', reason: 'empty-key' };
          }

          const head = await bucket.head(key);
          if (!head) {
            return { key, status: 'missing' };
          }

          const currentType = String(
            (head.httpMetadata && head.httpMetadata.contentType) || ''
          ).trim();
          const nextType = requestedContentType || inferContentType(key, currentType || 'application/octet-stream');

          if (!nextType || currentType === nextType) {
            return {
              key,
              status: 'unchanged',
              contentType: currentType || null
            };
          }

          if (dryRun) {
            return {
              key,
              status: 'would-update',
              from: currentType || null,
              to: nextType
            };
          }

          const object = await bucket.get(key);
          if (!object) {
            return { key, status: 'missing-after-head' };
          }

          const existingMeta = object.httpMetadata || {};
          await bucket.put(key, object.body, {
            httpMetadata: {
              contentType: nextType,
              contentDisposition: existingMeta.contentDisposition,
              contentEncoding: existingMeta.contentEncoding,
              contentLanguage: existingMeta.contentLanguage,
              cacheControl: existingMeta.cacheControl
            },
            customMetadata: object.customMetadata || undefined
          });

          return {
            key,
            status: 'updated',
            from: currentType || null,
            to: nextType
          };
        };

        // Single key mode.
        if (body.key) {
          const result = await rewriteObjectMetadata(body.key);
          return new Response(JSON.stringify({
            success: true,
            action: 'repairMetadata',
            bucketType,
            dryRun,
            result
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Batch mode by prefix and extension (default: pdf).
        const prefix = String(body.prefix || '').trim();
        const extension = String(body.extension || 'pdf').trim().replace(/^\./, '').toLowerCase();
        const maxObjectsRaw = Number(body.maxObjects);
        const maxObjects = Number.isFinite(maxObjectsRaw) && maxObjectsRaw > 0
          ? Math.min(Math.floor(maxObjectsRaw), 1000)
          : 200;

        let cursor = undefined;
        let scanned = 0;
        let processed = 0;
        let truncated = false;
        const results = [];

        while (processed < maxObjects) {
          const listed = await bucket.list({ prefix, cursor, limit: Math.min(1000, maxObjects) });
          const objects = listed.objects || [];

          for (const item of objects) {
            scanned += 1;
            const key = String(item.key || '');
            if (!key.toLowerCase().endsWith(`.${extension}`)) {
              continue;
            }

            const result = await rewriteObjectMetadata(key);
            results.push(result);
            processed += 1;

            if (processed >= maxObjects) {
              truncated = true;
              break;
            }
          }

          if (!listed.truncated || !listed.cursor) {
            break;
          }

          cursor = listed.cursor;
          if (processed >= maxObjects) {
            truncated = true;
            break;
          }
        }

        const updatedCount = results.filter(r => r.status === 'updated').length;
        const wouldUpdateCount = results.filter(r => r.status === 'would-update').length;
        const unchangedCount = results.filter(r => r.status === 'unchanged').length;
        const missingCount = results.filter(r => r.status === 'missing' || r.status === 'missing-after-head').length;

        return new Response(JSON.stringify({
          success: true,
          action: 'repairMetadata',
          bucketType,
          dryRun,
          prefix,
          extension,
          maxObjects,
          scanned,
          processed,
          truncated,
          summary: {
            updated: updatedCount,
            wouldUpdate: wouldUpdateCount,
            unchanged: unchangedCount,
            missing: missingCount
          },
          results
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Metadata repair failed',
          message: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    try {
      // Parse multipart form data first to get bucket selection
      const formData = await request.formData();
      const file = formData.get('file');
      const path = formData.get('path');
      const userName = formData.get('userName') || 'anonymous';
      const bucketType = formData.get('bucketType') || 'default'; // 'default' or 'chat'
      
      // Select bucket based on request
      let bucket;
      if (bucketType === 'chat') {
        bucket = env.CHATBUCKET;
        if (!bucket) {
          return new Response(JSON.stringify({ 
            error: 'Chat bucket not bound',
            message: 'Please bind the chat R2 bucket with variable name: CHATBUCKET',
            availableBindings: Object.keys(env)
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        bucket = env.R2BUCKET || env.R2_BUCKET || env['r2-upload'];
        if (!bucket) {
          return new Response(JSON.stringify({ 
            error: 'R2 bucket not bound',
            message: 'Please bind the R2 bucket with variable name: R2BUCKET',
            availableBindings: Object.keys(env)
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check configured total bucket size limit (fallback: 10GB)
      const MAX_BUCKET_SIZE = await resolveMaxBucketSize(env, bucketType);
      let totalSize = 0;
      
      try {
        let cursor = undefined;
        let truncated = false;

        do {
          const listed = await bucket.list({ cursor });
          for (const object of listed.objects) {
            totalSize += object.size;
          }

          truncated = Boolean(listed.truncated);
          cursor = listed.cursor;
        } while (truncated && cursor);
        
        // Check if adding this file would exceed the limit
        if (totalSize + file.size > MAX_BUCKET_SIZE) {
          return new Response(JSON.stringify({ 
            error: 'Storage limit exceeded',
            message: `Bucket storage limit would be exceeded. Current: ${(totalSize / (1024 * 1024)).toFixed(2)}MB, File: ${(file.size / (1024 * 1024)).toFixed(2)}MB, Max: ${(MAX_BUCKET_SIZE / (1024 * 1024)).toFixed(2)}MB`,
            currentSize: totalSize,
            fileSize: file.size,
            maxSize: MAX_BUCKET_SIZE
          }), {
            status: 507, // Insufficient Storage
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (listError) {
        console.error('Error checking bucket size:', listError);
        // Continue with upload if we can't check size (fail open)
      }

      // Generate a unique key organized by user name, then date
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = path || file.name || 'unnamed';
      
      // Sanitize username for file path - only remove truly problematic characters
      // Preserve Unicode letters (including Cyrillic, etc.) but remove path-breaking chars
      const safeUserName = userName.replace(/[\/\\:*?"<>|]/g, '_');
      
      const requestedKey = `${safeUserName}/${timestamp}/${fileName}`;
      const uniqueKeyResult = await resolveUniqueObjectKey(bucket, requestedKey);
      const key = uniqueKeyResult.key;

      // Upload to R2 - use arrayBuffer instead of stream for better compatibility
      const fileData = await file.arrayBuffer();
      const preferredType = String(file.type || '').trim();
      const contentType = preferredType && preferredType !== 'application/octet-stream'
        ? preferredType
        : inferContentType(fileName, preferredType || 'application/octet-stream');
      
      await bucket.put(key, fileData, {
        httpMetadata: {
          contentType,
        },
      });

      // Determine the public URL based on which bucket was used
      const publicDomain = bucketType === 'chat' 
        ? 'https://chat.coursebook.lol' 
        : 'https://files.coursebook.lol';

      // Return success response
      return new Response(JSON.stringify({
        success: true,
        key: key,
        requestedKey,
        duplicateResolved: uniqueKeyResult.wasDuplicate,
        url: buildPublicObjectUrl(publicDomain, key),
        size: file.size,
        name: file.name
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      // Return detailed error for debugging
      return new Response(JSON.stringify({ 
        error: 'Upload failed', 
        message: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
