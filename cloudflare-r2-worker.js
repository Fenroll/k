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

export default {
  async fetch(request, env) {
    // CORS headers for your domain
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://coursebook.lol', // Restricted to production domain
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
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

      // Check bucket size limit (10GB = 10 * 1024 * 1024 * 1024 bytes)
      const MAX_BUCKET_SIZE = 10 * 1024 * 1024 * 1024;
      let totalSize = 0;
      
      try {
        const listed = await bucket.list();
        for (const object of listed.objects) {
          totalSize += object.size;
        }
        
        // Check if adding this file would exceed the limit
        if (totalSize + file.size > MAX_BUCKET_SIZE) {
          return new Response(JSON.stringify({ 
            error: 'Storage limit exceeded',
            message: `Bucket storage limit of 10GB would be exceeded. Current: ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)}GB, File: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
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
      
      const key = `${safeUserName}/${timestamp}/${fileName}`;

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
        url: `${publicDomain}/${key}`,
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
