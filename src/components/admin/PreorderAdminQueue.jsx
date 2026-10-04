import React,{useCallback,useEffect,useState} from "react";
import {supabase,money} from "../../lib/api.js";

export default function PreorderAdminQueue(){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(""),[notes,setNotes]=useState({});
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const {data:items,error:itemError}=await supabase.from("order_items").select("id,order_id,product_code,product_name,size,color,quantity,total_price,advance_amount,balance_amount,preorder_status,preorder_balance_method,advance_payment_status,advance_payment_gateway,advance_payment_reference,advance_payment_proof_url,advance_payment_submitted_at,advance_payment_verified_at,advance_payment_note,created_at").eq("is_preorder",true).order("created_at",{ascending:false}).limit(300);
   if(itemError)throw itemError;
   const ids=[...new Set((items||[]).map(x=>x.order_id).filter(Boolean))];let orders=[];
   if(ids.length){const {data,error:orderError}=await supabase.from("orders").select("id,order_number,customer_name,customer_phone,customer_email,shipping_address,order_status,payment_status,created_at").in("id",ids);if(orderError)throw orderError;orders=data||[];}
   const byId=Object.fromEntries(orders.map(o=>[o.id,o]));setRows((items||[]).map(item=>({...item,order:byId[item.order_id]})));
  }catch(e){setError(e?.message||"Could not load preorder records.");}finally{setLoading(false);}
 },[]);
 useEffect(()=>{load()},[load]);
 const review=async(row,decision)=>{
  const key=row.id;setBusy(key);setError("");
  try{const {error:e}=await supabase.rpc("admin_review_preorder_advance",{p_item_id:key,p_decision:decision,p_note:notes[key]||null});if(e)throw e;await load();}
  catch(e){setError(e?.message||"Could not save review.");}finally{setBusy("");}
 };
 const statusLabel=s=>String(s||"pending").replace(/_/g," ");
 return <section>
  <div className="page-title"><div><h2>Preorder Review</h2><p>Verify submitted advance payments. Approval confirms the preorder; gateway integration is not included.</p></div><button className="secondary" onClick={load} disabled={loading}>{loading?"Loading…":"Refresh"}</button></div>
  {error&&<div className="message error">{error}</div>}
  {loading?<p>Loading preorder records…</p>:!rows.length?<div className="card"><p>No preorder items found.</p></div>:<div className="table-wrap"><table className="admin-orders-table" style={{width:"100%",minWidth:"1150px"}}><thead><tr><th>Order / Customer</th><th>Product</th><th>Amounts</th><th>Advance status</th><th>Submitted proof / reference</th><th>Review note / action</th></tr></thead><tbody>
   {rows.map(r=><tr key={r.id}>
    <td><b>{r.order?.order_number||r.order_id}</b><br/>{r.order?.customer_name||"—"}<br/><small>{r.order?.customer_phone||""}</small><br/><small>{r.order?.created_at?new Date(r.order.created_at).toLocaleString():""}</small></td>
    <td>{r.product_name||r.product_code}<br/><small>{[r.size,r.color].filter(Boolean).join(" / ")||"—"} · Qty {r.quantity}</small><br/><small>Preorder: {statusLabel(r.preorder_status)}</small></td>
    <td>Total: {money(r.total_price)}<br/>Advance: {money(r.advance_amount)}<br/>Balance: {money(r.balance_amount)}<br/><small>Balance: {r.preorder_balance_method||"—"}</small></td>
    <td><b>{statusLabel(r.advance_payment_status)}</b><br/><small>Method: {r.advance_payment_gateway||"not recorded"}</small>{r.advance_payment_verified_at&&<><br/><small>Reviewed: {new Date(r.advance_payment_verified_at).toLocaleString()}</small></>}</td>
    <td>{r.advance_payment_reference||"No reference submitted"}{r.advance_payment_proof_url&&<><br/><a href={r.advance_payment_proof_url} target="_blank" rel="noopener noreferrer">Open submitted proof</a></>}{r.advance_payment_submitted_at&&<><br/><small>Submitted: {new Date(r.advance_payment_submitted_at).toLocaleString()}</small></>}</td>
    <td>{r.advance_payment_note&&<p>{r.advance_payment_note}</p>}
     {["pending","submitted","rejected"].includes(r.advance_payment_status)&&<><textarea aria-label="Review note" placeholder="Optional review note" value={notes[r.id]??""} onChange={e=>setNotes(s=>({...s,[r.id]:e.target.value}))} rows="2" style={{width:"100%",minWidth:"180px"}}/><div style={{display:"flex",gap:8,marginTop:8}}><button className="btn" disabled={!!busy} onClick={()=>review(r,"approve")}>{busy===r.id?"Saving…":"Approve"}</button><button className="secondary" disabled={!!busy} onClick={()=>review(r,"reject")}>Reject</button></div></>}
    </td>
   </tr>)}
  </tbody></table></div>}
 </section>;
}
