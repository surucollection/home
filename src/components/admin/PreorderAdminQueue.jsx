import React,{useCallback,useEffect,useState} from "react";
import {supabase} from "../../lib/api.js";
import {money} from "../../lib/api.js";

export default function PreorderAdminQueue(){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const {data:items,error:itemError}=await supabase.from("order_items").select("id,order_id,product_code,product_name,size,color,quantity,total_price,advance_amount,balance_amount,preorder_status,preorder_balance_method,advance_payment_status,advance_payment_gateway,advance_payment_reference,advance_payment_proof_url,advance_payment_submitted_at,advance_payment_verified_at,advance_payment_note,created_at").eq("is_preorder",true).order("created_at",{ascending:false}).limit(300);
   if(itemError)throw itemError;
   const ids=[...new Set((items||[]).map(x=>x.order_id).filter(Boolean))];
   let orders=[];
   if(ids.length){const {data,error:orderError}=await supabase.from("orders").select("id,order_number,customer_name,customer_phone,customer_email,shipping_address,order_status,payment_status,created_at").in("id",ids);if(orderError)throw orderError;orders=data||[];}
   const byId=Object.fromEntries(orders.map(o=>[o.id,o]));
   setRows((items||[]).map(item=>({...item,order:byId[item.order_id]})));
  }catch(e){setError(e?.message||"Could not load preorder records.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{load()},[load]);
 const statusLabel=s=>String(s||"pending").replace(/_/g," ");
 return <section>
  <div className="page-title"><div><h2>Preorder Review</h2><p>Review advance-payment submissions. This screen does not verify or mark payments as paid.</p></div><button className="secondary" onClick={load} disabled={loading}>{loading?"Loading…":"Refresh"}</button></div>
  {error&&<div className="message">{error}</div>}
  {loading?<p>Loading preorder records…</p>:!rows.length?<div className="card"><p>No preorder items found.</p></div>:<div className="table-wrap"><table className="admin-orders-table" style={{width:"100%",minWidth:"1050px"}}><thead><tr><th>Order / Customer</th><th>Product</th><th>Amounts</th><th>Advance status</th><th>Submitted proof / reference</th><th>Review note</th></tr></thead><tbody>
   {rows.map(r=><tr key={r.id}>
    <td><b>{r.order?.order_number||r.order_id}</b><br/>{r.order?.customer_name||"—"}<br/><small>{r.order?.customer_phone||""}</small><br/><small>{r.order?.created_at?new Date(r.order.created_at).toLocaleString():""}</small></td>
    <td>{r.product_name||r.product_code}<br/><small>{[r.size,r.color].filter(Boolean).join(" / ")||"—"} · Qty {r.quantity}</small><br/><small>Preorder: {statusLabel(r.preorder_status)}</small></td>
    <td>Total: {money(r.total_price)}<br/>Advance: {money(r.advance_amount)}<br/>Balance: {money(r.balance_amount)}<br/><small>Balance: {r.preorder_balance_method||"—"}</small></td>
    <td><b>{statusLabel(r.advance_payment_status)}</b><br/><small>Method: {r.advance_payment_gateway||"not recorded"}</small>{r.advance_payment_verified_at&&<><br/><small>Verified: {new Date(r.advance_payment_verified_at).toLocaleString()}</small></>}</td>
    <td>{r.advance_payment_reference||"No reference submitted"}{r.advance_payment_proof_url&&<><br/><a href={r.advance_payment_proof_url} target="_blank" rel="noopener noreferrer">Open submitted proof</a></>}{r.advance_payment_submitted_at&&<><br/><small>Submitted: {new Date(r.advance_payment_submitted_at).toLocaleString()}</small></>}</td>
    <td>{r.advance_payment_note||"—"}</td>
   </tr>)}
  </tbody></table></div>}
 </section>;
}
