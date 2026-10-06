import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NCM_TOKEN=Deno.env.get("NCM_TOKEN")!;
const NCM_BASE="https://nepalcanmove.com";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
let ncmQueue=Promise.resolve();

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

async function ncmRequest(path:string,base=NCM_BASE){
  for(let attempt=0;attempt<3;attempt++){
    const r=await fetch(base+path,{headers:{Authorization:"Token "+NCM_TOKEN,Accept:"application/json","User-Agent":"NepalCanMovePHPSDK"}});
    if(r.status!==429||attempt===2){
      const t=await r.text(); let b:any={}; try{b=t?JSON.parse(t):{}}catch{b={raw:t}}
      if(!r.ok)throw new Error("NCM "+r.status+": "+String(b?.Error||b?.message||b?.detail||t).slice(0,300));
      return b;
    }
    const retryAfter=Number(r.headers.get("Retry-After")||0);
    await r.arrayBuffer().catch(()=>{});
    await sleep(Math.max(1100,Number.isFinite(retryAfter)&&retryAfter>0?retryAfter*1000:0));
  }
  throw new Error("NCM request failed after retry");
}

async function ncm(path:string,base=NCM_BASE){
  const run=()=>ncmRequest(path,base);
  const next=ncmQueue.catch(()=>{}).then(run);
  ncmQueue=next.then(()=>undefined,()=>undefined);
  return next;
}
function tracking(v:any):string{
  const keys=["tracking_id","trackingId","track_id","trackId","trackingid","trackid","tracking_number","trackingNumber"];
  const seen=new Set<any>();
  const walk=(x:any):string=>{
    if(!x||typeof x!=="object"||seen.has(x))return "";
    seen.add(x);
    if(Array.isArray(x)){for(const y of x){const f=walk(y);if(f)return f;}return ""}
    for(const k of keys){if(x[k]!==undefined&&x[k]!==null&&String(x[k]).trim())return String(x[k]).trim()}
    for(const y of Object.values(x)){const f=walk(y);if(f)return f}
    return "";
  }; return walk(v);
}
function mapStatus(raw:string):string|null{
  const s=String(raw||"").toLowerCase().replace(/[_-]+/g," ");
  if(s.includes("deliver"))return "delivered";
  if(s.includes("return"))return "returned";
  if(s.includes("cancel"))return "cancelled";
  if(s.includes("pickup order created")||s.includes("order created")||s.includes("created")||s.includes("process")||s.includes("warehouse")||s.includes("assigned"))return "processing";
  if(s.includes("pickup")||s.includes("transit")||s.includes("dispatch")||s.includes("arriv"))return "shipped";
  return null;
}
async function db(path:string,init:RequestInit={}){
  return fetch(SUPABASE_URL+"/rest/v1/"+path,{...init,headers:{apikey:SERVICE_ROLE_KEY,Authorization:"Bearer "+SERVICE_ROLE_KEY,"Content-Type":"application/json",...(init.headers||{})}});
}
Deno.serve(async(req)=>{
  const secret=req.headers.get("x-cron-secret")||"";
  const sb=createClient(SUPABASE_URL,SERVICE_ROLE_KEY);
  const auth=await sb.rpc("verify_ncm_sync_cron_secret",{p_secret:secret});
  if(auth.error||auth.data!==true)return json({error:"Unauthorized"},401);
  try{
    const r=await db("orders?ncm_order_id=not.is.null&ncm_status=not.in.(delivered,returned,cancelled)&select=id,ncm_order_id,ncm_status&limit=100");
    if(!r.ok)throw new Error(await r.text());
    const orders=await r.json();
    const results=[];
    for(const o of orders){
      if (/^(cancelled|canceled)$/i.test(String(o.ncm_status || "").trim())) {
        results.push({id:o.id,status:o.ncm_status,preserved_cancelled:true});
        continue;
      }
      try{
        let details:any=null,history:any=null,trackingId="";
        try{details=await ncm("/api/v1/order?id="+encodeURIComponent(o.ncm_order_id));trackingId=tracking(details)}catch{}
        try{history=await ncm("/api/v1/order/status?id="+encodeURIComponent(o.ncm_order_id));}catch(e){
          try{history=await ncm("/api/v1/order/status?id="+encodeURIComponent(o.ncm_order_id),"https://portal.nepalcanmove.com");}catch{throw e}
        }
        const list=Array.isArray(history)?history:Array.isArray(history?.results)?history.results:Array.isArray(history?.data)?history.data:Array.isArray(history?.history)?history.history:[];
        const latest=list.slice().sort((a:any,b:any)=>new Date(a.added_time||a.addedTime||a.timestamp||0).getTime()-new Date(b.added_time||b.addedTime||b.timestamp||0).getTime()).pop();
        const raw=String(latest?.status||latest?.event||o.ncm_status||"");
        const patch:any={ncm_status:raw,ncm_last_sync_at:new Date().toISOString()};
        if(trackingId&&trackingId!==String(o.ncm_order_id))patch.ncm_tracking_id=trackingId;
        const mapped=mapStatus(raw); if(mapped)patch.order_status=mapped;
        const up=await db("orders?id=eq."+encodeURIComponent(o.id),{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify(patch)});
        if(!up.ok)throw new Error(await up.text());
        results.push({id:o.id,status:raw,tracking_id:trackingId||null});
      }catch(e){results.push({id:o.id,error:e instanceof Error?e.message:String(e)})}
    }
    return json({success:true,checked:orders.length,results});
  }catch(e){return json({error:e instanceof Error?e.message:String(e)},500)}
});