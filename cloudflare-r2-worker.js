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

        if (action !== 'list') {
          return new Response(JSON.stringify({ error: 'Unsupported GET action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const bucketType = url.searchParams.get('bucketType') || 'default';
        const prefix = url.searchParams.get('prefix') || '';
        const cursor = url.searchParams.get('cursor') || undefined;
        const limitRaw = Number(url.searchParams.get('limit'));
        const limit = Number.isFinite(limitRaw) && limitRaw > 0
          ? Math.min(Math.floor(limitRaw), 1000)
          : 1000;

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
      
      await bucket.put(key, fileData, {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
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
