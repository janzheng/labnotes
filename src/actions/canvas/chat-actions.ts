import { executePipeline } from '@/lib/pipeline';
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
      text: messages[messages.length - 1].content, // Add text field to match what the component expects
      settings: { model, provider },
      response: result,
      timestamp: new Date().toISOString(),
      id: nanoid()
    };
  }
});

export const generateImageAction = defineAction({
  input: z.object({
    prompt: z.string(),
    model: z.string().default('recraft-ai/recraft-v3'),
    provider: z.string().default('replicate'),
    projectId: z.string(),
    componentIndex: z.number(),
    scope: z.string().default('test'),
    filename: z.string().default('generated_image.png')
  }),
  handler: async ({ prompt, model, provider, scope, filename }) => {
    let result = await executePipeline([
      {
        name: "ai",
        save: "image",
        settings: {
          prompt,
          provider,
          outputType: "image",
          model
        }
      },
      {
        name: "f2upload",
        settings: {
          data: "raw:image.uint8ArrayData",
          scope,
          filename,
          contentType: "image/png"
        }
      }
    ], {
      useCache: false,
      saveCache: false,
    });

    return {
      prompt,
      settings: { model, provider },
      imageUrl: result?.permalink || result?.url || result?.imageUrl || null,
      timestamp: new Date().toISOString(),
      id: nanoid()
    };
  }
});

export const threadgirlAction = defineAction({
  input: z.object({
    command: z.string(),
    sources: z.array(z.object({
      url: z.string(),
      text: z.string()
    })),
    prompts: z.array(z.string()),
    query: z.string(),
    url: z.string(),
    useCache: z.boolean().default(true),
    saveCache: z.boolean().default(true),
  }),
  handler: async ({ command, sources, prompts, query, url, useCache, saveCache }) => {
    let pipeline: any[] = [];

    if (command === "getThreadgirlPrompts") {
      pipeline = [
        {
          "name": "getPrompts",
          "settings": {
            "useCache": useCache,
          }
        }
      ]
    } else if (command === "runThreadgirl") {
      pipeline = [
        {
          "name": "threadgirlquery",
          "settings": {
            "query": query,
            "useCache": useCache,
          }
        }
      ]
    }

    let result = await executePipeline(pipeline, {
      useCache: useCache,
      saveCache: saveCache,
    });
    

    return {
      prompts: command === "getThreadgirlPrompts" ? result : null,
      result: command === "runThreadgirl" ? result : null,
      id: nanoid()
    };
  }
});
