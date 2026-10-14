import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NCM_TOKEN=Deno.env.get("NCM_TOKEN")||"";
const NCM_BASE="https://nepalcanmove.com";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});

async function db(path:string){
  return fetch(SUPABASE_URL+"/rest/v1/"+path,{headers:{apikey:SERVICE_ROLE_KEY,Authorization:"Bearer "+SERVICE_ROLE_KEY,Accept:"application/json"}});
}
async function ncm(path:string,base=NCM_BASE){
  if(!NCM_TOKEN)throw new Error("NCM credentials are not configured");
  const r=await fetch(base+path,{headers:{Authorization:"Token "+NCM_TOKEN,Accept:"application/json","User-Agent":"SuruCollectionOrderTracking"}});
  const text=await r.text();let body:any={};try{body=text?JSON.parse(text):{}}catch{body={raw:text}}
  if(!r.ok)throw new Error("NCM status unavailable ("+r.status+")");
  return body;
}
function historyList(value:any):any[]{
  if(Array.isArray(value))return value;
  for(const key of ["results","data","history"])if(Array.isArray(value?.[key]))return value[key];
  return [];
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="GET")return json({error:"Method not allowed"},405);
  try{
    const url=new URL(req.url);
    const orderNumber=String(url.searchParams.get("order_number")||"").trim();
    if(!/^SC-[A-Za-z0-9-]{6,48}$/i.test(orderNumber))return json({error:"Invalid order number or tracking link."},400);
    const orderResponse=await db("orders?order_number=eq."+encodeURIComponent(orderNumber)+"&select=id,order_number,created_at,total,order_status,payment_status,payment_method,ncm_order_id,ncm_tracking_id,ncm_status,ncm_last_sync_at&limit=1");
    if(!orderResponse.ok)throw new Error("Unable to load order");
    const orders=await orderResponse.json();
    if(!orders.length)return json({error:"We could not find an order with that number. Please check the tracking link."},404);
    const order=orders[0];
    const itemResponse=await db("order_items?order_id=eq."+encodeURIComponent(order.id)+"&select=product_name,product_code,size,color,quantity");
    const items=itemResponse.ok?await itemResponse.json():[];
    let ncmStatus=order.ncm_status||"",trackingId=order.ncm_tracking_id||"",statusHistory:any[]=[];
    if(order.ncm_order_id&&!/^(cancelled|canceled|delivered|returned)$/i.test(String(ncmStatus).trim())){
      const path="/api/v1/order/status?id="+encodeURIComponent(order.ncm_order_id);
      let history:any=null;
      for(const base of [NCM_BASE,"https://portal.nepalcanmove.com"]){try{history=await ncm(path,base);break}catch(e){console.warn("NCM tracking endpoint attempt failed",String(e))}}
      if(history){
        statusHistory=historyList(history).slice().sort((a,b)=>new Date(a.added_time||a.addedTime||a.timestamp||0).getTime()-new Date(b.added_time||b.addedTime||b.timestamp||0).getTime()).slice(-12).map((s)=>({status:String(s.status||""),event:String(s.event||""),added_time:s.added_time||s.addedTime||s.timestamp||null}));
        const latest=statusHistory[statusHistory.length-1];
        if(latest?.status||latest?.event)ncmStatus=String(latest.status||latest.event);
      }
      try{
        const detail=await ncm("/api/v1/order?id="+encodeURIComponent(order.ncm_order_id));
        const walk=(v:any,seen=new Set<any>()):string=>{if(!v||typeof v!=="object"||seen.has(v))return "";seen.add(v);if(Array.isArray(v)){for(const x of v){const f=walk(x,seen);if(f)return f}return ""}for(const k of ["tracking_id","trackingId","track_id","trackId","tracking_number","trackingNumber"])if(v[k])return String(v[k]);for(const x of Object.values(v)){const f=walk(x,seen);if(f)return f}return ""};
        const found=walk(detail);if(found)trackingId=found;
      }catch{/* Use cached tracking ID if NCM details are temporarily unavailable. */}
    }
    return json({order_number:order.order_number,created_at:order.created_at,total:order.total,order_status:order.order_status,payment_status:order.payment_status,payment_method:order.payment_method,items,ncm_order_id:order.ncm_order_id,ncm_tracking_id:trackingId,ncm_status:ncmStatus,status_history:statusHistory,ncm_checked_at:new Date().toISOString()});
  }catch(error){
    console.error("Public order tracking error",error);
    return json({error:"Tracking is temporarily unavailable. Please try again shortly."},500);
  }
});
