import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async req=>{
  return new Response(
    JSON.stringify({error:"This legacy migration endpoint is disabled."}),
    {status:410,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"https://suru.com.np"}}
  );
});
