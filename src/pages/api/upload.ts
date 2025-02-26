/* 

  temporary; for use with Novel

*/

import { executePipeline } from '@/lib/pipeline';

export const config = {
  api: {
    bodyParser: false, // Disabling body parser as we'll handle the raw stream
  },
};

export async function POST({ request }) {
  try {
    // Get the content type and filename from headers
    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const filename = request.headers.get('x-filename') || request.headers.get('x-vercel-filename') || 'image.png';
    
    // Get the file data as ArrayBuffer
    const fileData = await request.arrayBuffer();
    
    // Convert ArrayBuffer to Base64 for transmission
    const base64Data = Buffer.from(fileData).toString('base64');
    
    // Execute the pipeline with f2upload function
    const response = await executePipeline([
      {
        "name": "f2upload",
        "settings": {
          "scope": "uploads", // Define your scope as needed
          "filename": filename,
          "contentType": contentType,
          "data": base64Data,
          "encoding": "base64"
        }
      }
    ]);
    
    if (response && response.permalink) {
      // Return the URL of the uploaded file
      return new Response(JSON.stringify({ url: response.permalink }), {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else {
      console.error('Upload failed:', response);
      return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Upload API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process upload request' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

