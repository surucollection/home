import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SUPABASE_ANON_KEY=Deno.env.get("SUPABASE_ANON_KEY")||"";
const SUPABASE_SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const ENABLED=String(Deno.env.get("CYBERSOURCE_ENABLED")||"").toLowerCase()==="true";
const ENV=String(Deno.env.get("CYBERSOURCE_ENV")||"test").toLowerCase()==="production"?"production":"test";
const MERCHANT_ID=(Deno.env.get("CYBERSOURCE_MERCHANT_ID")||"").trim();
const KEY_ID=(Deno.env.get("CYBERSOURCE_KEY_ID")||"").trim();
const SECRET_KEY=(Deno.env.get("CYBERSOURCE_SECRET_KEY")||"").trim();
const TARGET_ORIGIN=(Deno.env.get("CYBERSOURCE_TARGET_ORIGIN")||"https://suru.com.np").trim().replace(/\/$/,"");
const COUNTRY=(Deno.env.get("CYBERSOURCE_COUNTRY")||"NP").trim();
const CURRENCY=(Deno.env.get("CYBERSOURCE_CURRENCY")||"NPR").trim();
const LOCALE=(Deno.env.get("CYBERSOURCE_LOCALE")||"en_US").trim();
const ALLOWED_PAYMENT_TYPES=(Deno.env.get("CYBERSOURCE_ALLOWED_PAYMENT_TYPES")||"PANENTRY").split(",").map(x=>x.trim()).filter(Boolean);
const BASE=ENV==="production"?"https://api.cybersource.com":"https://apitest.cybersource.com";

