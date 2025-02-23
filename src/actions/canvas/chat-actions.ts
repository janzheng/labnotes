import { executePipeline, executeStreamingPipeline } from '@/lib/pipeline';
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { nanoid } from 'nanoid';

export const chatAction = defineAction({
  input: z.object({
    model: z.string(),
    provider: z.string(),
    projectId: z.string(),
    componentIndex: z.number(),
    messages: z.array(z.object({
      role: z.string(),
      content: z.string()
    }))
  }),
  handler: async ({ model, provider, messages }) => {
    // Add system message if it's not already present
    const messageHistory = messages[0]?.role === "system" 
      ? messages 
      : [
          { role: "system", content: "You are a helpful assistant." },
          ...messages
        ];

    let result = await executePipeline([
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

    return {
      prompt: messages[messages.length - 1].content, // Get the last user message as prompt
      settings: { model, provider },
      response: result,
      timestamp: new Date().toISOString(),
      id: nanoid()
    };
  }
});
