

export async function executePipeline(pipeline: any[], settings: any = {}, useLocal: boolean = false) {
  const HOST = useLocal || import.meta.env.MODE === 'development' ? 'http://localhost:9999' : 'https://coverflow.deno.dev';

  // const HOST = "https://coverflow.deno.dev";
  // const HOST = "http://localhost:9999";


  try {
    console.log("executePipeline",
      {
        pipelineName: "labnotes",
        pipeline,
        ...settings
      }
    );
    const response = await fetch(
      `${HOST}/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pipelineName: settings.pipelineName || "labnotes",
          pipeline,
          ...settings
        }),
      });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} // ${response.statusText} // ${await response.text()}`);
    }

    let result = await response.json();
    // console.log("[Pipeline] result", result);

    return result;
  } catch (error) {
    console.error("Error in executePipeline:", error);
  }
}

export async function executeStreamingPipeline(pipeline: any[], settings: any = {}, useLocal: boolean = false) {
  const response = await fetch(
    `${HOST}/stream-function`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        functionName: "gen",
        settings: {
          ...pipeline[0].settings,
          outputType: "stream"
        }
      })
    });

  return response;
}
