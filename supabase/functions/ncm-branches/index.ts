import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const NCM_TOKEN = Deno.env.get("NCM_TOKEN") || "";
const NCM_BASE = "https://portal.nepalcanmove.com/api";
let cache:{expires:number; branches:unknown[]}={expires:0,branches:[]};

async function getBranches(){
  if(cache.expires>Date.now() && cache.branches.length) return cache.branches;
  if(!NCM_TOKEN) throw new Error("NCM_TOKEN secret is not configured");
  const headers={
    Authorization:"Token "+NCM_TOKEN,
    Accept:"application/json",
    "Content-Type":"application/json",
    "User-Agent":"NepalCanMovePHPSDK"
  };
  let url:string|null=NCM_BASE+"/v2/branches";
  const raw:any[]=[];
  const visited=new Set<string>();
  // The NCM API may paginate branch records. Fetch every page so the UI
  // never silently presents only the first subset of branches.
  while(url){
    if(visited.has(url))throw new Error("NCM branch API returned a pagination loop");
    visited.add(url);
    const r=await fetch(url,{headers});
    const text=await r.text();
    let body:any;
    try{body=JSON.parse(text)}catch{throw new Error("NCM returned an invalid response")}
    if(!r.ok)throw new Error(body?.Error||body?.message||body?.detail||("NCM API error ("+r.status+")"));
    if(Array.isArray(body)){
      raw.push(...body);
      url=null;
    }else{
      const page=Array.isArray(body?.results)?body.results:(Array.isArray(body?.branches)?body.branches:[]);
      raw.push(...page);
      const next=body?.next;
      if(next){
        url=new URL(String(next),NCM_BASE+"/v2/branches").toString();
        if(!url.startsWith(NCM_BASE+"/"))throw new Error("NCM returned an unexpected pagination URL");
      }else url=null;
    }
    if(visited.size>100)throw new Error("NCM branch pagination exceeded the safety limit");
  }
  const unique=new Map<string,any>();
  for(const b of raw){
    const key=String(b.code??b.pk??b.id??b.name??"").trim();
    if(!key)continue;
    unique.set(key,{
      pk:b.pk??b.id??null,
      code:b.code??"",
      name:b.name??"",
      address:b.address??"",
      geocode:b.geocode??"",
      branch_type:b.branch_type??"",
      areas_covered:b.areas_covered??"",
      province_name:b.province_name??"",
      district_name:b.district_name??"",
      municipality:b.municipality??b.municipality_name??"",
      phone:b.phone??""
    });
  }
  const branches=Array.from(unique.values()).filter(b=>b.name);
  if(!branches.length)throw new Error("NCM returned no branches");
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