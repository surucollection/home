import React,{useCallback,useEffect,useState} from "react";
import { KEY } from "../lib/api.js";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";

const SUPABASE_URL="https://vkycraymxhkqxgpcpdzw.supabase.co";
const money=value=>"NPR "+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const label=value=>String(value||"").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const fullAddress=data=>[data?.shipping_address,[data?.city,data?.district,data?.province].filter(Boolean).join(", "),data?.postal_code? "Postal code: "+data.postal_code:""].filter(Boolean).join("\n");
const trackingUrl=number=>typeof window!=="undefined"?"https://suru.com.np/track/"+encodeURIComponent(number):"";
const orderMessage=data=>{
  const lines=["*Suru Collection — Order Details*","Order: "+(data.order_number||""),"Customer: "+(data.customer_name||"Customer"),"Order status: "+(label(data.order_status)||"Order received"),"Payment: "+(label(data.payment_status)||"Pending")+(data.payment_method?" ("+label(data.payment_method)+")":"")];
  if(fullAddress(data))lines.push("Delivery address: "+fullAddress(data).replace(/\n/g,", "));
  lines.push("","*Items*");
  (data.items||[]).forEach(item=>lines.push("• "+(item.product_name||"Item")+(item.product_code?" ["+item.product_code+"]":"")+(item.size?" · Size "+item.size:"")+(item.color?" · "+item.color:"")+" × "+(item.quantity||1)));
  lines.push("","Total amount: "+money(data.total));
  if(String(data.payment_method||"").toLowerCase()==="cod"){
    lines.push("Advance paid: "+money(data.cod_advance_paid),"Remaining COD due on delivery: "+money(data.cod_balance_due));
  }else if(Number(data.cod_advance_paid||0)>0){
    lines.push("Advance paid: "+money(data.cod_advance_paid));
  }
  if(data.ncm_tracking_id)lines.push("NCM tracking number: "+data.ncm_tracking_id);
  if(data.ncm_status)lines.push("Courier status: "+data.ncm_status);
  lines.push("Track order: "+trackingUrl(data.order_number),"Thank you for shopping with Suru Collection!");
  return lines.join("\n");
};

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
            <div style={{marginTop:12,padding:14,background:"#faf5f1",border:"1px solid #eee1d8",borderRadius:10,display:"grid",gap:10}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12}}><span>Subtotal</span><strong>{money(data.subtotal)}</strong></div>
              {Number(data.discount_amount||0)>0&&<div style={{display:"flex",justifyContent:"space-between",gap:12}}><span>Discount</span><strong>−{money(data.discount_amount)}</strong></div>}
              {Number(data.shipping_fee||0)>0&&<div style={{display:"flex",justifyContent:"space-between",gap:12}}><span>Delivery charge</span><strong>{money(data.shipping_fee)}</strong></div>}
              <div style={{display:"flex",justifyContent:"space-between",gap:12,paddingTop:9,borderTop:"1px solid #e5d6cc",fontSize:17,fontWeight:800}}><span>Total amount</span><span>{money(data.total)}</span></div>
              {String(data.payment_method||"").toLowerCase()==="cod"&&<><div style={{display:"flex",justifyContent:"space-between",gap:12}}><span>Advance paid</span><strong>{money(data.cod_advance_paid)}</strong></div><div style={{display:"flex",justifyContent:"space-between",gap:12,color:"#8b3e2f",fontWeight:800}}><span>COD due on delivery</span><span>{money(data.cod_balance_due)}</span></div></>}
            </div>
            <button type="button" onClick={async()=>{const message=orderMessage(data);try{await navigator.clipboard.writeText(message);alert("Order details copied. You can paste them into WhatsApp.")}catch{window.prompt("Copy order details:",message)}}} style={{marginTop:12,width:"100%",border:0,background:"#5e463d",color:"#fff",borderRadius:9,padding:"12px 16px",fontSize:15,fontWeight:800,cursor:"pointer"}}>Copy order details</button>
          </div>
          <div style={{marginTop:8,borderTop:"1px solid #eee4de",paddingTop:22}}>
            <h2 style={{fontSize:18,margin:"0 0 12px"}}>Courier tracking</h2>
            {data.ncm_order_id?<div style={{padding:15,border:"1px solid #eee4de",borderRadius:10}}>
              <div style={{fontWeight:800,fontSize:17}}>{data.ncm_status||"Shipment created"}</div>
              <div style={{fontSize:13,color:"#6f625b",marginTop:5}}>NCM shipment ID: {data.ncm_order_id}</div>
              {data.ncm_destination_branch&&<div style={{marginTop:14,padding:12,background:"#faf5f1",borderRadius:9}}><div style={{fontSize:13,fontWeight:700,marginBottom:6}}>Destination NCM branch</div><div style={{fontWeight:700}}>{data.ncm_destination_branch}</div>{data.ncm_destination_branch_phone?<div style={{marginTop:6,fontSize:14}}>Contact: <a href={"tel:"+String(data.ncm_destination_branch_phone).replace(/[^+\d]/g,"")} style={{color:"#5e463d",fontWeight:800}}>{data.ncm_destination_branch_phone}</a></div>:<div style={{marginTop:6,fontSize:12,color:"#6f625b"}}>Branch contact number is not available from NCM.</div>}</div>}
              {data.ncm_tracking_id&&<div style={{marginTop:14,padding:12,background:"#faf5f1",borderRadius:9}}><div style={{fontSize:13,fontWeight:700,marginBottom:7}}>NCM tracking number</div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><code style={{fontSize:15,fontWeight:800,overflowWrap:"anywhere"}}>{data.ncm_tracking_id}</code><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(String(data.ncm_tracking_id));alert("Tracking number copied.")}catch{window.prompt("Copy this NCM tracking number:",String(data.ncm_tracking_id))}}} style={{border:"1px solid #d8c8bd",background:"#fff",borderRadius:8,padding:"8px 11px",fontWeight:700,cursor:"pointer"}}>Copy number</button></div></div>}
              {data.status_history?.length?<div style={{marginTop:14,display:"grid",gap:12}}>{data.status_history.map((status,index)=><div key={index} style={{display:"grid",gridTemplateColumns:"12px 1fr",gap:10}}><span style={{width:9,height:9,borderRadius:20,background:index===data.status_history.length-1?"#6d4c41":"#c8b7ad",marginTop:5}}/><div><strong>{status.status||status.event||"Status updated"}</strong>{(status.added_time||status.addedTime||status.timestamp)&&<div style={{fontSize:12,color:"#77665d",marginTop:3}}>{new Date(status.added_time||status.addedTime||status.timestamp).toLocaleString()}</div>}</div></div>)}</div>:<p style={{margin:"12px 0 0",fontSize:13,color:"#6f625b"}}>No additional courier history is available yet.</p>}
            </div>:<p style={{padding:15,background:"#faf5f1",borderRadius:10,color:"#6f625b"}}>Your order has not been handed to the courier yet. Please check again later.</p>}
          </div>
          {data.exchanges?.length>0&&<section style={{marginTop:24,padding:16,border:"1px solid #e6d8cf",borderRadius:12,background:"#fff"}}><h2 style={{fontSize:18,margin:"0 0 14px"}}>Exchange & return tracking</h2>{data.exchanges.map((ex,index)=><div key={index} style={{display:"grid",gap:12}}><div style={{padding:13,background:"#faf5f1",borderRadius:9}}><h3 style={{fontSize:15,margin:"0 0 8px"}}>Exchange shipment (item sent to you)</h3><div style={{fontSize:13,marginBottom:5}}>NCM order: {ex.exchange_ncm_order_id||"Not created yet"}</div><div style={{fontWeight:800}}>{ex.exchange_ncm_status||"Awaiting NCM status"}</div>{ex.exchange_ncm_tracking_id&&<div style={{marginTop:7}}>Tracking number: <strong>{ex.exchange_ncm_tracking_id}</strong></div>}</div><div style={{padding:13,background:"#faf5f1",borderRadius:9}}><h3 style={{fontSize:15,margin:"0 0 8px"}}>Return shipment (item collected from you)</h3><div style={{fontSize:13,marginBottom:5}}>NCM order: {ex.return_ncm_order_id||"Not created yet"}</div><div style={{fontWeight:800}}>{ex.return_ncm_status||"Awaiting NCM status"}</div>{ex.return_ncm_tracking_id&&<div style={{marginTop:7}}>Tracking number: <strong>{ex.return_ncm_tracking_id}</strong></div>}</div></div>)}</section>}
          <p style={{fontSize:12,color:"#8b7b72",margin:"20px 0 0"}}>Status last checked {refreshedAt?refreshedAt.toLocaleString():"just now"}. Refresh this page to check the latest available courier update.</p>
        </>}
      </section>
      <p style={{textAlign:"center",fontSize:12,color:"#8b7b72",marginTop:18}}>Need help? Contact Suru Collection through the official website.</p>
    </div>
  </main><Footer/></>
}
