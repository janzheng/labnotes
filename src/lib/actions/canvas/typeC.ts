import type { APIRoute } from 'astro';

export const typeCAction = async () => {
  return {
    message: "Hello from Type C Action!",
    timestamp: new Date().toISOString()
  };
};

export const POST: APIRoute = async ({ request }) => {
  const response = await typeCAction();
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}; 