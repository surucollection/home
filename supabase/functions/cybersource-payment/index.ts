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
const BASE=ENV==="production"?"https://api.cybersource.com":"https://apitest.cybersource.com";
const CURRENCY=(Deno.env.get("CYBERSOURCE_CURRENCY")||"NPR").trim();
const TARGET_ORIGIN=(Deno.env.get("CYBERSOURCE_TARGET_ORIGIN")||"https://suru.com.np").trim().replace(/\/$/,"");
const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={
  "Access-Control-Allow-Origin":TARGET_ORIGIN,
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

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
  const url=BASE+path,host=new URL(BASE).host,date=new Date().toUTCString();
  const hasBody=typeof body==="string";
  const digest=hasBody?"SHA-256="+await digestB64(body):"";
  const target=method.toLowerCase()+" "+path;
  const headersList=hasBody?["host","date","(request-target)","digest","v-c-merchant-id"]:["host","date","(request-target)","v-c-merchant-id"];
  const signingString=[
    "host: "+host,"date: "+date,"(request-target): "+target,
    ...(hasBody?["digest: "+digest]:[]),"v-c-merchant-id: "+MERCHANT_ID
  ].join("\n");
  const signature=await hmacB64(SECRET_KEY,signingString);
  const headers:Record<string,string>={
    "Content-Type":"application/json","v-c-merchant-id":MERCHANT_ID,"Date":date,
    "Signature": 'keyid="' + KEY_ID + '", algorithm="HmacSHA256", headers="' + headersList.join(" ") + '", signature="' + signature + '"'
  };
  if(hasBody)headers.Digest=digest;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{return await fetch(url,{method,headers,body,signal:controller.signal})}
  catch(e){if(e?.name==="AbortError")throw new Error("CyberSource service timed out.");throw new Error("CyberSource service is temporarily unavailable.")}
  finally{clearTimeout(timer);}
}
function decodeJwt(token:string){
  const parts=String(token||"").split(".");
  if(parts.length!==3)throw new Error("Invalid transient payment token.");
  try{
    return {
      encodedHeader:parts[0],encodedPayload:parts[1],encodedSignature:parts[2],
      header:JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0]))),
      payload:JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])))
    };
  }catch{throw new Error("Invalid transient payment token.");}
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
  const {data:order,error}=await admin.from("orders").select("id,order_number,total,payment_method,payment_status,order_status,customer_id,customer_email").eq("id",orderId).eq("customer_id",customer.id).maybeSingle();
  if(error)throw error;
  if(!order)throw new Error("Order not found or access denied");
  return order;
}
async function verifyTransientToken(token:string){
  const decoded=decodeJwt(token);
  const alg=String(decoded.header?.alg||"");
  const kid=String(decoded.header?.kid||"");
  const exp=Number(decoded.payload?.exp||0);
  const jti=String(decoded.payload?.jti||"").trim();
  if(alg!=="RS256"||!kid||!jti)throw new Error("CyberSource payment token is invalid.");
  if(!Number.isFinite(exp)||exp<=Math.floor(Date.now()/1000))throw new Error("CyberSource payment token has expired.");

  const keyResponse=await signedFetch("GET","/flex/v2/public-keys/"+encodeURIComponent(kid));
  const keyText=await keyResponse.text();let keyData:any={};try{keyData=JSON.parse(keyText)}catch{}
  if(!keyResponse.ok)throw new Error("CyberSource payment token could not be validated.");
  const jwk=keyData?.keys?.find((x:any)=>x?.kid===kid)||keyData?.key||keyData;
  if(!jwk?.kty)throw new Error("CyberSource payment token public key was not returned.");
  const publicKey=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const signatureOk=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",publicKey,b64urlDecode(decoded.encodedSignature),new TextEncoder().encode(decoded.encodedHeader+"."+decoded.encodedPayload));
  if(!signatureOk)throw new Error("CyberSource payment token signature is invalid.");
  return {...decoded,jti};
}
function nestedAmount(obj:any){
  return Number(obj?.orderInformation?.amountDetails?.totalAmount ?? obj?.orderInformation?.amountDetails?.authorizedAmount ?? obj?.orderInformation?.amountDetails?.requestedAmount);
}
function nestedCurrency(obj:any){
  return String(obj?.orderInformation?.amountDetails?.currency||"").trim();
}
async function getPaymentDetails(jti:string){
  const response=await signedFetch("GET","/flex/v2/payment-details/"+encodeURIComponent(jti));
  const text=await response.text();let data:any={};try{data=JSON.parse(text)}catch{}
  if(!response.ok)throw new Error("CyberSource payment details could not be retrieved.");
  return data;
}
function isSuccess(data:any){
  const status=String(data?.status||"").toUpperCase();
  const decision=String(data?.decision||"").toUpperCase();
  const code=String(data?.processorInformation?.responseCode||"");
  return ["AUTHORIZED","CAPTURED","SETTLED","SUCCESS","SUCCEEDED"].includes(status) || decision==="ACCEPT" || (status==="AUTHORIZED"&&code==="00");
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    if(req.method!=="POST")return json({error:"Method not allowed"},405);
    if(!ENABLED)return json({error:"CyberSource online card payment is not enabled yet."},503);
    const user=await currentUser(req);
    const body=await req.json().catch(()=>({}));
    const orderId=String(body?.orderId||"").trim();
    const token=String(body?.transientToken||"").trim();
    if(!orderId)return json({error:"orderId is required"},400);
    if(!token)return json({error:"transientToken is required"},400);

    const order=await ownedOrder(user.id,orderId);
    if(String(order.payment_method)!=="online")return json({error:"This order is not configured for online card payment."},400);
    if(String(order.payment_status)==="paid"){
      const {data:existing}=await admin.from("payments").select("transaction_id,gateway_reference,amount").eq("order_id",order.id).eq("gateway","cybersource").eq("status","paid").limit(1).maybeSingle();
      return json({verified:true,orderId:order.id,orderNumber:order.order_number,transactionId:existing?.transaction_id||null,gatewayReference:existing?.gateway_reference||null,amount:Number(existing?.amount||order.total),alreadyPaid:true});
    }

    const amount=Number(order.total);
    if(!Number.isFinite(amount)||amount<=0)throw new Error("Invalid order total.");

    const verifiedToken=await verifyTransientToken(token);
    const details=await getPaymentDetails(verifiedToken.jti);
    const detailAmount=nestedAmount(details),detailCurrency=nestedCurrency(details);
    if(!Number.isFinite(detailAmount)||Math.abs(detailAmount-amount)>0.01)throw new Error("The card payment amount does not match the order total. No payment was processed.");
    if(detailCurrency&&detailCurrency!==CURRENCY)throw new Error("The card payment currency does not match the order currency. No payment was processed.");

    const email=String(details?.orderInformation?.billTo?.email||"").trim().toLowerCase();
    const orderEmail=String(order.customer_email||"").trim().toLowerCase();
    if(email&&orderEmail&&email!==orderEmail)throw new Error("The cardholder details do not match the order. No payment was processed.");

    const authBody=JSON.stringify({
      clientReferenceInformation:{code:String(order.order_number)},
      processingInformation:{capture:true,commerceIndicator:"internet"},
      tokenInformation:{transientTokenJwt:token},
      orderInformation:{amountDetails:{totalAmount:amount.toFixed(2),currency:CURRENCY}}
    });
    const response=await signedFetch("POST","/pts/v2/payments",authBody);
    const responseText=await response.text();let result:any={};try{result=JSON.parse(responseText)}catch{}
    const status=String(result?.status||"").toUpperCase();
    if(!response.ok||!isSuccess(result)){
      const declined=status==="DECLINED"||status==="FAILED"||String(result?.decision||"").toUpperCase()==="REJECT";
      if(declined)await admin.from("orders").update({payment_status:"failed",updated_at:new Date().toISOString()}).eq("id",order.id).eq("payment_status","pending");
      return json({verified:false,status:status||"FAILED",error:declined?"Card payment was declined.":"Card payment could not be confirmed by CyberSource."},402);
    }

    const responseAmount=nestedAmount(result);
    const responseCurrency=nestedCurrency(result);
    if(Number.isFinite(responseAmount)&&Math.abs(responseAmount-amount)>0.01)throw new Error("CyberSource confirmed an unexpected payment amount. The order was not marked paid automatically.");
    if(responseCurrency&&responseCurrency!==CURRENCY)throw new Error("CyberSource confirmed an unexpected payment currency. The order was not marked paid automatically.");

    const transactionId=String(result?.id||result?.transactionId||verifiedToken.jti);
    const gatewayReference=String(result?.reconciliationId||result?.processorInformation?.transactionId||verifiedToken.jti);
    const paidAt=new Date().toISOString();

    const {data:existingPayment,error:existingError}=await admin.from("payments").select("id,transaction_id,gateway_reference,amount,status").eq("order_id",order.id).eq("gateway","cybersource").or("transaction_id.eq."+transactionId+",gateway_reference.eq."+gatewayReference).limit(1).maybeSingle();
    if(existingError)throw existingError;
    if(existingPayment?.status==="paid"){
      await admin.from("orders").update({payment_status:"paid",order_status:String(order.order_status)==="pending"?"confirmed":order.order_status,updated_at:paidAt}).eq("id",order.id);
      return json({verified:true,orderId:order.id,orderNumber:order.order_number,transactionId:existingPayment.transaction_id,gatewayReference:existingPayment.gateway_reference,amount:Number(existingPayment.amount)});
    }

    const {error:paymentInsertError}=await admin.from("payments").insert({
      order_id:order.id,gateway:"cybersource",transaction_id:transactionId,gateway_reference:gatewayReference,
      amount,status:"paid",raw_response:result,created_at:paidAt,updated_at:paidAt
    });
    if(paymentInsertError){
      const {data:recovered}=await admin.from("payments").select("id,transaction_id,gateway_reference,amount,status").eq("order_id",order.id).eq("gateway","cybersource").eq("status","paid").limit(1).maybeSingle();
      if(!recovered)throw new Error("CyberSource payment was confirmed, but the local payment record could not be saved. Do not retry the card payment; contact Suru Collection.");
    }

    const {error:orderUpdateError}=await admin.from("orders").update({
      payment_status:"paid",
      order_status:String(order.order_status)==="pending"?"confirmed":order.order_status,
      updated_at:paidAt
    }).eq("id",order.id).eq("payment_status","pending");
    if(orderUpdateError)throw orderUpdateError;

    return json({verified:true,orderId:order.id,orderNumber:order.order_number,transactionId,gatewayReference,amount});
  }catch(e){
    console.error("CyberSource payment request failed:",e instanceof Error?e.message:"unknown error");
    return json({error:e instanceof Error?e.message:"Card payment request failed"},400);
  }
});
