import React,{useCallback,useEffect,useState} from "react";
import { KEY } from "../lib/api.js";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";

const SUPABASE_URL="https://vkycraymxhkqxgpcpdzw.supabase.co";
const money=value=>"NPR "+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const label=value=>String(value||"").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const fullAddress=data=>[data?.shipping_address,[data?.city,data?.district,data?.province].filter(Boolean).join(", "),data?.postal_code? "Postal code: "+data.postal_code:""].filter(Boolean).join("\n");

export default function TrackOrder(){
  const params=new URLSearchParams(location.search);
  const trackPath=location.pathname.replace(/\/+$/,"");
  const pathOrder=trackPath.startsWith("/track/")?decodeURIComponent(trackPath.slice("/track/".length)):"";
  const orderNumber=(params.get("order")||pathOrder).trim();
  const [orderInput,setOrderInput]=useState(orderNumber);
  const [data,setData]=useState(null),[loading,setLoading]=useState(!!orderNumber),[error,setError]=useState(""),[refreshedAt,setRefreshedAt]=useState(null);
  const load=useCallback(async()=>{
    if(!orderNumber){setData(null);setError("");setLoading(false);return}
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
  return <><Header/><main style={{minHeight:"70vh",background:"#f8f5f2",padding:"28px 16px 48px",color:"#28201c",fontFamily:"inherit"}}>
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <button type="button" onClick={()=>{if(window.history.length>1)window.history.back();else location.href="/orders.html"}} style={{display:"inline-block",marginBottom:22,color:"#5e463d",textDecoration:"none",fontWeight:700,background:"transparent",border:0,padding:0,fontSize:16,cursor:"pointer"}}>← Back</button>
      <section style={{background:"#fff",border:"1px solid #eadfd8",borderRadius:18,padding:"clamp(20px,4vw,34px)",boxShadow:"0 8px 28px rgba(55,36,25,.05)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
          <div><p style={{margin:"0 0 7px",fontSize:12,letterSpacing:".12em",fontWeight:800,color:"#8b6b5c"}}>SURU COLLECTION</p><h1 style={{fontSize:"clamp(25px,5vw,34px)",margin:"0 0 8px"}}>Track your order</h1><p style={{margin:0,color:"#6f625b"}}>Order number: <strong>{orderNumber||"—"}</strong></p></div>
          {orderNumber&&<button type="button" onClick={load} disabled={loading} style={{border:"1px solid #d8c8bd",background:"#fff",borderRadius:9,padding:"10px 14px",fontWeight:700,cursor:loading?"wait":"pointer"}}>{loading?"Refreshing…":"↻ Refresh status"}</button>}
        </div>
        {!orderNumber&&<form onSubmit={e=>{e.preventDefault();const value=orderInput.trim();if(value)location.href="/track.html?order="+encodeURIComponent(value)}} style={{marginTop:24,display:"grid",gap:12}}><label htmlFor="track-order-number" style={{fontWeight:700}}>Enter your order number</label><input id="track-order-number" value={orderInput} onChange={e=>setOrderInput(e.target.value)} placeholder="e.g. SC-20261014-XXXXX" required style={{width:"100%",boxSizing:"border-box",padding:"14px 12px",border:"1px solid #d8c8bd",borderRadius:9,fontSize:16}}/><button type="submit" style={{border:0,background:"#5e463d",color:"#fff",borderRadius:9,padding:"13px 16px",fontSize:15,fontWeight:800,cursor:"pointer"}}>Track order</button><p style={{margin:0,fontSize:13,color:"#6f625b"}}>You can find your order number in your order confirmation message.</p></form>}
        {loading&&!data&&<p style={{padding:"24px 0",color:"#6f625b"}}>Loading order details and courier status…</p>}
        {error&&<div role="alert" style={{marginTop:22,padding:14,background:"#fff2f0",border:"1px solid #f0c8c2",borderRadius:10,color:"#8d2921"}}>{error}</div>}
        {data&&<>
          <div style={{marginTop:24,padding:18,borderRadius:12,background:"#faf5f1",border:"1px solid #eee1d8"}}>
            <div style={{fontSize:12,color:"#77665d",fontWeight:700,marginBottom:6}}>CURRENT ORDER STATUS</div>
            <div style={{fontSize:22,fontWeight:800}}>{label(data.order_status)||"Order received"}</div>
            <div style={{fontSize:13,color:"#6f625b",marginTop:5}}>Payment: {label(data.payment_status)||"Pending"}{data.payment_method?" · "+label(data.payment_method):""}</div>
          </div>
          {data.customer_phone_masked&&<div style={{marginTop:20,padding:16,border:"1px solid #eee4de",borderRadius:10}}><h2 style={{fontSize:16,margin:"0 0 8px"}}>Customer mobile number</h2><p style={{margin:0,lineHeight:1.6}}>{data.customer_phone_masked}</p></div>}
          {fullAddress(data)&&<div style={{marginTop:20,padding:16,border:"1px solid #eee4de",borderRadius:10}}><h2 style={{fontSize:16,margin:"0 0 8px"}}>Delivery address</h2><p style={{margin:0,lineHeight:1.6,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{fullAddress(data)}</p></div>}
          <div style={{marginTop:24}}>
            <h2 style={{fontSize:18,margin:"0 0 12px"}}>Items ordered</h2>
            {data.items?.length?<div style={{border:"1px solid #eee4de",borderRadius:10,overflow:"hidden"}}>{data.items.map((item,index)=><div key={index} style={{display:"flex",justifyContent:"space-between",gap:16,padding:"13px 14px",borderBottom:index===data.items.length-1?"0":"1px solid #eee4de"}}><div><strong>{item.product_name||"Item"}</strong><div style={{fontSize:13,color:"#786960",marginTop:4}}>{[item.product_code,item.size,item.color].filter(Boolean).join(" · ")}{item.quantity?" · Qty "+item.quantity:""}</div></div></div>)}</div>:<p style={{color:"#6f625b"}}>Item details are not available for this order.</p>}
            <div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"15px 2px",fontSize:17,fontWeight:800}}><span>Order total</span><span>{money(data.total)}</span></div>
          </div>
          <div style={{marginTop:8,borderTop:"1px solid #eee4de",paddingTop:22}}>
            <h2 style={{fontSize:18,margin:"0 0 12px"}}>Courier tracking</h2>
            {data.ncm_order_id?<div style={{padding:15,border:"1px solid #eee4de",borderRadius:10}}>
              <div style={{fontWeight:800,fontSize:17}}>{data.ncm_status||"Shipment created"}</div>
              <div style={{fontSize:13,color:"#6f625b",marginTop:5}}>NCM shipment ID: {data.ncm_order_id}</div>
              {data.ncm_tracking_id&&<div style={{marginTop:14,padding:12,background:"#faf5f1",borderRadius:9}}><div style={{fontSize:13,fontWeight:700,marginBottom:7}}>NCM tracking number</div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><code style={{fontSize:15,fontWeight:800,overflowWrap:"anywhere"}}>{data.ncm_tracking_id}</code><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(String(data.ncm_tracking_id));alert("Tracking number copied.")}catch{window.prompt("Copy this NCM tracking number:",String(data.ncm_tracking_id))}}} style={{border:"1px solid #d8c8bd",background:"#fff",borderRadius:8,padding:"8px 11px",fontWeight:700,cursor:"pointer"}}>Copy number</button></div><a href="https://portal.nepalcanmove.com/track/" target="_blank" rel="noopener noreferrer" style={{display:"inline-block",marginTop:12,background:"#5e463d",color:"#fff",textDecoration:"none",borderRadius:8,padding:"10px 13px",fontWeight:800}}>Track on NCM website ↗</a></div>}
              {data.status_history?.length?<div style={{marginTop:14,display:"grid",gap:12}}>{data.status_history.map((status,index)=><div key={index} style={{display:"grid",gridTemplateColumns:"12px 1fr",gap:10}}><span style={{width:9,height:9,borderRadius:20,background:index===data.status_history.length-1?"#6d4c41":"#c8b7ad",marginTop:5}}/><div><strong>{status.status||status.event||"Status updated"}</strong>{(status.added_time||status.addedTime||status.timestamp)&&<div style={{fontSize:12,color:"#77665d",marginTop:3}}>{new Date(status.added_time||status.addedTime||status.timestamp).toLocaleString()}</div>}</div></div>)}</div>:<p style={{margin:"12px 0 0",fontSize:13,color:"#6f625b"}}>No additional courier history is available yet.</p>}
            </div>:<p style={{padding:15,background:"#faf5f1",borderRadius:10,color:"#6f625b"}}>Your order has not been handed to the courier yet. Please check again later.</p>}
          </div>
          <p style={{fontSize:12,color:"#8b7b72",margin:"20px 0 0"}}>Status last checked {refreshedAt?refreshedAt.toLocaleString():"just now"}. Refresh this page to check the latest available courier update.</p>
        </>}
      </section>
      <p style={{textAlign:"center",fontSize:12,color:"#8b7b72",marginTop:18}}>Need help? Contact Suru Collection through the official website.</p>
    </div>
  </main><Footer/></>
}
