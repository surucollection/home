import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://suru.com.np","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!,SUPABASE_ANON_KEY=Deno.env.get("SUPABASE_ANON_KEY")!,SUPABASE_SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FONEPAY_API_BASE=(Deno.env.get("FONEPAY_API_BASE")||"https://uat-new-merchant-api.fonepay.com").replace(/\/$/,""),FONEPAY_USERNAME=Deno.env.get("FONEPAY_USERNAME")||"",FONEPAY_PASSWORD=Deno.env.get("FONEPAY_PASSWORD")||"",FONEPAY_BASIC_AUTH=Deno.env.get("FONEPAY_BASIC_AUTH")||"",FONEPAY_PRIVATE_KEY=Deno.env.get("FONEPAY_PRIVATE_KEY")||"",FONEPAY_TERMINAL_ID=Deno.env.get("FONEPAY_TERMINAL_ID")||"";
const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
function base64(bytes:ArrayBuffer|Uint8Array){const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let s="";for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(s)}
function pemToBytes(pem:string){const b64=pem.replace(/-----BEGIN PRIVATE KEY-----/g,"").replace(/-----END PRIVATE KEY-----/g,"").replace(/\s+/g,"");const bin=atob(b64);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
let signingKeyPromise:Promise<CryptoKey>|null=null;
async function getSigningKey(){if(!FONEPAY_PRIVATE_KEY)throw new Error("FONEPAY_PRIVATE_KEY is not configured");signingKeyPromise ||= crypto.subtle.importKey("pkcs8",pemToBytes(FONEPAY_PRIVATE_KEY),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);return signingKeyPromise}
async function signBody(body:string){const key=await getSigningKey();return base64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(body)))}
async function fonepayFetch(url:string,init:RequestInit){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);try{return await fetch(url,{...init,signal:controller.signal})}catch(e){if(e?.name==="AbortError")throw new Error("Fonepay service timed out");throw new Error("Fonepay service is temporarily unavailable")}finally{clearTimeout(timer)}}
async function getToken(){if(!FONEPAY_USERNAME||!FONEPAY_PASSWORD||!FONEPAY_TERMINAL_ID)throw new Error("Fonepay merchant service is not configured");const loginBody=JSON.stringify({username:FONEPAY_USERNAME,password:FONEPAY_PASSWORD});const signature=await signBody(loginBody);const basic=FONEPAY_BASIC_AUTH||`Basic ${btoa(`${FONEPAY_USERNAME}:${FONEPAY_PASSWORD}`)}`;const response=await fonepayFetch(`${FONEPAY_API_BASE}/api/merchant/merchantDetailsForThirdParty/v2/login`,{method:"POST",headers:{"Authorization":basic,"Signature":signature,"Content-Type":"application/json"},body:loginBody});const text=await response.text();let data:any=null;try{data=JSON.parse(text)}catch{}if(!response.ok||!data?.accessToken)throw new Error(`Fonepay login failed (${response.status})`);return String(data.accessToken).startsWith("Bearer ")?String(data.accessToken):`Bearer ${data.accessToken}`}
async function fonepayRequest(path:string,body:Record<string,unknown>){const token=await getToken();const bodyText=JSON.stringify(body);const signature=await signBody(bodyText);const response=await fonepayFetch(`${FONEPAY_API_BASE}${path}`,{method:"POST",headers:{"Content-Type":"application/json","Signature":signature,"Authorization":token},body:bodyText});const text=await response.text();let data:any=null;try{data=JSON.parse(text)}catch{data={}}if(!response.ok)throw new Error(`Fonepay API failed (${response.status})`);return data}
async function currentUser(req:Request){const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))throw new Error("Authentication required");const client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});const{data,error}=await client.auth.getUser();if(error||!data.user)throw new Error("Authentication required");return data.user}
async function getOwnedOrder(orderId:string,userId:string){const{data:customer,error:customerError}=await admin.from("customers").select("id").eq("auth_user_id",userId).maybeSingle();if(customerError)throw customerError;if(!customer?.id)throw new Error("Customer profile not found");const{data:order,error}=await admin.from("orders").select("id,order_number,total,payment_method,payment_status,order_status,customer_id,fonepay_reference,fonepay_status,fonepay_response,cod_advance_required,cod_advance_paid,cod_balance_due,cod_advance_payment_status,cod_advance_fonepay_reference,cod_advance_fonepay_trace_id,cod_advance_fonepay_response").eq("id",orderId).eq("customer_id",customer.id).maybeSingle();if(error)throw error;if(!order)throw new Error("Order not found or access denied");return order}
function makeReference(){return `SC${crypto.randomUUID().replace(/-/g,"").slice(0,26)}`}
async function createPayment(order:any,purpose:string){
  const{data:claim,error:claimError}=await admin.rpc("claim_fonepay_payment_setup",{p_order_id:order.id,p_purpose:purpose});
  if(claimError)throw claimError;
  if(!claim||typeof claim!=="object")throw new Error("Unable to reserve payment setup");
  const state=String(claim.state||"");
  if(state==="already_paid")return{alreadyPaid:true,purpose,orderId:order.id,orderNumber:order.order_number,amount:Number(claim.amount||0),balanceDue:Number(claim.balance_due||0)};
  if(state==="in_progress")throw new Error("Payment setup is already in progress for this order. Please wait a moment and retry.");
  if(state==="resume"){
    const response=claim.response||{};
    return{orderId:order.id,orderNumber:order.order_number,amount:Number(claim.amount||0),balanceDue:Number(claim.balance_due||0),reference:String(claim.reference),qrString:response.qrString||null,qrMessage:response.qrMessage||null,websocketId:response.websocketId||null,status:response.status||"Success",purpose,resumed:true};
  }
  if(state!=="claimed")throw new Error("Unable to reserve payment setup");
  const reference=String(claim.reference||"");
  const amount=Number(claim.amount);
  if(!reference||!Number.isFinite(amount)||amount<=0)throw new Error("Invalid payment setup");
  if(purpose==="cod_advance"&&String(order.payment_method)!=="cod")throw new Error("This order is not configured for COD");
  if(purpose==="full"&&String(order.payment_method)!=="fonepay")throw new Error("This order is not configured for Fonepay");
  const payload={amount,billId:String(order.order_number),terminalId:FONEPAY_TERMINAL_ID,paymentMode:"QR",referenceLabel:reference,qrType:"INTENT_QR"};
  try{
    const result=await fonepayRequest("/api/merchant/third-party/v2/generate-intent-qr",payload);
    const update=purpose==="cod_advance"
      ?{cod_advance_fonepay_reference:reference,cod_advance_payment_status:"initiated",cod_advance_fonepay_response:result,cod_advance_fonepay_initiated_at:new Date().toISOString(),updated_at:new Date().toISOString()}
      :{fonepay_reference:reference,fonepay_status:"initiated",fonepay_response:result,fonepay_initiated_at:new Date().toISOString(),payment_status:"pending",updated_at:new Date().toISOString()};
    const{error}=await admin.from("orders").update(update).eq("id",order.id);
    if(error)throw error;
    return{orderId:order.id,orderNumber:order.order_number,amount,balanceDue:Number(claim.balance_due||0),reference,qrString:result?.qrString||null,qrMessage:result?.qrMessage||null,websocketId:result?.websocketId||null,status:result?.status||null,purpose};
  }catch(e){
    const failedUpdate=purpose==="cod_advance"
      ?{cod_advance_payment_status:"failed",updated_at:new Date().toISOString()}
      :{fonepay_status:"failed",payment_status:"failed",updated_at:new Date().toISOString()};
    await admin.from("orders").update(failedUpdate).eq("id",order.id).eq(purpose==="cod_advance"?"cod_advance_fonepay_reference":"fonepay_reference",reference);
    throw e;
  }
}
async function checkPayment(order:any,purpose:string){
  const isCodAdvance=purpose==="cod_advance";
  if(isCodAdvance){
    if(String(order.payment_method)!=="cod")throw new Error("This order is not configured for COD");
    const reference=String(order.cod_advance_fonepay_reference||"");if(!reference)throw new Error("COD advance payment has not been initiated");
    const expected=Number(order.cod_advance_required);
    if(String(order.cod_advance_payment_status)==="paid")return{orderId:order.id,orderNumber:order.order_number,paymentStatus:"success",verified:true,purpose,balanceDue:Number(order.cod_balance_due||0),alreadyPaid:true};
    const result=await fonepayRequest("/api/merchant/third-party/v2/thirdPartyDynamicQrGetStatus",{terminalId:FONEPAY_TERMINAL_ID,referenceLabel:reference});
    const upstreamStatus=String(result?.paymentStatus||"pending").toLowerCase(),requested=Number(result?.requestedAmount),paid=Number(result?.totalTransactionAmount),amountOk=Number.isFinite(paid)&&Math.abs(paid-expected)<0.01;
    if(upstreamStatus==="success"&&!amountOk)throw new Error("Fonepay reported a successful COD advance, but the paid amount does not match the required advance. The order was not confirmed.");
    const nextStatus=upstreamStatus==="success"&&amountOk?"paid":upstreamStatus==="failed"?"failed":"initiated";
    const patch:Record<string,unknown>={cod_advance_fonepay_trace_id:result?.fonepayTraceId!=null?String(result.fonepayTraceId):null,cod_advance_fonepay_response:result,updated_at:new Date().toISOString()};
    if(nextStatus==="paid"){patch.cod_advance_paid=expected;patch.cod_balance_due=Math.max(0,Number(order.total)-expected);patch.cod_advance_payment_status="paid";patch.cod_advance_fonepay_paid_at=new Date().toISOString();if(String(order.order_status)==="pending")patch.order_status="confirmed"}
    else if(nextStatus==="failed"&&String(order.cod_advance_payment_status)!=="paid")patch.cod_advance_payment_status="failed";
    else if(String(order.cod_advance_payment_status)!=="paid"&&String(order.cod_advance_payment_status)!=="failed")patch.cod_advance_payment_status="initiated";
    const update=admin.from("orders").update(patch).eq("id",order.id).neq("cod_advance_payment_status","paid");
    const{error}=await update;if(error)throw error;
    return{orderId:order.id,orderNumber:order.order_number,paymentStatus:upstreamStatus,requestedAmount:requested,totalTransactionAmount:paid,traceId:result?.fonepayTraceId??null,paymentMessage:result?.paymentMessage||null,verified:nextStatus==="paid",purpose,balanceDue:nextStatus==="paid"?Math.max(0,Number(order.total)-expected):Number(order.cod_balance_due||0)};
  }
  if(String(order.payment_method)!=="fonepay")throw new Error("This order is not configured for Fonepay");
  if(String(order.payment_status)==="paid")return{orderId:order.id,orderNumber:order.order_number,paymentStatus:"success",verified:true,purpose,alreadyPaid:true};
  if(!order.fonepay_reference)throw new Error("Fonepay payment has not been initiated");
  const result=await fonepayRequest("/api/merchant/third-party/v2/thirdPartyDynamicQrGetStatus",{terminalId:FONEPAY_TERMINAL_ID,referenceLabel:order.fonepay_reference});
  const upstreamStatus=String(result?.paymentStatus||"pending").toLowerCase(),requested=Number(result?.requestedAmount),paid=Number(result?.totalTransactionAmount),expected=Number(order.total),amountOk=Number.isFinite(paid)&&Math.abs(paid-expected)<0.01;
  if(upstreamStatus==="success"&&!amountOk)throw new Error("Fonepay reported a successful payment, but the paid amount does not match the order total. The order was not marked paid.");
  const nextStatus=upstreamStatus==="success"&&amountOk?"paid":upstreamStatus==="failed"?"failed":"initiated";
  const patch:Record<string,unknown>={fonepay_trace_id:result?.fonepayTraceId!=null?String(result.fonepayTraceId):null,fonepay_response:result,updated_at:new Date().toISOString()};
  if(nextStatus==="paid"){patch.payment_status="paid";patch.fonepay_status="success";patch.fonepay_paid_at=new Date().toISOString();if(String(order.order_status)==="pending")patch.order_status="confirmed"}
  else if(nextStatus==="failed"&&String(order.payment_status)!=="paid"){patch.payment_status="failed";patch.fonepay_status="failed"}
  else if(String(order.payment_status)!=="paid"&&String(order.payment_status)!=="failed"){patch.fonepay_status="initiated"}
  const{error}=await admin.from("orders").update(patch).eq("id",order.id).neq("payment_status","paid");if(error)throw error;
  return{orderId:order.id,orderNumber:order.order_number,paymentStatus:upstreamStatus,requestedAmount:requested,totalTransactionAmount:paid,traceId:result?.fonepayTraceId??null,paymentMessage:result?.paymentMessage||null,verified:nextStatus==="paid",purpose};
}
Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});try{if(req.method!=="POST")return json({error:"Method not allowed"},405);const user=await currentUser(req),body=await req.json().catch(()=>({})),action=String(body?.action||""),purpose=String(body?.purpose||"full"),orderId=String(body?.orderId||"").trim();if(!orderId)return json({error:"orderId is required"},400);if(!["full","cod_advance"].includes(purpose))return json({error:"Unsupported payment purpose"},400);const order=await getOwnedOrder(orderId,user.id);if(action==="create")return json(await createPayment(order,purpose));if(action==="status")return json(await checkPayment(order,purpose));return json({error:"Unsupported action"},400)}catch(e){console.error("Fonepay payment request failed:",e instanceof Error?e.message:"unknown error");return json({error:e instanceof Error?e.message:"Payment request failed"},400)}});
