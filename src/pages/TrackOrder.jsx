import React,{useCallback,useEffect,useState} from "react";
import { KEY } from "../lib/api.js";

const SUPABASE_URL="https://vkycraymxhkqxgpcpdzw.supabase.co";
const money=value=>"NPR "+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const label=value=>String(value||"").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());

export default function TrackOrder(){
  const orderNumber=decodeURIComponent(location.pathname.replace(/^\/track\//,"").replace(/\/+$/,"")).trim();
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[refreshedAt,setRefreshedAt]=useState(null);
  const load=useCallback(async()=>{
    if(!orderNumber){setError("The tracking link is missing its order number.");setLoading(false);return}
    setLoading(true);setError("");
    try{
      const response=await fetch(SUPABASE_URL+"/functions/v1/public-order-tracking?order_number="+encodeURIComponent(orderNumber),{headers:{apikey:KEY,Accept:"application/json"}});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.error)throw new Error(result.error||"Unable to load this order. Please check the tracking link.");
      setData(result);setRefreshedAt(new Date());
    }catch(e){setError(e?.message||"Unable to load tracking details. Please try again.");}
    finally{setLoading(false)}
  },[orderNumber]);
  useEffect(()=>{load()},[load]);
  return <main style={{minHeight:"100vh",background:"#f8f5f2",padding:"28px 16px 48px",color:"#28201c",fontFamily:"inherit"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <a href="/" style={{display:"inline-block",marginBottom:22,color:"#5e463d",textDecoration:"none",fontWeight:700}}>← Suru Collection</a>
      <section style={{background:"#fff",border:"1px solid #eadfd8",borderRadius:18,padding:"clamp(20px,4vw,34px)",boxShadow:"0 8px 28px rgba(55,36,25,.05)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
          <div><p style={{margin:"0 0 7px",fontSize:12,letterSpacing:".12em",fontWeight:800,color:"#8b6b5c"}}>SURU COLLECTION</p><h1 style={{fontSize:"clamp(25px,5vw,34px)",margin:"0 0 8px"}}>Track your order</h1><p style={{margin:0,color:"#6f625b"}}>Order number: <strong>{orderNumber||"—"}</strong></p></div>
          <button type="button" onClick={load} disabled={loading} style={{border:"1px solid #d8c8bd",background:"#fff",borderRadius:9,padding:"10px 14px",fontWeight:700,cursor:loading?"wait":"pointer"}}>{loading?"Refreshing…":"↻ Refresh status"}</button>
        </div>
        {loading&&!data&&<p style={{padding:"24px 0",color:"#6f625b"}}>Loading order details and courier status…</p>}
        {error&&<div role="alert" style={{marginTop:22,padding:14,background:"#fff2f0",border:"1px solid #f0c8c2",borderRadius:10,color:"#8d2921"}}>{error}</div>}
        {data&&<>
          <div style={{marginTop:24,padding:18,borderRadius:12,background:"#faf5f1",border:"1px solid #eee1d8"}}>
            <div style={{fontSize:12,color:"#77665d",fontWeight:700,marginBottom:6}}>CURRENT ORDER STATUS</div>
            <div style={{fontSize:22,fontWeight:800}}>{label(data.order_status)||"Order received"}</div>
            <div style={{fontSize:13,color:"#6f625b",marginTop:5}}>Payment: {label(data.payment_status)||"Pending"}{data.payment_method?" · "+label(data.payment_method):""}</div>
          </div>
          <div style={{marginTop:24}}>
            <h2 style={{fontSize:18,margin:"0 0 12px"}}>Items ordered</h2>
            {data.items?.length?<div style={{border:"1px solid #eee4de",borderRadius:10,overflow:"hidden"}}>{data.items.map((item,index)=><div key={index} style={{display:"flex",justifyContent:"space-between",gap:16,padding:"13px 14px",borderBottom:index===data.items.length-1?"0":"1px solid #eee4de"}}><div><strong>{item.product_name||"Item"}</strong><div style={{fontSize:13,color:"#786960",marginTop:4}}>{[item.product_code,item.size,item.color].filter(Boolean).join(" · ")}{item.quantity?" · Qty "+item.quantity:""}</div></div></div>)}</div>:<p style={{color:"#6f625b"}}>Item details are not available for this order.</p>}
            <div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"15px 2px",fontSize:17,fontWeight:800}}><span>Order total</span><span>{money(data.total)}</span></div>
          </div>
          <div style={{marginTop:8,borderTop:"1px solid #eee4de",paddingTop:22}}>
            <h2 style={{fontSize:18,margin:"0 0 12px"}}>Courier tracking</h2>
            {data.ncm_order_id?<div style={{padding:15,border:"1px solid #eee4de",borderRadius:10}}>
              <div style={{fontWeight:800,fontSize:17}}>{data.ncm_status||"Shipment created"}</div>
              <div style={{fontSize:13,color:"#6f625b",marginTop:5}}>NCM shipment ID: {data.ncm_order_id}{data.ncm_tracking_id?" · Tracking ID: "+data.ncm_tracking_id:""}</div>
              {data.status_history?.length?<div style={{marginTop:14,display:"grid",gap:12}}>{data.status_history.map((status,index)=><div key={index} style={{display:"grid",gridTemplateColumns:"12px 1fr",gap:10}}><span style={{width:9,height:9,borderRadius:20,background:index===data.status_history.length-1?"#6d4c41":"#c8b7ad",marginTop:5}}/><div><strong>{status.status||status.event||"Status updated"}</strong>{(status.added_time||status.addedTime||status.timestamp)&&<div style={{fontSize:12,color:"#77665d",marginTop:3}}>{new Date(status.added_time||status.addedTime||status.timestamp).toLocaleString()}</div>}</div></div>)}</div>:<p style={{margin:"12px 0 0",fontSize:13,color:"#6f625b"}}>No additional courier history is available yet.</p>}
            </div>:<p style={{padding:15,background:"#faf5f1",borderRadius:10,color:"#6f625b"}}>Your order has not been handed to the courier yet. Please check again later.</p>}
          </div>
          <p style={{fontSize:12,color:"#8b7b72",margin:"20px 0 0"}}>Status last checked {refreshedAt?refreshedAt.toLocaleString():"just now"}. Refresh this page to check the latest available courier update.</p>
        </>}
      </section>
      <p style={{textAlign:"center",fontSize:12,color:"#8b7b72",marginTop:18}}>Need help? Contact Suru Collection through the official website.</p>
    </div>
  </main>
}
