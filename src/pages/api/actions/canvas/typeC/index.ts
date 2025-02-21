import type { APIRoute } from 'astro';

export const typeCAction = async () => {
  return {
    message: "Hello from Type C Action!",
    timestamp: new Date().toISOString()
  };
};

// This endpoint handles the POST request
export const POST: APIRoute = async ({ request }) => {
  try {
    const response = await typeCAction();
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 