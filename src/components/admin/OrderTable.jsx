import React,{useState} from "react";
import { money } from "../../lib/api.js";

export default function OrderTable({rows,onStatus,onNcm,onNcmRate,onNcmSync,onCancellation,onNcmAction,compact=false}){
  const [busy,setBusy]=useState("");
  const runNcm=async(o,action)=>{
    if(!onNcmAction)return;
    const key=o.id+":"+action;
    if(["return","exchange"].includes(action)&&!confirm(action==="return"?"Return this NCM shipment?":"Create an NCM exchange for this order?"))return;
    const payload={};
    if(action==="add_comment"){
      payload.comment=prompt("Enter NCM comment:","")||"";
      if(!payload.comment.trim())return;
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
      if(["details","status_history","comments"].includes(action))alert(JSON.stringify(value,null,2));
      else alert("NCM "+action+" completed successfully.");
    }catch(e){alert("NCM: "+(e?.message||"Request failed."))}
    finally{setBusy("")}
  };
  const actionOptions=[
    ["","Select action"],
    ["details","NCM Order Details"],
    ["status_history","Status History"],
    ["comments","View Comments"],
    ["add_comment","Add Comment"],
    ["return","Return Shipment"],
    ["exchange","Create Exchange"],
    ["redirect","Redirect Shipment"]
  ];
  return <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th>{!compact&&<><th>Cancellation</th><th>NCM</th><th>Actions</th></>}</tr></thead><tbody>{rows.map(o=><tr key={o.id}><td><b>{o.order_number}</b></td><td>{o.customer_name}<br/><small>{o.customer_phone}</small></td><td>{money(o.total)}</td><td>{onStatus?<select value={o.order_status} onChange={e=>onStatus(o.id,e.target.value)}>{["pending","confirmed","processing","packed","shipped","delivered","cancelled","returned"].map(s=><option key={s}>{s}</option>)}</select>:o.order_status}</td><td>{new Date(o.created_at).toLocaleString()}</td>{!compact&&<><td>{o.cancellation_status==="requested"?<div className="cancellation-review"><small>Request{o.cancellation_reason?": "+o.cancellation_reason:""}</small><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{onCancellation&&<><button className="secondary" onClick={()=>onCancellation(o,"accept_cancellation")}>Accept</button><button className="danger" onClick={()=>onCancellation(o,"reject_cancellation")}>Reject</button></>}</div></div>:o.cancellation_status==="accepted"?<small>Cancelled</small>:o.cancellation_status==="rejected"?<small>Request rejected</small>:<small>—</small>}</td><td>{o.ncm_order_id?<><small>NCM #{o.ncm_order_id}<br/>{o.ncm_status||"created"}{o.ncm_destination_branch&&<><br/>Destination: {o.ncm_destination_branch}</>}</small><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{onNcmSync&&<button className="secondary" onClick={()=>onNcmSync(o)}>Sync</button>}{o.ncm_tracking_id&&String(o.ncm_tracking_id)!==String(o.ncm_order_id)&&<button className="secondary" onClick={()=>{window.open("https://portal.nepalcanmove.com/track/","_blank","noopener,noreferrer");try{navigator.clipboard?.writeText(String(o.ncm_tracking_id));}catch{}setTimeout(()=>alert("NCM tracking page opened. Tracking ID copied: "+String(o.ncm_tracking_id)),50)}}>Track</button>}</div></td><td>{onNcmAction?<select className="ncm-action-select" value="" disabled={!!busy} onChange={e=>{const a=e.target.value;if(a)runNcm(o,a)}}>{actionOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:<small>—</small>}</td></>:null}</tr>)}</tbody></table></div>;
}
