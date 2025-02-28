export async function executePipeline(pipeline: any[], settings: any = {}, useLocal: boolean = false) {
  try {
    console.log("executePipeline",
      {
        pipeline,
        // ...settings // bad for uploading large images
        settings: JSON.stringify(settings).substring(0, 5000)
      }
    );
    const response = await fetch(
      useLocal ? 'http://localhost:9999/execute' :
        (import.meta.env.DEV ? 'http://localhost:9999/execute' : 'https://coverflow.deno.dev/execute'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
    useLocal ? 'http://localhost:9999/stream-function' :
      (import.meta.env.DEV ? 'http://localhost:9999/stream-function' : 'https://coverflow.deno.dev/stream-function'),
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
