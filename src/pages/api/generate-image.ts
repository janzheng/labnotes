// use the action

// import type { APIRoute } from "astro";

// export const POST: APIRoute = async ({ request }) => {
//   try {
//     // Parse the request body
//     const body = await request.text();
//     console.log("Image API Route: Raw request body:", body);
    
//     const { prompt } = JSON.parse(body);
//     console.log("Image API Route: Parsed request with prompt:", prompt);

//     if (!prompt) {
//       console.error("Image API Route: Missing prompt in request body");
//       return new Response(JSON.stringify({ error: "Prompt is required" }), { 
//         status: 400,
//         headers: {
//           "Content-Type": "application/json"
//         }
//       });
//     }

//     // This is a dummy implementation - in a real app, 
//     // you would call an image generation API like DALL-E, Midjourney, etc.

//     // Simulate processing time
//     await new Promise(resolve => setTimeout(resolve, 1000));

//     // Return a dummy response
//     const response = JSON.stringify({
//       success: true,
//       imageUrl: "https://placehold.co/600x400?text=AI+Generated+Image",
//       prompt
//     });

//     // Add CORS headers
//     const headers = new Headers();
//     headers.set("Content-Type", "application/json");
    
//     return new Response(response, {
//       status: 200,
//       headers
//     });

//   } catch (error) {
//     console.error("Image API Route: Error processing request:", error);
//     return new Response(
//       JSON.stringify({ error: "Failed to generate image", details: error.message }), 
//       {
//         status: 500,
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     );
//   }
// }; 