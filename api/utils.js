/**
 * Common fetch utility for API routes to handle errors safely and ensure JSON responses.
 */
export async function safeFetch(url, options = {}, logPrefix = "[API]") {
  console.log(`${logPrefix} requesting url:`, url);
  
  try {
    const response = await fetch(url, options);
    console.log(`${logPrefix} response status:`, response.status);
    
    const text = await response.text();
    console.log(`${logPrefix} response text length:`, text.length);
    
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: "Upstream API request failed",
        bodyPreview: text.slice(0, 300)
      };
    }
    
    try {
      console.log(`${logPrefix} JSON.parse starting`);
      const data = JSON.parse(text);
      return {
        ok: true,
        status: response.status,
        data
      };
    } catch (parseError) {
      console.error(`${logPrefix} JSON parse error:`, parseError.message);
      return {
        ok: false,
        status: 500,
        error: "Upstream response was not valid JSON",
        bodyPreview: text.slice(0, 300)
      };
    }
  } catch (fetchError) {
    console.error(`${logPrefix} fetch error:`, fetchError.message);
    return {
      ok: false,
      status: 500,
      error: "Network or fetch error",
      detail: fetchError.message
    };
  }
}
