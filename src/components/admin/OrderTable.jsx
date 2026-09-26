import React from "react";
import { money } from "../../lib/api.js";

export default function OrderTable({rows,onStatus,onNcm,compact=false}){
  return <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th>{!compact&&<th>NCM</th>}</tr></thead><tbody>{rows.map(o=><tr key={o.id}><td><b>{o.order_number}</b></td><td>{o.customer_name}<br/><small>{o.customer_phone}</small></td><td>{money(o.total)}</td><td>{onStatus?<select value={o.order_status} onChange={e=>onStatus(o.id,e.target.value)}>{["pending","confirmed","processing","packed","shipped","delivered","cancelled","returned"].map(s=><option key={s}>{s}</option>)}</select>:o.order_status}</td><td>{new Date(o.created_at).toLocaleString()}</td>{!compact&&<td>{o.ncm_order_id?<small>NCM #{o.ncm_order_id}<br/>{o.ncm_status||"created"}</small>:<button className="secondary" onClick={()=>onNcm(o)}>Create shipment</button>}</td>}</tr>)}</tbody></table></div>
}
