import React,{useEffect,useRef,useState} from "react";
import { createCyberSourceSession, loadCyberSourceLibrary } from "../lib/cybersource.js";
import { supabase } from "../lib/api.js";

function CyberSourceCheckout({orderId,onSuccess,onError}) {
  const [status,setStatus]=useState("loading");
  const [message,setMessage]=useState("");
  const [attempt,setAttempt]=useState(0);
  const onSuccessRef=useRef(onSuccess);
  const onErrorRef=useRef(onError);
  const paymentSelectionId=useRef("suru-cybersource-payment-selection");
  const paymentScreenId=useRef("suru-cybersource-payment-screen");

  useEffect(()=>{onSuccessRef.current=onSuccess},[onSuccess]);
  useEffect(()=>{onErrorRef.current=onError},[onError]);

  useEffect(()=>{
    let cancelled=false;
    let client=null;
    let checkout=null;

    (async()=>{
      try{
        setStatus("loading");
        setMessage("");

        const session=await createCyberSourceSession(orderId);
        await loadCyberSourceLibrary(session.clientLibrary,session.clientLibraryIntegrity);
        if(cancelled)return;
        if(!window.VAS?.UnifiedCheckout)throw new Error("CyberSource secure checkout library is unavailable.");

        client=await window.VAS.UnifiedCheckout(session.sessionJwt);
        if(cancelled)return;

        client.on?.("error",err=>{
          if(cancelled)return;
          const text=err?.message||err?.reason||"CyberSource reported a payment error.";
          setMessage(String(text));
        });

        checkout=await client.createCheckout({autoProcessing:false});
        if(cancelled)return;

        checkout.on?.("error",err=>{
          if(cancelled)return;
          const text=err?.message||err?.reason||"The secure card payment form reported an error.";
          setMessage(String(text));
        });

        setStatus("ready");
        const token=await checkout.mount({
          paymentSelection:"#"+paymentSelectionId.current,
          paymentScreen:"#"+paymentScreenId.current
        });
        if(cancelled)return;

        if(!token||typeof token!=="string"){
          throw new Error("CyberSource did not return a secure payment token.");
        }

        setStatus("processing");
        const {data,error}=await supabase.functions.invoke("cybersource-payment",{
          body:{orderId:String(orderId),transientToken:token}
        });
        if(error)throw error;
        if(data?.error)throw new Error(String(data.error));
        if(!data?.verified)throw new Error("Card payment was not confirmed.");

        setStatus("success");
        onSuccessRef.current?.(data);
      }catch(error){
        if(cancelled)return;
        const text=error?.message||"Card payment could not be completed.";
        setMessage(String(text));
        setStatus("error");
        onErrorRef.current?.(error);
      }finally{
        try{checkout?.destroy?.()}catch{}
        try{client?.destroy?.()}catch{}
      }
    })();

    return()=>{
      cancelled=true;
      try{checkout?.destroy?.()}catch{}
      try{client?.destroy?.()}catch{}
    };
  },[orderId,attempt]);

  return <div className="cybersource-box" style={{marginTop:16,padding:18,border:"1px solid #e6dfd4",borderRadius:14,background:"#fff"}}>
    <div style={{marginBottom:14}}>
      <h3 style={{margin:"0 0 6px"}}>Secure Card Payment</h3>
      <p className="small-note" style={{margin:0}}>
        Your card details are entered securely in CyberSource's hosted payment form. Suru Collection does not receive or store your full card number.
      </p>
    </div>

    <div id={paymentSelectionId.current} aria-label="Secure card payment options" style={{minHeight:48}}/>
    <div id={paymentScreenId.current} aria-label="Secure card payment form" style={{marginTop:12}}/>

    {status==="loading"&&<p className="small-note" role="status">Preparing secure card payment…</p>}
    {status==="ready"&&<p className="small-note" role="status">Enter your card details in the secure payment form above.</p>}
    {status==="processing"&&<p className="small-note" role="status">Processing your card payment. Please do not close this page…</p>}
    {status==="success"&&<p className="small-note" role="status">Payment confirmed.</p>}
    {status==="error"&&<div style={{marginTop:12}}>
      <p className="small-note" role="alert">{message||"Card payment could not be completed."}</p>
      <button className="secondary" type="button" onClick={()=>{setMessage("");setAttempt(v=>v+1)}}>Retry Secure Card Payment</button>
    </div>}
  </div>;
}

export default CyberSourceCheckout;
