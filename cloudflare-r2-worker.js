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
      'Access-Control-Allow-Origin': '*', // Change to your domain in production
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS request for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders 
      });
    }

    try {
      // Check if R2 bucket is bound (try both possible names)
      const bucket = env.R2BUCKET || env.R2_BUCKET || env['r2-upload'];
      
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

      // Parse multipart form data
      const formData = await request.formData();
      const file = formData.get('file');
      const path = formData.get('path');
      const userName = formData.get('userName') || 'anonymous';

      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
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

      // Return success response
      return new Response(JSON.stringify({
        success: true,
        key: key,
        url: `https://your-r2-domain.com/${key}`,
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
