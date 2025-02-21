import type { APIRoute } from 'astro'

import { executePipeline } from "@/lib/pipeline.ts";

export const GET: APIRoute = async ({ params }) => {
  try {

    console.log("[getEvgData] params", params);
    // Run both pipelines in parallel
    const [home, terms] = await Promise.all([
      executePipeline([{
        "name": "cfnotionPagesLoader",
        "settings": {
          "path": "1846478089c680878753f334cb8e6969",
          "returnPageBlocks": true
        }
      }], {
        useCache: params.useCache,
        saveCache: true,
      }),

      executePipeline([{
        "name": "cfnotionPagesLoader",
        "settings": {
          "path": "1856478089c68031a136dd507860e9a3",
          "returnPageBlocks": true
        }
      }], {
        useCache: params.useCache,
        saveCache: true,
      })
    ]);

    const evgData = {
      home,
      terms
    }

    return new Response(JSON.stringify(evgData));
  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

// Add the new search endpoint
export const getEvgAbstracts: APIRoute = async ({ request }) => {
  try {
    const result = await executePipeline([
      {
        name: "airGetTable",
        save: "abstracts",
        settings: {
          tableName: "Abstracts",
          baseId: "appdHWdF4iJ2nUEp3",
          options: {
            fields: [
              "AbstractTitle",
              "Authors",
              "Affiliations",
              "Body"
            ]
          }
        }
      }
    ], {
      useCache: false,
      saveCache: false,
    });

    console.log("[getEvgAbstracts] result", result);

    return new Response(JSON.stringify(result));
  } catch (error) {
    console.error("Error searching abstracts:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};