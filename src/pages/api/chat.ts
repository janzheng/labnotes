// deprecated / unused

// import { createOpenAI } from '@ai-sdk/openai';
// import { generateText } from 'ai';
// import type { APIRoute } from 'astro';


// const openai = createOpenAI({
//   apiKey: import.meta.env.OPENAI_API_KEY,
// });


// export const POST: APIRoute = async ({ request }) => {
//   const OPENAI_API_KEY = import.meta.env.OPENAI_API_KEY;
//   console.log("API Route: Checking OpenAI key:", OPENAI_API_KEY ? "Present" : "Missing");

//   if (!OPENAI_API_KEY) {
//     console.error("API Route: Missing OPENAI_API_KEY");
//     return new Response(
//       JSON.stringify({
//         error: "Missing OPENAI_API_KEY - please add it to your .env file"
//       }),
//       {
//         status: 400,
//         headers: {
//           "Content-Type": "application/json"
//         }
//       }
//     );
//   }

//   try {
//     const body = await request.text();
//     console.log("API Route: Raw request body:", body);

//     const { messages, options } = JSON.parse(body);
//     console.log("API Route: Parsed request:", { messages, options });

//     if (!messages?.length) {
//       return new Response(
//         JSON.stringify({ error: "Missing messages in request body" }),
//         {
//           status: 400,
//           headers: {
//             "Content-Type": "application/json"
//           }
//         }
//       );
//     }

//     // Get the last user message
//     const lastMessage = messages[messages.length - 1];
    
//     const { text, reasoning, usage } = await generateText({
//       model: openai('gpt-4-turbo-preview'),
//       system: 'You are a helpful writing assistant that helps users improve their text.',
//       prompt: lastMessage.content,
//       temperature: 0.7,
//       maxTokens: 4096,
//     });

//     console.log("Generation complete:", { text, reasoning, usage });

//     return new Response(
//       JSON.stringify({
//         role: 'assistant',
//         content: text,
//         reasoning,
//         usage
//       }),
//       {
//         status: 200,
//         headers: {
//           "Content-Type": "application/json"
//         }
//       }
//     );

//   } catch (error) {
//     console.error("API Route: Error processing request:", error);
//     return new Response(
//       JSON.stringify({
//         error: "Failed to process request",
//         details: error.message
//       }),
//       {
//         status: 500,
//         headers: {
//           "Content-Type": "application/json"
//         }
//       }
//     );
//   }
// };