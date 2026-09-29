import React,{useState,useEffect,useRef} from "react";
import { money } from "../../lib/api.js";

export default function OrderTable({rows,onStatus,onNcm,onNcmRate,onNcmSync,onCancellation,onNcmAction,onInvoice,onCreateShipment,compact=false}){
  const [busy,setBusy]=useState("");
  const [resultModal,setResultModal]=useState(null);
  const [ncmCancelled,setNcmCancelled]=useState({});
  const ncmCommentChecks=useRef({});

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

  const isNcmCancelled=o=>ncmCancelled[o.id]===String(o.ncm_order_id)||/^(cancelled|canceled)$/i.test(String(o.ncm_status||"").trim());
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
      else setResultModal({action,value:{message:"Action completed successfully."},order:o});
    }catch(e){
      setResultModal({action:"error",value:{message:e?.message||"Request failed."},order:o});
    }finally{
      setBusy("");
    }
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
        <table className="admin-orders-table" style={{width:"100%",minWidth:compact?"760px":"1120px",tableLayout:"fixed"}}>
          <colgroup>
            <col style={{width:"145px"}}/><col style={{width:"180px"}}/><col style={{width:"100px"}}/><col style={{width:"175px"}}/><col style={{width:"165px"}}/>
            {!compact&&<><col style={{width:"205px"}}/><col style={{width:"235px"}}/></>}
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
                <td><b>{o.order_number}</b></td>
                <td>{o.customer_name}<br/><small>{o.customer_phone}</small></td>
                <td>{money(o.total)}</td>
                <td>
                  {onStatus?<div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start"}}>
                    <select value={o.order_status||"pending"} onChange={e=>onStatus(o.id,e.target.value)}>{["pending","confirmed","processing","packed","shipped","delivered","cancelled","returned"].map(s=><option key={s} value={s}>{s}</option>)}</select>
                    {o.cancellation_status==="requested"&&<div className="cancellation-review"><small>Cancellation request{o.cancellation_reason?": "+o.cancellation_reason:""}</small><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{onCancellation&&<><button className="secondary" onClick={()=>onCancellation(o,"accept_cancellation")}>Accept</button><button className="danger" onClick={()=>onCancellation(o,"reject_cancellation")}>Reject</button></>}</div></div>}
                    {o.cancellation_status==="rejected"&&<small>Cancellation request rejected</small>}
                    {o.order_status!=="cancelled"&&<button className="danger" disabled={!!busy} onClick={()=>{const reason=prompt("Reason for cancelling order #"+(o.order_number||o.id)+":","");if(reason===null)return;if(!reason.trim()){alert("Please enter a reason for cancelling the order.");return}onStatus(o.id,"cancelled",reason.trim())}}>Cancel Order</button>}
                  </div>:o.order_status||"—"}</td>
                <td className="order-date-cell">{new Date(o.created_at).toLocaleString()}</td>
                {!compact&&<>
                  <td className="ncm-status-cell">
                    {o.ncm_order_id&&!isNcmCancelled(o)?<small>NCM #{o.ncm_order_id}<br/>{o.ncm_status||"created"}{o.ncm_destination_branch&&<><br/>Destination: {o.ncm_destination_branch}</>}</small>:isNcmCancelled(o)?<small>NCM shipment cancelled</small>:<small>—</small>}
                  </td>
                  <td className="order-actions-cell">
                    <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-start"}}>
                      {o.ncm_order_id&&!isNcmCancelled(o)&&onNcmSync&&<button className="secondary" disabled={!!busy} onClick={()=>onNcmSync(o)}>Sync</button>}
                      {onInvoice&&(["shipped","delivered"].includes(String(o.order_status||"").toLowerCase())?(o.invoice_data?<button className="secondary" disabled={!!busy} onClick={()=>onInvoice(o)}>View Invoice</button>:<button className="secondary" disabled={!!busy} onClick={()=>onInvoice(o)}>Generate Invoice</button>):<button className="secondary" disabled title="Invoice becomes available after the order is shipped">Generate Invoice</button>)}
                      {o.ncm_order_id&&!isNcmCancelled(o)&&o.ncm_tracking_id&&String(o.ncm_tracking_id)!==String(o.ncm_order_id)&&<button className="secondary" disabled={!!busy} onClick={()=>{window.open("https://portal.nepalcanmove.com/track/","_blank","noopener,noreferrer");try{navigator.clipboard?.writeText(String(o.ncm_tracking_id));}catch{}setTimeout(()=>alert("NCM tracking page opened. Tracking ID copied: "+String(o.ncm_tracking_id)),50)}}>Track</button>}
                      {o.ncm_order_id&&!isNcmCancelled(o)&&onNcmAction&&<select className="ncm-action-select" value="" disabled={!!busy} onChange={e=>{const a=e.target.value;if(a)runNcm(o,a)}}>{actionOptions.map(([v,l])=>{const s=String(o.ncm_status||"").toLowerCase().replace(/[_-]+/g," ").trim();const exchangeBlocked=v==="exchange"&&!s.includes("deliver");const returnBlocked=v==="return"&&!["arrived","pickup complete","returned to warehouse"].some(x=>s.includes(x));const redirectBlocked=v==="redirect"&&!["arrived","pickup complete","returned to warehouse"].some(x=>s.includes(x));return <option key={v} value={v} disabled={exchangeBlocked||returnBlocked||redirectBlocked}>{exchangeBlocked?"Create Exchange (after delivery)":returnBlocked?"Return Shipment (after allowed status)":redirectBlocked?"Redirect Shipment (after allowed status)":l}</option>})}</select>}
                      {(!o.ncm_order_id||isNcmCancelled(o))&&(onCreateShipment||onNcm)&&<button className="secondary" disabled={!!busy} onClick={()=>onCreateShipment?onCreateShipment(o):onNcm(o)}>Create shipment</button>}
                    </div>
                  </td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
