import type { APIRoute } from "astro";
import { createGroq } from "@ai-sdk/groq";
import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import { streamText } from "ai";
import { match } from "ts-pattern";

const groq = createGroq({
  apiKey: import.meta.env.GROQ_API_KEY,
});



export const POST: APIRoute = async ({ request }) => {
  

  try {
    const body = await request.text();
    console.log("API Route: Raw request body:", body);
    
    const { prompt, option, command } = JSON.parse(body);
    console.log("API Route: Parsed request:", { prompt, option, command });
    
    if (!prompt) {
      console.error("API Route: Missing prompt in request body");
      return new Response("Missing prompt in request body", { status: 400 });
    }

    const messages = match(option)
      .with("continue", () => [
        {
          role: "system",
          content:
            "You are an AI writing assistant that continues existing text based on context from prior text. " +
            "Give more weight/priority to the later characters than the beginning ones. " +
            "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
            "Use Markdown formatting when appropriate.",
        },
        {
          role: "user",
          content: prompt,
        },
      ])
      .with("improve", () => [
        {
          role: "system",
          content:
            "You are an AI writing assistant that improves existing text. " +
            "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
            "Use Markdown formatting when appropriate.",
        },
        {
          role: "user",
          content: `The existing text is: ${prompt}`,
        },
      ])
      .with("shorter", () => [
        {
          role: "system",
          content:
            "You are an AI writing assistant that shortens existing text. " + 
            "Use Markdown formatting when appropriate.",
        },
        {
          role: "user",
          content: `The existing text is: ${prompt}`,
        },
      ])
      .with("longer", () => [
        {
          role: "system",
          content:
            "You are an AI writing assistant that lengthens existing text. " +
            "Use Markdown formatting when appropriate.",
        },
        {
          role: "user",
          content: `The existing text is: ${prompt}`,
        },
      ])
      .with("fix", () => [
        {
          role: "system",
          content:
            "You are an AI writing assistant that fixes grammar and spelling errors in existing text. " +
            "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
            "Use Markdown formatting when appropriate.",
        },
        {
          role: "user",
          content: `The existing text is: ${prompt}`,
        },
      ])
      .with("zap", () => [
        {
          role: "system",
          content: "You are a helpful writing assistant.",
        },
        {
          role: "user",
          content: command ? `${command}\n\nText: ${prompt}` : prompt,
        },
      ])
      .otherwise(() => []);

    console.log("API Route: Generated messages:", messages);

    const stream = await streamText({
      messages,
      maxTokens: 4096,
      temperature: 0.7,
      model: groq("llama-3.3-70b-versatile"),
    });

    const response = stream.toDataStreamResponse();
    console.log("API Route: Created response stream");
    
    // Add CORS and content type headers
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    headers.set("Connection", "keep-alive");
    
    return new Response(response.body, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error("API Route: Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request", details: error.message }), 
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
