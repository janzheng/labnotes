import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { nanoid } from 'nanoid';
import { executePipeline } from '@/lib/pipeline';
export const server = {
  canvas: {
    typeC: defineAction({
      input: z.object({
        projectId: z.string(),
        componentIndex: z.number()
      }),
      handler: async () => {
        // Simply return the new response data
        return {
          message: "Hello from Type C Action!",
          timestamp: new Date().toISOString(),
          id: nanoid()
        };
      }
    }),

    chat: defineAction({
      input: z.object({
        prompt: z.string(),
        model: z.string(),
        provider: z.string(),
        projectId: z.string(),
        componentIndex: z.number()
      }),
      handler: async ({ prompt, model, provider }) => {
        // For now, just echo back the settings
        let result = await executePipeline([
          {
            "name": "ai",
            "settings": {
              "model": model,
              "provider": provider,
              "prompt": prompt
            }
          }
        ], {
          useCache: false,
          saveCache: false,
        });
        console.log('result', result);
        return {
          prompt,
          settings: { model, provider },
          response: result,
          timestamp: new Date().toISOString(),
          id: nanoid()
        };
      }
    })
  }
}; 