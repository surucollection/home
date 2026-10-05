import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async req=>{
  return new Response(
    JSON.stringify({error:"Legacy image processing is disabled. Suru Collection now uses manually cleaned Google Drive images."}),
    {status:410,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"https://suru.com.np"}}
  );
});
