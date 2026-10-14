import React,{useState,useEffect,useRef} from "react";
import { money,supabase } from "../../lib/api.js";
import QRCode from "qrcode";
import AdminEditOrderModal from "./AdminEditOrderModal.jsx";

const ADMIN_INVOICE_ACTIONS_VERSION="2026.09.29.5";

export default function OrderTable({trackingUrl,rows,onStatus,onNcm,onNcmRate,onNcmSync,onCancellation,onNcmAction,onInvoice,onCancelInvoice,onCreateShipment,onManualPayment,onSelfDelivery,onReturnOrder,onEditOrder,compact=false}){
  const [busy,setBusy]=useState("");
  const [editingOrder,setEditingOrder]=useState(null);
  const [resultModal,setResultModal]=useState(null);
  const [paymentOrder,setPaymentOrder]=useState(null);
  const [trackingPopup,setTrackingPopup]=useState("");
  const [paymentMethod,setPaymentMethod]=useState("cash");
  const [paymentReference,setPaymentReference]=useState("");
  const [paymentNote,setPaymentNote]=useState("");
  const [paymentAmount,setPaymentAmount]=useState("");
  const [paymentSaving,setPaymentSaving]=useState(false);
  const [fonepayOrder,setFonepayOrder]=useState(null);
  const [fonepayQr,setFonepayQr]=useState(null);
  const [fonepayLoading,setFonepayLoading]=useState(false);
  const [fonepayError,setFonepayError]=useState("");
  const [ncmCancelled,setNcmCancelled]=useState({});
  const [returnWindowClock,setReturnWindowClock]=useState(Date.now());
  const ncmCommentChecks=useRef({});

  useEffect(()=>{const timer=setInterval(()=>setReturnWindowClock(Date.now()),60000);return()=>clearInterval(timer)},[]);

  useEffect(()=>{
    let active=true;
    const check=async()=>{
      const candidates=(rows||[]).filter(o=>!compact&&o.order_status==="cancelled"&&o.ncm_order_id&&onNcmAction&&!ncmCommentChecks.current[o.id+":"+o.ncm_order_id]);
      if(!candidates.length)return;
      const found={};
      await Promise.all(candidates.map(async o=>{
        const checkKey=o.id+":"+o.ncm_order_id;
        try{
          const data=await onNcmAction(o,"comments",{silent:true});
          const collectText=value=>{
            if(value===null||value===undefined)return "";
            if(typeof value==="string"||typeof value==="number"||typeof value==="boolean")return String(value);
            if(Array.isArray(value))return value.map(collectText).join(" ");
            if(typeof value==="object")return Object.entries(value).map(([k,v])=>k+" "+collectText(v)).join(" ");
            return "";
          };
          const text=collectText(data).toLowerCase();
          const completedCancel=/(\bcancelled\b|\bcanceled\b|cancellation\\s+(?:is\\s+)?confirmed|successfully\\s+(?:cancelled|canceled)|shipment\\s+(?:is\\s+)?(?:cancelled|canceled)|order\\s+(?:is\\s+)?(?:cancelled|canceled)|vendor\\s+(?:has\\s+)?cancelled)/i.test(text);
          if(completedCancel)found[o.id]=String(o.ncm_order_id);
          ncmCommentChecks.current[checkKey]=true;
        }catch{
          delete ncmCommentChecks.current[checkKey];
        }
      }));
      if(active&&Object.keys(found).length)setNcmCancelled(prev=>({...prev,...found}));
    };
    check();
    return()=>{active=false};
  },[rows,compact,onNcmAction,ncmCancelled]);

  const isNcmCancelled=o=>ncmCancelled[o.id]===String(o.ncm_order_id)||/(cancelled|canceled)/i.test(String(o.ncm_status||"").trim());
  const codAdvancePaid=o=>String(o.payment_method||"").toLowerCase()==="cod"&&Number(o.cod_advance_required||0)>0&&Number(o.cod_advance_paid||0)>=Number(o.cod_advance_required||0);
  const manualPaymentDue=o=>Math.max(0,Number(o.total||0)-(String(o.payment_method||"").toLowerCase()==="cod"?Number(o.cod_advance_paid||0):0)-Number(o.manual_payment_amount||0));
  const canReturnOrder=o=>{
    if(String(o?.order_status||"").toLowerCase()!=="delivered")return false;
    const deliveredAt=o?.delivered_at?new Date(o.delivered_at).getTime():NaN;
    // Hide the return action if the delivery timestamp is missing or the 48-hour window has elapsed.
    return Number.isFinite(deliveredAt)&&deliveredAt>0&&returnWindowClock<deliveredAt+48*60*60*1000;
  };
  const allowedOrderStatuses=o=>{
    const current=String(o.order_status||"").toLowerCase();
    if(current==="delivered")return ["delivered"];
    if(current==="returned")return ["returned"];
    if(current==="cancelled")return ["cancelled"];
    // Admin-created orders are managed manually; website COD advance rules must not
    // prevent staff from confirming or processing an unpaid order they created.
    const source=String(o.order_source||"").toLowerCase();
    const adminCreated=(!!source&&source!=="website")||o.created_by_admin===true;
    return (adminCreated||codAdvancePaid(o)||o.payment_status==="paid"||o.delivery_method==="self_delivery")
      ?["pending","confirmed","processing","packed","shipped","delivered","cancelled"]
      :["pending","cancelled"];
  };
  const prettyLabel=k=>String(k||"").replace(/_/g," ").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/\b\w/g,x=>x.toUpperCase());
  const displayValue=v=>{
    if(v===null||v===undefined||v==="")return "—";
    if(typeof v==="boolean")return v?"Yes":"No";
    if(typeof v==="object")return JSON.stringify(v);
    return String(v);
  };

  const openResult=(action,value,o)=>{
    setResultModal({action,value,order:o});
  };

  const runNcm=async(o,action)=>{
    if(!onNcmAction)return;
    const currentStatus=String(o.ncm_status||"").toLowerCase().replace(/[_-]+/g," ").trim();
    if(action==="exchange"&&!currentStatus.includes("deliver")){
      setResultModal({action:"error",value:{message:"NCM exchange can only be created after the shipment is delivered."},order:o});
      return;
    }
    if(action==="redirect"&&!["arrived","pickup complete","returned to warehouse"].some(s=>currentStatus.includes(s))){
      setResultModal({action:"error",value:{message:"NCM redirect is available only when the shipment status is Arrived, Pickup Complete, or Returned to Warehouse."},order:o});
      return;
    }
    const key=o.id+":"+action;
    if(action==="return"&&!["arrived","pickup complete","returned to warehouse"].some(s=>currentStatus.includes(s))){
      setResultModal({action:"error",value:{message:"NCM return is available only when the shipment status is Arrived, Pickup Complete, or Returned to Warehouse."},order:o});
      return;
    }
    if(["return","exchange"].includes(action)&&!confirm(action==="return"?"Return this NCM shipment?":"Create an NCM exchange for this order?"))return;
    const payload={};

    if(action==="add_comment"){
      payload.comment=prompt("Enter NCM comment:","")||"";
      if(!payload.comment.trim())return;
    }
    if(action==="cancel_order"){
      const ncmOrderId=o.ncm_order_id||"—";
      payload.comment="Please cancel my NCM shipment order ID #"+ncmOrderId+" for customer order #"+(o.order_number||o.id)+" and kindly confirm once cancelled.";
    }
    if(action==="return")payload.comment=prompt("Return comment (optional):","")||"";
    if(action==="redirect"){
      payload.name=prompt("New recipient name:",o.customer_name||"")||"";
      payload.phone=prompt("New recipient phone:",o.customer_phone||"")||"";
      payload.address=prompt("New delivery address:",o.shipping_address||"")||"";
      if(!payload.name.trim()||!payload.phone.trim()||!payload.address.trim())return;
    }

    setBusy(key);
    try{
      const data=await onNcmAction(o,action,payload);
      const value=data?.ncm||data?.history||data?.comments||data?.response||data;
      if(["details","status_history","comments"].includes(action))openResult(action,value,o);
      else setResultModal({action,value:{message:action==="cancel_order"?(data?.message||"Cancellation requested. Sync the NCM status after cancellation is confirmed."): "Action completed successfully."},order:o});
    }catch(e){
      setResultModal({action:"error",value:{message:e?.message||"Request failed."},order:o});
    }finally{
      setBusy("");
    }
  };

  const requestOrderReturn=async o=>{
    if(!onReturnOrder)return;
    const reason=prompt("Reason for marking delivered order #"+(o.order_number||o.id)+" as returned:","");
    if(reason===null)return;
    if(!reason.trim()){alert("Please enter a reason for the return.");return;}
    if(!confirm("Mark delivered order #"+(o.order_number||o.id)+" as returned? This does not automatically refund payment or restore inventory."))return;
    const key=o.id+":return";
    setBusy(key);
    try{await onReturnOrder(o,reason.trim());}finally{setBusy("");}
  };

  const generateCodAdvanceQr=async o=>{
    if(!o?.id||fonepayLoading)return;
    setFonepayOrder(o);setFonepayQr(null);setFonepayError("");setFonepayLoading(true);
    try{
      const {data,error}=await supabase.functions.invoke("fonepay-payment",{body:{action:"create",orderId:o.id,purpose:"cod_advance"}});
      if(error)throw error;
      if(data?.error)throw new Error(data.error);
      if(data?.alreadyPaid)throw new Error("This COD advance has already been confirmed as paid.");
      if(data?.expired)throw new Error("This payment request has expired. Try generating a new QR.");
      const payload=String(data?.qrString||data?.qrMessage||"").trim();
      if(!payload)throw new Error("Fonepay did not return a QR payload.");
      const qrImage=await QRCode.toDataURL(payload,{width:360,margin:2,errorCorrectionLevel:"M"});
      setFonepayQr({...data,qrImage,purpose:"cod_advance"});
    }catch(e){setFonepayError(e?.message||"Unable to generate Fonepay QR.");}
    finally{setFonepayLoading(false);}
  };
  const checkCodAdvancePayment=async()=>{
    if(!fonepayOrder?.id||fonepayLoading)return;
    setFonepayLoading(true);setFonepayError("");
    try{
      const {data,error}=await supabase.functions.invoke("fonepay-payment",{body:{action:"status",orderId:fonepayOrder.id,purpose:"cod_advance"}});
      if(error)throw error;
      if(data?.error)throw new Error(data.error);
      setFonepayError(data?.verified?"Fonepay has verified this payment. Refresh the order list to see the updated balance.":`Payment status: ${data?.paymentStatus||"pending"}. The advance remains unpaid until Fonepay confirms success.`);
    }catch(e){setFonepayError(e?.message||"Unable to check Fonepay payment.");}
    finally{setFonepayLoading(false);}
  };

  const submitManualPayment=async()=>{
    if(!paymentOrder||!onManualPayment)return;
    setPaymentSaving(true);
    try{
      const amount=Number(paymentAmount);
      if(!Number.isFinite(amount)||amount<=0){alert("Enter a payment amount greater than zero.");return;}
      if(amount>manualPaymentDue(paymentOrder)){alert("Payment amount cannot exceed the outstanding balance.");return;}
      const ok=await onManualPayment(paymentOrder,{method:paymentMethod,reference:paymentReference.trim(),note:paymentNote.trim(),amount});
      if(ok){setPaymentOrder(null);setPaymentReference("");setPaymentNote("");setPaymentAmount("");}
    }finally{setPaymentSaving(false);}
  };

  const actionOptions=[
    ["","Select action"],
    ["details","NCM Order Details"],
    ["status_history","Status History"],
    ["comments","View Comments"],
    ["add_comment","Add Comment"],
    ["cancel_order","Cancel NCM Order"],
    ["return","Return Shipment"],
    ["exchange","Create Exchange"],
    ["redirect","Redirect Shipment"]
  ];

  const renderModalBody=()=>{
    if(!resultModal)return null;
    const {action,value,order}=resultModal;
    if(action==="error"){
      return <div className="ncm-result-error">{displayValue(value?.message)}</div>;
    }

    if(action==="details"){
      const data=value&&typeof value==="object"?value:{};
      const preferred=["orderid","trackid","trackingid","cod_charge","delivery_charge","last_delivery_status","payment_status","vendor_return","active","delivered_date","destination_branch_name","destination_branch_phone"];
      const keys=[...preferred.filter(k=>Object.prototype.hasOwnProperty.call(data,k)),...Object.keys(data).filter(k=>!preferred.includes(k))];
      return <div className="ncm-detail-grid">{keys.map(k=><div className="ncm-detail-item" key={k}><span>{prettyLabel(k)}</span><strong>{displayValue(data[k])}</strong></div>)}</div>;
    }

    if(action==="status_history"){
      const list=Array.isArray(value)?value:(Array.isArray(value?.results)?value.results:Array.isArray(value?.data)?value.data:Array.isArray(value?.history)?value.history:[]);
      if(!list.length)return <div className="ncm-empty">No status history found.</div>;
      return <div className="ncm-history-list">{list.map((item,i)=><div className="ncm-history-item" key={i}><div className="ncm-history-status">{displayValue(item.status||item.event||item.last_delivery_status)}</div><div className="ncm-history-meta">{displayValue(item.added_time||item.addedTime||item.timestamp||item.created_at||"")} {item.comment&&" • "+item.comment}</div></div>)}</div>;
    }

    if(action==="comments"){
      const list=Array.isArray(value)?value:(Array.isArray(value?.results)?value.results:Array.isArray(value?.data)?value.data:Array.isArray(value?.comments)?value.comments:[]);
      if(!list.length)return <div className="ncm-empty">No comments found.</div>;
      return <div className="ncm-comments-list">{list.map((item,i)=><div className="ncm-comment-item" key={i}><div>{displayValue(item.comments||item.comment||item.text||item.message)}</div><small>{displayValue(item.added_time||item.created_at||item.timestamp||"")}</small></div>)}</div>;
    }

    return <div className="ncm-success">{displayValue(value?.message||"NCM action completed successfully.")}</div>;
  };

  return (
    <>
      <div className="table-wrap">
        <table className="admin-orders-table" style={{width:"100%",minWidth:compact?"620px":"790px",tableLayout:"fixed"}}>
          <colgroup>
            <col style={{width:"95px"}}/><col style={{width:"105px"}}/><col style={{width:"65px"}}/><col style={{width:"90px"}}/><col style={{width:"75px"}}/>
            {!compact&&<><col style={{width:"85px"}}/><col style={{width:"210px"}}/></>}
          </colgroup>
          <thead>
            <tr>
              <th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th>
              {!compact&&<><th>NCM Status</th><th>Actions</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map(o=>(
              <tr key={o.id}>
                <td><b>{o.order_number}</b>{o.order_source&&o.order_source!=="website"&&<small style={{display:"block",marginTop:3,fontWeight:700}}>Source: {prettyLabel(o.order_source)}</small>}</td>
                <td className="order-customer-cell"><span>{o.customer_name}</span><small>{o.customer_phone}</small></td>
                <td className="order-total-cell"><span>{money(o.total)}</span>{Number(o.manual_payment_amount||0)>0&&<small style={{display:"block",whiteSpace:"normal",overflowWrap:"anywhere"}}>Received: {money(o.manual_payment_amount)}<br/>Balance: {money(Math.max(0,Number(o.total||0)-(String(o.payment_method||"").toLowerCase()==="cod"?Number(o.cod_advance_paid||0):0)-Number(o.manual_payment_amount||0)))}</small>}{o.payment_method==="cod"&&<small>Advance: {money(o.cod_advance_paid||0)} / {money(o.cod_advance_required||0)}<br/>COD Due: {money(Math.max(0,Number(o.total||0)-Number(o.cod_advance_paid||0)-Number(o.manual_payment_amount||0)))}</small>}</td>
                <td>
                  {onStatus?<div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start"}}>
                    <select value={o.order_status||"pending"} onChange={e=>onStatus(o.id,e.target.value)}>{allowedOrderStatuses(o).map(s=><option key={s} value={s}>{s}</option>)}</select>
                    {String(o.payment_method||"").toLowerCase()==="cod"&&String(o.order_source||"").toLowerCase()==="website"&&<small style={{fontWeight:700}}>{codAdvancePaid(o)?<>COD Advance Paid: {money(o.cod_advance_paid||0)} · Balance Due: {money(o.cod_balance_due||0)}</>:<>COD Advance Pending: {money(o.cod_advance_required||0)} required before confirmation</>}</small>}
                    {o.cancellation_status==="requested"&&<div className="cancellation-review"><small>Cancellation request{o.cancellation_reason?": "+o.cancellation_reason:""}</small><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{onCancellation&&<><button className="secondary" onClick={()=>onCancellation(o,"accept_cancellation")}>Accept</button><button className="danger" onClick={()=>onCancellation(o,"reject_cancellation")}>Reject</button></>}</div></div>}
                    {o.cancellation_status==="rejected"&&<small>Cancellation request rejected</small>}
                    {String(o.order_status||"").toLowerCase()==="delivered"
                      ?canReturnOrder(o)&&<button className="secondary" disabled={!!busy} onClick={()=>requestOrderReturn(o)}>{busy===o.id+":return"?"Saving…":"Return Order"}</button>
                      :!["cancelled","returned"].includes(String(o.order_status||"").toLowerCase())&&<button className="danger" disabled={!!busy} onClick={()=>{const reason=prompt("Reason for cancelling order #"+(o.order_number||o.id)+":","");if(reason===null)return;if(!reason.trim()){alert("Please enter a reason for cancelling the order.");return}onStatus(o.id,"cancelled",reason.trim())}}>Cancel Order</button>}
                  </div>:o.order_status||"—"}</td>
                <td className="order-date-cell"><span className="order-date-day">{new Date(o.created_at).toLocaleDateString()}</span><span className="order-date-time">{new Date(o.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span></td>
                {!compact&&<>
                  <td className="ncm-status-cell">
                    {o.ncm_order_id&&!isNcmCancelled(o)?<small>NCM #{o.ncm_order_id}<br/>{o.ncm_status||"created"}{o.ncm_destination_branch&&<><br/>Destination: {o.ncm_destination_branch}</>}</small>:isNcmCancelled(o)?<small>NCM shipment cancelled</small>:<small>—</small>}
                  </td>
                  <td className="order-actions-cell">
                    <div className="order-action-rows">
                      <div className="order-action-row order-action-row-primary">
                        {o.ncm_order_id&&!isNcmCancelled(o)&&onNcmSync&&<button className="secondary" disabled={!!busy} onClick={()=>onNcmSync(o)}>Sync</button>}
                        {o.ncm_order_id&&!isNcmCancelled(o)&&o.ncm_tracking_id&&String(o.ncm_tracking_id)!==String(o.ncm_order_id)&&<button className="secondary" disabled={!!busy} onClick={()=>{setTrackingPopup(String(o.ncm_tracking_id));try{navigator.clipboard?.writeText(String(o.ncm_tracking_id));}catch{}}}>Track</button>}
                        {o.ncm_order_id&&!isNcmCancelled(o)&&onNcmAction&&<select className="ncm-action-select" value="" disabled={!!busy} onChange={e=>{const a=e.target.value;if(a)runNcm(o,a)}}><option value="" disabled>Select Action</option>{actionOptions.map(([v,l])=>{const s=String(o.ncm_status||"").toLowerCase().replace(/[_-]+/g," ").trim();const exchangeBlocked=v==="exchange"&&!s.includes("deliver");const returnBlocked=v==="return"&&!["arrived","pickup complete","returned to warehouse"].some(x=>s.includes(x));const redirectBlocked=v==="redirect"&&!["arrived","pickup complete","returned to warehouse"].some(x=>s.includes(x));return <option key={v} value={v} disabled={exchangeBlocked||returnBlocked||redirectBlocked}>{exchangeBlocked?"Create Exchange (after delivery)":returnBlocked?"Return Shipment (after allowed status)":redirectBlocked?"Redirect Shipment (after allowed status)":l}</option>})}</select>}{String(o.order_status||"").toLowerCase()!=="delivered"&&(!o.ncm_order_id||isNcmCancelled(o))&&(onCreateShipment||onNcm)&&(String(o.payment_method||"").toLowerCase()!=="cod"||codAdvancePaid(o)||String(o.order_source||"").toLowerCase()!=="website")&&<button className="secondary" disabled={!!busy} onClick={()=>onCreateShipment?onCreateShipment(o):onNcm(o)}>Create shipment</button>}{String(o.order_status||"").toLowerCase()!=="delivered"&&(!o.ncm_order_id||isNcmCancelled(o))&&String(o.payment_method||"").toLowerCase()==="cod"&&!codAdvancePaid(o)&&!(String(o.order_source||"").toLowerCase()!=="website")&&<small style={{fontWeight:700}}>Shipment locked until COD advance is paid.</small>}{(!o.ncm_order_id||isNcmCancelled(o))&&o.order_status!=="delivered"&&!["cancelled","returned"].includes(String(o.order_status||"").toLowerCase())&&<button className="secondary" disabled={!!busy||!!onSelfDelivery===false} onClick={async()=>{const note=prompt("Optional delivery note (e.g. self-delivery / nearby customer):","");if(note===null)return;if(!confirm("Mark order #"+(o.order_number||o.id)+" as delivered without NCM?"))return;setBusy(o.id+":self_delivery");try{await onSelfDelivery?.(o,note.trim());}finally{setBusy("")}}}>{busy===o.id+":self_delivery"?"Saving…":"Mark Delivered (Direct)"}</button>}
                      </div>
                      <div className="order-action-row order-action-row-invoice">
                        {(o.invoice_number||o.invoice_data)&&<>{String(o.invoice_status||"active").toLowerCase()!=="cancelled"&&<>{o.invoice_data&&<button className="secondary" disabled={!!busy} onClick={()=>onInvoice&&onInvoice(o)}>View Invoice</button>}{onCancelInvoice&&<button className="danger" disabled={!!busy} onClick={()=>onCancelInvoice(o)}>Cancel Invoice</button>}</>}{String(o.invoice_status||"active").toLowerCase()==="cancelled"&&<><small style={{color:"#9b2c2c",fontWeight:700}}>Invoice cancelled</small>{onInvoice&&["confirmed","processing","packed","shipped","delivered"].includes(String(o.order_status||"").toLowerCase())&&<button className="secondary" disabled={!!busy} onClick={()=>onInvoice(o)}>Create New Invoice</button>}</>}</>}{onInvoice&&["confirmed","processing","packed","shipped","delivered"].includes(String(o.order_status||"").toLowerCase())&&!o.invoice_number&&!o.invoice_data&&<button className="secondary" disabled={!!busy} onClick={()=>onInvoice(o)}>Generate Invoice</button>}
                      </div>
                      <div className="order-action-row order-action-row-payment">
                        
                        
                        
                        
                        {String(o.payment_method||"").toLowerCase()==="cod"&&Number(o.cod_advance_required||0)>Number(o.cod_advance_paid||0)&&!["cancelled","returned"].includes(String(o.order_status||"").toLowerCase())&&<button className="secondary" disabled={!!busy||fonepayLoading} onClick={()=>generateCodAdvanceQr(o)}>Generate Fonepay QR</button>}{o.payment_status!=="paid"&&!["cancelled","returned"].includes(String(o.order_status||"").toLowerCase())&&<button className="secondary" disabled={!!busy} onClick={()=>{setPaymentOrder(o);setPaymentMethod("cash");setPaymentReference("");setPaymentNote("");setPaymentAmount(String(manualPaymentDue(o)))}}>Record Payment</button>}
                        {o.payment_status==="paid"&&<small className="order-payment-status">Paid{o.manual_payment_method?" · "+(o.manual_payment_method==="cash"?"Cash":"Bank transfer / Static QR"):""}{o.manual_payment_amount!=null?" · "+money(o.manual_payment_amount):""}{o.manually_paid_at?" · "+new Date(o.manually_paid_at).toLocaleDateString():""}</small>}
                        {o.delivery_method==="self_delivery"&&<><small className="order-payment-status">Delivered directly{o.delivered_at?" · "+new Date(o.delivered_at).toLocaleDateString():""}</small>{o.delivery_note&&<small>Note: {o.delivery_note}</small>}</>}
                        {o.returned_at&&<small className="order-payment-status order-payment-status-warning">Returned · {new Date(o.returned_at).toLocaleDateString()}</small>}
                        {o.return_reason&&<small>Return reason: {o.return_reason}</small>}
                      </div>
                      {(Number(o.manual_payment_amount||0)>0||o.manual_payment_reference||o.manual_payment_note)&&<div className="order-payment-details" style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:8,padding:"9px 10px",border:"1px solid var(--line,#eadbd5)",borderRadius:8,background:"var(--surface,#fffaf8)",fontSize:12,lineHeight:1.5,whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"break-word"}}>{Number(o.manual_payment_amount||0)>0&&<div><strong>Manually received:</strong> {money(o.manual_payment_amount)}</div>}{o.manual_payment_reference&&<div><strong>Payment ref:</strong> {o.manual_payment_reference}</div>}{o.manual_payment_note&&<div><strong>Note:</strong> {o.manual_payment_note}</div>}</div>}
                      <div className="order-action-row order-action-row-edit">{onEditOrder&&["pending","confirmed","processing","packed","shipped"].includes(String(o.order_status||"").toLowerCase())&&<button className="secondary" disabled={!!busy} onClick={()=>setEditingOrder(o)}>Edit Order / Size</button>}</div>
                      <div className="order-action-row order-action-row-track"><button className="secondary" type="button" disabled={!o.order_number} onClick={async()=>{const link="https://suru.com.np/track/"+encodeURIComponent(o.order_number);let items=Array.isArray(o.order_items)?o.order_items:(Array.isArray(o.items)?o.items:[]);if(!items.length&&o.id){try{const result=await supabase.from("order_items").select("product_name,product_code,size,color,quantity").eq("order_id",o.id);if(!result.error&&Array.isArray(result.data))items=result.data}catch{}}const lines=["SURU COLLECTION — ORDER DETAILS","", "Order: "+(o.order_number||"—"),"Customer: "+(o.customer_name||"—"),o.shipping_address?"Delivery address: "+o.shipping_address:null,"", "Items:",...(items.length?items.map((item,i)=>`${i+1}. ${item.product_name||item.name||"Item"}${item.product_code?" ("+item.product_code+")":""}${item.size?" · Size: "+item.size:""}${item.color?" · Color: "+item.color:""}${item.quantity?" · Qty: "+item.quantity:""}`):["Please check the order details in the admin panel."]),"", "Order total: "+money(o.total),"Order status: "+prettyLabel(o.order_status||"pending"),"Payment: "+prettyLabel(o.payment_status||"pending")+(o.payment_method?" · "+prettyLabel(o.payment_method):""),"", "Track order:",link,"","Thank you for shopping with Suru Collection!"];const message=lines.filter(v=>v!==null).join("\n");try{await navigator.clipboard.writeText(message);alert("Order details text copied. Paste it into any chat or message.")}catch{const input=document.createElement("textarea");input.value=message;input.style.position="fixed";input.style.opacity="0";document.body.appendChild(input);input.select();let copied=false;try{copied=document.execCommand("copy")}catch{}input.remove();if(copied)alert("Order details text copied. Paste it into any chat or message.");else prompt("Copy order details text:",message)}}}>Copy Order Details Text</button></div>
                    </div>
                  </td>             </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminEditOrderModal order={editingOrder} onClose={()=>setEditingOrder(null)} onSave={onEditOrder}/>
      {trackingPopup&&<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setTrackingPopup("")}}><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="ncm-track-title" style={{width:"min(1100px, calc(100vw - 24px))",maxWidth:1100,height:"min(82vh, 850px)",display:"flex",flexDirection:"column"}}><div className="page-title"><div><h2 id="ncm-track-title">Track Shipment</h2><p>NCM tracking portal</p></div><button className="secondary" type="button" onClick={()=>setTrackingPopup("")}>Close</button></div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"10px 0"}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><strong>Tracking ID:</strong><code style={{fontSize:15,padding:"7px 10px",background:"#f6f2f0",borderRadius:7,overflowWrap:"anywhere"}}>{trackingPopup}</code><button className="secondary" type="button" onClick={async()=>{try{await navigator.clipboard.writeText(trackingPopup)}catch{const input=document.createElement("textarea");input.value=trackingPopup;input.style.position="fixed";input.style.opacity="0";document.body.appendChild(input);input.select();try{document.execCommand("copy")}catch{}input.remove()}}}>Copy Tracking ID</button></div><a className="primary" href={trackingUrl||"https://portal.nepalcanmove.com/track/"} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>Open Tracking Portal ↗</a></div><iframe title="NCM shipment tracking" src={trackingUrl||"https://portal.nepalcanmove.com/track/"} style={{width:"100%",flex:1,minHeight:0,border:0,borderRadius:8}} referrerPolicy="no-referrer" allow="clipboard-read; clipboard-write"/></div></div>}
      {fonepayOrder&&<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!fonepayLoading)setFonepayOrder(null)}}><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="cod-fonepay-title"><div className="page-title"><div><h2 id="cod-fonepay-title">COD Advance — Fonepay</h2><p>Order {fonepayOrder.order_number}</p><p style={{fontWeight:800}}>Advance outstanding: {money(Math.max(0,Number(fonepayOrder.cod_advance_required||0)-Number(fonepayOrder.cod_advance_paid||0)))}</p></div><button className="secondary" type="button" disabled={fonepayLoading} onClick={()=>setFonepayOrder(null)}>Close</button></div>{fonepayQr?<div style={{display:"grid",justifyItems:"center",gap:10,padding:16}}><img src={fonepayQr.qrImage} alt="Fonepay COD advance QR" style={{width:280,maxWidth:"100%"}}/><strong>Pay {money(fonepayQr.amount||0)}</strong><small>Reference: {fonepayQr.reference||"—"}</small><div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}><a className="secondary" href={fonepayQr.qrImage} download={`Suru-Fonepay-${fonepayOrder.order_number}.png`} onClick={()=>setFonepayError("")} style={{textDecoration:"none",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"10px 14px",borderRadius:8}}>Save QR Image</a><button className="secondary" type="button" onClick={async()=>{setFonepayError("");try{if(!navigator.share)throw Error("share-unsupported");const base64=fonepayQr.qrImage.split(",")[1];const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const file=new File([bytes],`Suru-Fonepay-${fonepayOrder.order_number}.png`,{type:"image/png"});if(navigator.canShare&&!navigator.canShare({files:[file]}))throw Error("file-share-unsupported");await navigator.share({title:"Suru Collection COD advance",text:`Order ${fonepayOrder.order_number} — please pay ${money(fonepayQr.amount||0)} via Fonepay.`,files:[file]});}catch(e){if(e?.name==="AbortError"){setFonepayError("Sharing was cancelled. You can still use Save QR Image.");}else{setFonepayError("Sharing is not supported in this browser. Tap Save QR Image, then attach the saved image in WhatsApp or your preferred app.");}}}}>Share QR</button></div><button className="primary" type="button" disabled={fonepayLoading} onClick={checkCodAdvancePayment}>{fonepayLoading?"Checking…":"Check Payment Status"}</button></div>:<div className="admin-form" style={{padding:16}}><p>Generate a QR for the outstanding COD advance on this existing order.</p><button className="primary" type="button" disabled={fonepayLoading} onClick={()=>generateCodAdvanceQr(fonepayOrder)}>{fonepayLoading?"Generating QR…":"Generate QR"}</button></div>}{fonepayError&&<p className="message" style={{margin:16}}>{fonepayError}</p>}</div></div>}
      {paymentOrder&&<div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!paymentSaving)setPaymentOrder(null)}}><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="manual-payment-title"><div className="page-title"><div><h2 id="manual-payment-title">Record Payment</h2><p>Order {paymentOrder.order_number}</p><p style={{fontWeight:800,margin:"8px 0 6px"}}>Outstanding balance: {money(manualPaymentDue(paymentOrder))}</p>{Number(paymentOrder.manual_payment_amount||0)>0&&<p style={{margin:"0 0 12px",fontSize:13}}>Previously received manually: {money(paymentOrder.manual_payment_amount)}</p>}</div><button className="secondary" type="button" disabled={paymentSaving} onClick={()=>setPaymentOrder(null)}>Close</button></div><div className="admin-form"><label>Amount received (NPR)<input type="number" min="0.01" max={manualPaymentDue(paymentOrder)} step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} required/><small>Enter the amount received now. A smaller amount will be saved as a partial payment.</small></label><label>Payment received via<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="bank_transfer_static_qr">Bank transfer / Static QR</option></select></label><label>Bank transaction reference (optional)<input value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} placeholder="Transaction ID / reference"/></label><label>Internal note (optional)<textarea rows="3" value={paymentNote} onChange={e=>setPaymentNote(e.target.value)} placeholder="e.g. received at delivery / verified bank transfer"/></label><p className="small-note">Only mark paid after you have actually received or verified the payment.</p><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}><button className="secondary" type="button" disabled={paymentSaving} onClick={()=>setPaymentOrder(null)}>Cancel</button><button className="primary" type="button" disabled={paymentSaving||!Number(paymentAmount)||Number(paymentAmount)<=0||Number(paymentAmount)>manualPaymentDue(paymentOrder)} onClick={submitManualPayment}>{paymentSaving?"Saving…":Number(paymentAmount)>0&&Number(paymentAmount)<manualPaymentDue(paymentOrder)?"Record Partial Payment":"Confirm Payment Received"}</button></div></div></div></div>}
      {resultModal&&<div className="modal-backdrop ncm-result-backdrop" onClick={e=>{if(e.target===e.currentTarget)setResultModal(null)}}>
        <div className="modal-card ncm-result-modal" role="dialog" aria-modal="true">
          <div className="ncm-result-header">
            <div><h2>{resultModal.action==="error"?"NCM Error":resultModal.action==="details"?"NCM Order Details":resultModal.action==="status_history"?"Status History":resultModal.action==="comments"?"NCM Comments":"NCM Action"}</h2><small>{resultModal.order?.order_number||""}{resultModal.order?.ncm_order_id?" • NCM #"+resultModal.order.ncm_order_id:""}</small></div>
            <button className="ncm-close-button" onClick={()=>setResultModal(null)} aria-label="Close">×</button>
          </div>
          <div className="ncm-result-body">{renderModalBody()}</div>
          <div className="ncm-result-footer"><button className="secondary" onClick={()=>setResultModal(null)}>Close</button></div>
        </div>
      </div>}
    </>
  );
}
