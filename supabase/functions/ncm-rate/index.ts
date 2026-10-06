import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const NCM_TOKEN=Deno.env.get("NCM_TOKEN")||"";
const NCM_BASE="https://nepalcanmove.com";
const ORIGIN_BRANCH="GAUR";
const DELIVERY_TYPE="Pickup/Collect";
const DOOR_PICKUP_CHARGE=15;
const CACHE_TTL_MS=15*60*1000;
const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
let branchCache:{expires:number;branches:any[]}|null=null;
async function ncmFetch(url:string,init:RequestInit={},retries=1){
  for(let attempt=0;;attempt++){
    const r=await fetch(url,{...init,headers:{...(init.headers||{}),Authorization:"Token "+NCM_TOKEN,Accept:"application/json","Content-Type":"application/json","User-Agent":"NepalCanMovePHPSDK"}});
    if(r.status===429&&attempt<retries){await new Promise(x=>setTimeout(x,1000));continue}
    return r;
  }
}
async function getBranches(){
  if(branchCache&&branchCache.expires>Date.now())return branchCache.branches;
  const r=await ncmFetch(NCM_BASE+"/api/v2/branches");
  const text=await r.text();let body:any;try{body=JSON.parse(text)}catch{throw new Error("NCM returned an invalid branches response")}
  if(!r.ok)throw new Error(body?.Error||body?.message||body?.detail||("NCM branches API error ("+r.status+")"));
  const raw=Array.isArray(body)?body:(body?.results||body?.branches||[]);
  const branches=raw.map((b:any)=>({code:String(b.code??""),name:String(b.name??""),district_name:String(b.district_name??""),pk:b.pk??b.id??null})).filter((b:any)=>b.name);
  branchCache={expires:Date.now()+5*60*1000,branches};return branches;
}
function resolveBranch(input:string,branches:any[]){
  const v=input.trim().toUpperCase();
  return branches.find(b=>String(b.name).trim().toUpperCase()===v||String(b.code).trim().toUpperCase()===v)||null;
}
async function getRate(destination:string){
  const key=destination.trim().toUpperCase();
  const {data:cached,error:cacheError}=await admin.from("ncm_delivery_rate_cache").select("origin_branch,destination_branch,delivery_type,ncm_charge,door_pickup_charge,fetched_at,expires_at,raw_response").eq("origin_branch",ORIGIN_BRANCH).eq("destination_branch",key).eq("delivery_type",DELIVERY_TYPE).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(cacheError)throw cacheError;
  if(cached)return cached;
  const url=new URL(NCM_BASE+"/api/v1/shipping-rate");
  url.searchParams.set("creation",ORIGIN_BRANCH);
  url.searchParams.set("destination",destination);
  url.searchParams.set("type",DELIVERY_TYPE);
  const r=await ncmFetch(url.toString());
  const text=await r.text();let body:any;try{body=JSON.parse(text)}catch{throw new Error("NCM returned an invalid rate response")}
  if(!r.ok)throw new Error(body?.Error||body?.message||body?.detail||("NCM rate API error ("+r.status+")"));
  const charge=Number(body?.charge??body?.delivery_charge);
  if(!Number.isFinite(charge)||charge<0)throw new Error("NCM did not return a valid door-to-door delivery charge");
  const now=new Date(),expires=new Date(now.getTime()+CACHE_TTL_MS);
  const row={origin_branch:ORIGIN_BRANCH,destination_branch:key,delivery_type:DELIVERY_TYPE,ncm_charge:Math.round(charge*100)/100,door_pickup_charge:DOOR_PICKUP_CHARGE,fetched_at:now.toISOString(),expires_at:expires.toISOString(),raw_response:body};
  const {error}=await admin.from("ncm_delivery_rate_cache").upsert(row,{onConflict:"origin_branch,destination_branch,delivery_type"});
  if(error)throw error;
  return row;
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    if(!NCM_TOKEN)throw new Error("NCM_TOKEN secret is not configured");
    const body=await req.json().catch(()=>({}));
    const requested=String(body?.destinationBranch||"").trim();
    if(!requested)return json({error:"destinationBranch is required"},400);
    const branch=resolveBranch(requested,await getBranches());
    if(!branch)return json({error:"The selected NCM destination branch could not be verified"},400);
    const rate=await getRate(branch.name);
    const ncmCharge=Number(rate.ncm_charge),doorPickup=Number(rate.door_pickup_charge||DOOR_PICKUP_CHARGE);
    return json({originBranch:ORIGIN_BRANCH,destinationBranch:branch.name,destinationBranchCode:branch.code||null,deliveryType:DELIVERY_TYPE,ncmDeliveryCharge:ncmCharge,doorPickupCharge:doorPickup,advanceDeliveryCharge:Math.round((ncmCharge+doorPickup)*100)/100,fetchedAt:rate.fetched_at,expiresAt:rate.expires_at});
  }catch(e){
    console.error("NCM rate request failed:",e instanceof Error?e.message:"unknown error");
    return json({error:e instanceof Error?e.message:"Unable to calculate NCM delivery charge"},400);
  }
});