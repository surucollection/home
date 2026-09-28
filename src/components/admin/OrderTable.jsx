import React from "react";
import { money } from "../../lib/api.js";

export default function OrderTable({rows,onStatus,onNcm,onNcmRate,onNcmSync,onCancellation,onNcmAction,compact=false}){
  const manageNcm=async o=>{
    if(!onNcmAction)return;
    const choice=prompt("NCM actions:\n1. Details\n2. Status history\n3. Comments\n4. Add comment\n5. Return shipment\n6. Create exchange\n7. Redirect shipment\n\nEnter 1-7:");
    if(!choice)return;
    const actionMap={"1":"details","2":"status_history","3":"comments","4":"add_comment","5":"return","6":"exchange","7":"redirect"};
    const action=actionMap[String(choice).trim()];
    if(!action)return;
    if(action==="return"&&!confirm("Return this NCM shipment?"))return;
    if(action==="exchange"&&!confirm("Create an NCM exchange for this order?"))return;
    const payload={};
    if(action==="add_comment"){payload.comment=prompt("Enter NCM comment:","")||"";if(!payload.comment.trim())return}
    if(action==="return"){payload.comment=prompt("Return comment (optional):","")||""}
    if(action==="redirect"){
      payload.name=prompt("New recipient name:",o.customer_name||"")||"";
      payload.phone=prompt("New recipient phone:",o.customer_phone||"")||"";
      payload.address=prompt("New delivery address:",o.shipping_address||"")||"";
      if(!payload.name.trim()||!payload.phone.trim()||!payload.address.trim())return;
    }
    try{
      const data=await onNcmAction(o,action,payload);
      const value=data?.ncm||data?.history||data?.comments||data?.response||data;
      alert(action==="details"||action==="status_history"||action==="comments"?JSON.stringify(value,null,2):"NCM "+action+" completed successfully.");
    }catch(e){alert("NCM: "+(e?.message||"Request failed."))}
  };
  return <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th>{!compact&&<><th>Cancellation</th><th>NCM</th></>}</tr></thead><tbody>{rows.map(o=><tr key={o.id}><td><b>{o.order_number}</b></td><td>{o.customer_name}<br/><small>{o.customer_phone}</small></td><td>{money(o.total)}</td><td>{onStatus?<select value={o.order_status} onChange={e=>onStatus(o.id,e.target.value)}>{["pending","confirmed","processing","packed","shipped","delivered","cancelled","returned"].map(s=><option key={s}>{s}</option>)}</select>:o.order_status}</td><td>{new Date(o.created_at).toLocaleString()}</td>{!compact&&<><td>{o.cancellation_status==="requested"?<div className="cancellation-review"><small>Request{ o.cancellation_reason?": "+o.cancellation_reason:""}</small><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{onCancellation&&<><button className="secondary" onClick={()=>onCancellation(o,"accept_cancellation")}>Accept</button><button className="danger" onClick={()=>onCancellation(o,"reject_cancellation")}>Reject</button></>}</div></div>:o.cancellation_status==="accepted"?<small>Cancelled</small>:o.cancellation_status==="rejected"?<small>Request rejected</small>:<small>—</small>}</td><td>{o.ncm_order_id?<><small>NCM #{o.ncm_order_id}<br/>{o.ncm_status||"created"}{o.ncm_destination_branch&&<><br/>Destination: {o.ncm_destination_branch}</>}</small><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{onNcmSync&&<button className="secondary" onClick={()=>onNcmSync(o)}>Sync</button>}{o.ncm_tracking_id&&String(o.ncm_tracking_id)!==String(o.ncm_order_id)?<button className="secondary" onClick={()=>{window.open("https://portal.nepalcanmove.com/track/","_blank","noopener,noreferrer");try{navigator.clipboard?.writeText(String(o.ncm_tracking_id));}catch{}setTimeout(()=>alert("NCM tracking page opened. Tracking ID copied: "+String(o.ncm_tracking_id)),50)}}>Track</button>:o.ncm_order_id?<button className="secondary" onClick={()=>onNcmSync&&onNcmSync(o)}>Sync tracking</button>{onNcmAction&&<button className="secondary" onClick={()=>manageNcm(o)}>Manage NCM</button>}:null}</div></>:<><small>{o.ncm_destination_branch?"Destination: "+o.ncm_destination_branch:"NCM destination not selected"}</small><button className="secondary" onClick={()=>onNcm(o)}>Create shipment</button>{onNcmRate&&<button className="secondary" onClick={()=>onNcmRate(o)}>Rate</button>}</>}</td></>}</tr>)}</tbody></table></div>
}
