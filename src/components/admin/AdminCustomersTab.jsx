import React from "react";
import { money } from "../../lib/api.js";
import AdminModal from "./AdminModal.jsx";

export default function AdminCustomersTab({
 customerSearch,setCustomerSearch,customerStatus,setCustomerStatus,
 filteredCustomers,customerDetails,toggleCustomer,selectedCustomer,
 customerEditing,setCustomerEditing,resetCustomerPassword,customerSaving,
 saveCustomer,setSelectedCustomer
}){
 const close=()=>setSelectedCustomer(null);

 return <><div className="page-title"><div><h2>Customers</h2><p>View registered customer accounts and their order history.</p></div></div>
   <div className="card">
     <div className="toolbar">
       <input placeholder="Search name or phone" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)}/>
       <select value={customerStatus} onChange={e=>setCustomerStatus(e.target.value)}><option value="all">All customers</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
     </div>
     <div className="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
       {filteredCustomers.map(c=><tr key={c.id}><td>{c.name||"—"}</td><td>{c.phone||"—"}</td><td>{[c.city,c.district].filter(Boolean).join(", ")||c.address||"—"}</td><td><span className={c.is_active?"badge active":"badge inactive"}>{c.is_active?"Active":"Inactive"}</span></td><td>{c.created_at?new Date(c.created_at).toLocaleDateString():"—"}</td><td><button type="button" className="secondary" onClick={()=>customerDetails(c)}>View</button>{" "}<button type="button" className="danger" onClick={()=>toggleCustomer(c)}>{c.is_active?"Deactivate":"Activate"}</button></td></tr>)}
     </tbody></table></div>
   </div>

   <AdminModal
     open={!!selectedCustomer}
     onClose={close}
     title={selectedCustomer?.name||"Customer"}
     subtitle="Customer profile and order history"
     bodyClassName="admin-customer-modal-body"
     maxWidth="980px"
     footer={customerEditing
       ? <div className="admin-customer-modal-footer-content"><button type="button" className="secondary" onClick={()=>setCustomerEditing(false)} disabled={customerSaving}>Cancel</button><button type="button" className="primary" onClick={saveCustomer} disabled={customerSaving}>{customerSaving?"Saving…":"Save Customer Details"}</button></div>
       : <div className="admin-customer-modal-footer-content"><button type="button" className="secondary" onClick={()=>setCustomerEditing(true)}>Edit Details</button><button type="button" className="secondary" onClick={resetCustomerPassword} disabled={customerSaving||!selectedCustomer?.auth_user_id}>Send Magic Link</button><button type="button" className="primary" onClick={close}>Close</button></div>}
   >
     {selectedCustomer&&<div>
       {customerEditing
         ? <div className="admin-form customer-edit-form admin-customer-compact-form">
             <div className="admin-customer-compact-grid">
               <label>Name *<input value={(selectedCustomer.first_name||"")+" "+(selectedCustomer.last_name||"")} readOnly aria-label="Customer name"/></label>
               <label>Email *<input type="email" value={selectedCustomer.email||""} onChange={e=>setSelectedCustomer({...selectedCustomer,email:e.target.value})}/></label>
               <label>Phone *<input value={selectedCustomer.phone||""} onChange={e=>setSelectedCustomer({...selectedCustomer,phone:e.target.value})}/></label>
               <label>Status<select value={selectedCustomer.is_active?"active":"inactive"} onChange={e=>setSelectedCustomer({...selectedCustomer,is_active:e.target.value==="active"})}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
             </div>
             <label>Delivery Address *<textarea rows="2" value={selectedCustomer.address||""} onChange={e=>setSelectedCustomer({...selectedCustomer,address:e.target.value})}/></label>
             <div className="admin-customer-compact-grid admin-customer-location-grid">
               <label>City *<input value={selectedCustomer.city||""} onChange={e=>setSelectedCustomer({...selectedCustomer,city:e.target.value})}/></label>
               <label>District *<input value={selectedCustomer.district||""} onChange={e=>setSelectedCustomer({...selectedCustomer,district:e.target.value})}/></label>
               <label>Province *<input value={selectedCustomer.province||""} onChange={e=>setSelectedCustomer({...selectedCustomer,province:e.target.value})}/></label>
               <label>Postal Code<input value={selectedCustomer.postal_code||""} onChange={e=>setSelectedCustomer({...selectedCustomer,postal_code:e.target.value})}/></label>
             </div>
           </div>
         : <div className="customer-profile-grid customer-profile-compact-grid">{[
             ["Name",selectedCustomer.name],["Email",selectedCustomer.email],["Phone",selectedCustomer.phone],["Status",selectedCustomer.is_active?"Active":"Inactive"],
             ["City",selectedCustomer.city],["District",selectedCustomer.district],["Province",selectedCustomer.province],["Postal Code",selectedCustomer.postal_code],
             ["Address",selectedCustomer.address]
           ].map(([l,v],i)=><div key={l} className={i===8?"customer-profile-wide":""}><b>{l}</b><span>{v||"—"}</span></div>)}</div>
       }

       <div className="admin-customer-orders">
         <div className="admin-customer-orders-heading"><h3>Order History</h3><span>{selectedCustomer.orders.length} order{selectedCustomer.orders.length===1?"":"s"}</span></div>
         {selectedCustomer.orders.length
           ? <div className="table-wrap"><table className="admin-customer-orders-table"><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>{selectedCustomer.orders.map(o=><tr key={o.id}><td>{o.order_number}</td><td>{new Date(o.created_at).toLocaleString()}</td><td>{money(o.total)}</td><td>{o.payment_method||"—"}</td><td>{o.order_status||"—"}</td></tr>)}</tbody></table></div>
           : <p className="small-note">No orders found.</p>}
       </div>
     </div>}
   </AdminModal>
 </>;
}
