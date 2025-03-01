/* 

  temporary; for use with Novel for AI generation

*/

import type { APIRoute } from "astro";
import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { match } from "ts-pattern";

const groq = createGroq({
  apiKey: import.meta.env.GROQ_API_KEY,
});


export const POST: APIRoute = async ({ request }) => {
  

  try {
    const body = await request.text();
    console.log("API Route: Raw request body:", body);
    
    const { prompt, option, command, messageHistory = [], action } = JSON.parse(body);
    console.log("API Route: Parsed request:", { prompt, option, command, messageHistoryLength: messageHistory.length, action });
    
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
      .with("explain", () => [
        {
          role: "system",
          content:
            "You are a helpful assistant. " +
            "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
            "Use Markdown formatting when appropriate." +
            "Don't introduce your response with 'Here's what I think about that...' or anything like that. Just give the explanation.",
        },
        {
          role: "user",
          content: `Explain the following text: ${prompt}`,
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
      .with("shorter", "shorten", () => [
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
      .with("longer", "lengthen", () => [
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
      .with("professional", () => [
        {
          role: "system",
          content:
            "You are an AI writing assistant that makes text sound more professional. " +
            "Use Markdown formatting when appropriate.",
        },
        {
          role: "user",
          content: `The existing text is: ${prompt}`,
        },
      ])
      .with("casual", () => [
        {
          role: "system",
          content:
            "You are an AI writing assistant that makes text sound more casual and conversational. " +
            "Use Markdown formatting when appropriate.",
        },
        {
          role: "user",
          content: `The existing text is: ${prompt}`,
        },
      ])
      .with("simplify", () => [
        {
          role: "system",
          content:
            "You are an AI writing assistant that simplifies text to make it easier to understand. " +
            "Use Markdown formatting when appropriate.",
        },
        {
          role: "user",
          content: `The existing text is: ${prompt}`,
        },
      ])
      .with("zap", () => {
        if (messageHistory && messageHistory.length > 0) {
          return [
            {
              role: "system",
              content: "You are a helpful writing assistant. Maintain context from the conversation history."
            },
            ...messageHistory,
          ];
        } else {
          return [
            {
              role: "system",
              content: "You are a helpful writing assistant.",
            },
            {
              role: "user",
              content: command ? `${command}\n\nText: ${prompt}` : prompt,
            },
          ];
        }
      })
      .otherwise(() => {
        console.log("API Route: Unrecognized option, falling back to default:", option);
        // If we don't recognize the option but have a command, use it as an instruction
        if (command) {
          return [
            {
              role: "system",
              content: "You are a helpful writing assistant that follows instructions precisely.",
            },
            {
              role: "user",
              content: `<instruction>${command}</instruction>\n\nText: ${prompt}`,
            },
          ];
        }
        // Default fallback
        return [
          {
            role: "system",
            content: "You are a helpful writing assistant.",
          },
          {
            role: "user",
            content: prompt,
          },
        ];
      });

    console.log("API Route: Generated messages:", messages);

    const stream = await streamText({
      messages,
      maxTokens: 4096,
      temperature: 0.7,
      // model: groq("llama-3.3-70b-versatile"),
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
