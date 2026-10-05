import "jsr:@supabase/functions-js/runtime.d.ts";
Deno.serve(async req=>{
  return new Response(
    JSON.stringify({error:"Legacy processed-image upload is disabled. Suru Collection now uses the original Google Drive product image workflow."}),
    {status:410,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"https://suru.com.np"}}
  );
});
