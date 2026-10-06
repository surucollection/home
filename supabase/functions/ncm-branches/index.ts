import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const NCM_TOKEN = Deno.env.get("NCM_TOKEN") || "";
const NCM_BASE = "https://portal.nepalcanmove.com/api";
let cache:{expires:number; branches:unknown[]}={expires:0,branches:[]};

async function getBranches(){
  if(cache.expires>Date.now() && cache.branches.length) return cache.branches;
  if(!NCM_TOKEN) throw new Error("NCM_TOKEN secret is not configured");
  const r=await fetch(NCM_BASE+"/v2/branches",{
    headers:{
      Authorization:"Token "+NCM_TOKEN,
      Accept:"application/json",
      "Content-Type":"application/json",
      "User-Agent":"NepalCanMovePHPSDK"
    }
  });
  const text=await r.text();
  let body:any;
  try{body=JSON.parse(text)}catch{throw new Error("NCM returned an invalid response")}
  if(!r.ok) throw new Error(body?.Error||body?.message||body?.detail||("NCM API error ("+r.status+")"));
  const raw=Array.isArray(body)?body:(body?.results||body?.branches||[]);
  const branches=raw.map((b:any)=>({
    pk:b.pk??b.id??null,
    code:b.code??"",
    name:b.name??"",
    address:b.address??"",
    geocode:b.geocode??"",
    branch_type:b.branch_type??"",
    areas_covered:b.areas_covered??"",
    province_name:b.province_name??"",
    district_name:b.district_name??"",
    phone:b.phone??""
  })).filter((b:any)=>b.name);
  cache={expires:Date.now()+5*60*1000,branches};
  return branches;
}

Deno.serve(async(req:Request)=>{
  const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const branches=await getBranches();
    return new Response(JSON.stringify({branches}),{headers:{...cors,"Content-Type":"application/json"}});
  }catch(e){
    return new Response(JSON.stringify({error:e?.message||"Unable to load NCM branches"}),{status:502,headers:{...cors,"Content-Type":"application/json"}});
  }
});