const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={
  "Access-Control-Allow-Origin":TARGET_ORIGIN,
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

function b64(bytes:ArrayBuffer|Uint8Array){
  const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let s="";
  for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));
  return btoa(s);
}
function b64ToBytes(value:string){
  const raw=atob(value.replace(/\s+/g,""));const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
function b64urlDecode(value:string){
  const s=String(value||"").replace(/-/g,"+").replace(/_/g,"/");
  return b64ToBytes(s+"=".repeat((4-s.length%4)%4));
}
async function hmacB64(secretB64:string,text:string){
  const key=await crypto.subtle.importKey("raw",b64ToBytes(secretB64),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(text)));
}
async function digestB64(body:string){
  return b64(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(body)));
}
async function signedFetch(method:string,path:string,body?:string){
  if(!MERCHANT_ID||!KEY_ID||!SECRET_KEY)throw new Error("CyberSource merchant credentials are not configured.");
  const url=BASE+path;
  const host=new URL(BASE).host;
  const date=new Date().toUTCString();
  const hasBody=typeof body==="string";
  const digest=hasBody?"SHA-256="+await digestB64(body):"";
  const target=method.toLowerCase()+" "+path;
  const headersList=hasBody
    ? ["host","date","(request-target)","digest","v-c-merchant-id"]
    : ["host","date","(request-target)","v-c-merchant-id"];
  const signingString=[
    "host: "+host,
    "date: "+date,
    "(request-target): "+target,
    ...(hasBody?["digest: "+digest]:[]),
    "v-c-merchant-id: "+MERCHANT_ID
  ].join("\n");
  const signature=await hmacB64(SECRET_KEY,signingString);
  const headers:Record<string,string>={
    "Content-Type":"application/json",
    "v-c-merchant-id":MERCHANT_ID,
    "Date":date,
    "Signature": 'keyid="' + KEY_ID + '", algorithm="HmacSHA256", headers="' + headersList.join(" ") + '", signature="' + signature + '"'
  };
  if(hasBody)headers.Digest=digest;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{
    return await fetch(url,{method,headers,body,signal:controller.signal});
  }catch(e){
    if(e?.name==="AbortError")throw new Error("CyberSource service timed out.");
    throw new Error("CyberSource service is temporarily unavailable.");
  }finally{clearTimeout(timer);}
}
function decodeJwt(token:string){
  const parts=String(token||"").split(".");
  if(parts.length!==3)throw new Error("CyberSource session response was invalid.");
  try{
    return {
      header:JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0]))),
      payload:JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])))
    };
  }catch{throw new Error("CyberSource session response could not be decoded.");}
}
async function currentUser(req:Request){
  const auth=req.headers.get("Authorization");
  if(!auth?.startsWith("Bearer "))throw new Error("Authentication required");
  const client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser();
  if(error||!data.user)throw new Error("Authentication required");
  return data.user;
}
async function ownedOrder(userId:string,orderId:string){
  const {data:customer,error:customerError}=await admin.from("customers").select("id").eq("auth_user_id",userId).maybeSingle();
  if(customerError)throw customerError;
  if(!customer?.id)throw new Error("Customer profile not found");
  const {data:order,error}=await admin.from("orders").select("id,order_number,total,payment_method,payment_status,order_status,customer_id").eq("id",orderId).eq("customer_id",customer.id).maybeSingle();
  if(error)throw error;
  if(!order)throw new Error("Order not found or access denied");
  return order;
}
function sessionJwtFromResponse(data:any){
  const values=[
    data?.jwt,data?.sessionJwt,data?.captureContext,
    data?.data?.jwt,data?.data?.sessionJwt,data?.data?.captureContext,
    typeof data?.data==="string"?data.data:null,
    typeof data==="string"?data:null
  ];
  for(const value of values){
    const token=String(value||"").trim();
    if(token.split(".").length===3)return token;
  }
  throw new Error("CyberSource capture context was not returned.");
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    if(req.method!=="POST")return json({error:"Method not allowed"},405);
    if(!ENABLED)return json({error:"CyberSource online card payment is not enabled yet."},503);
    const user=await currentUser(req);
    const body=await req.json().catch(()=>({}));
    const orderId=String(body?.orderId||"").trim();
    if(!orderId)return json({error:"orderId is required"},400);

    const order=await ownedOrder(user.id,orderId);
    if(String(order.payment_method)!=="online")return json({error:"This order is not configured for online card payment."},400);
    if(String(order.payment_status)==="paid")return json({error:"This order has already been paid."},409);

    if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw new Error("Payment service is not configured.");
    const amount=Number(order.total);
    if(!Number.isFinite(amount)||amount<=0)throw new Error("Invalid order total.");

    const payload={
      targetOrigins:[TARGET_ORIGIN],
      country:COUNTRY,
      locale:LOCALE,
      allowedPaymentTypes:ALLOWED_PAYMENT_TYPES,
      clientReferenceInformation:{code:String(order.order_number)},
      data:{orderInformation:{amountDetails:{currency:CURRENCY,totalAmount:amount.toFixed(2)}}}
    };

    const response=await signedFetch("POST","/uc/v1/sessions",JSON.stringify(payload));
    const responseText=await response.text();
    let data:any={};try{data=JSON.parse(responseText)}catch{data=responseText}
    if(!response.ok){
      console.error("CyberSource session rejected:",response.status);
      throw new Error("CyberSource secure payment session could not be created.");
    }

    const sessionJwt=sessionJwtFromResponse(data);
    const decoded=decodeJwt(sessionJwt);
    const clientLibrary=String(decoded.payload?.clientLibrary||"").trim();
    const clientLibraryIntegrity=String(decoded.payload?.clientLibraryIntegrity||"").trim();
    if(!clientLibrary||!clientLibraryIntegrity)throw new Error("CyberSource payment library details were not returned.");
    if(!/^https:\\/\\//i.test(clientLibrary))throw new Error("CyberSource payment library URL is invalid.");

    return json({sessionJwt,clientLibrary,clientLibraryIntegrity,environment:ENV});
  }catch(e){
    console.error("CyberSource session request failed:",e instanceof Error?e.message:"unknown error");
    return json({error:e instanceof Error?e.message:"Payment session request failed"},400);
  }
});
