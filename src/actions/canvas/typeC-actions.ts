import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { nanoid } from 'nanoid';

export const typeCAction = defineAction({
  input: z.object({
    projectId: z.string(),
    componentIndex: z.number()
  }),
  handler: async () => {
    return {
      message: "Hello from Type C Action!",
      timestamp: new Date().toISOString(),
      id: nanoid()
    };
  }
}); 