import { executeStreamingPipeline } from '@/lib/pipeline';

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { messages, model, provider } = body;

    // Ensure messages array exists and has content
    const messageHistory = messages[0]?.role === "system" 
      ? messages 
      : [
          { role: "system", content: "You are a helpful assistant." },
          ...messages
        ];

    const response = await executeStreamingPipeline([
      {
        "name": "ai",
        "settings": {
          "model": model,
          "provider": provider,
          "messages": messageHistory
        }
      }
    ], {
      useCache: false,
      saveCache: false,
    });

    // Return the streaming response
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    console.error('Streaming API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process streaming request' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
