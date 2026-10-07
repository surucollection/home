import React,{useState} from "react";
import { money,supabase } from "../../lib/api.js";
import AdminModal from "./AdminModal.jsx";

export default function AdminCustomersTab({
 customerSearch,setCustomerSearch,customerStatus,setCustomerStatus,
 filteredCustomers,customerDetails,toggleCustomer,selectedCustomer,
 customerEditing,setCustomerEditing,resetCustomerPassword,customerSaving,
 saveCustomer,setSelectedCustomer
}){
 const close=()=>setSelectedCustomer(null);
 const[addressEditing,setAddressEditing]=useState(null);
 const[addressDraft,setAddressDraft]=useState({});
 const[addressSaving,setAddressSaving]=useState(false);
 const editAddress=a=>{setAddressEditing(a.id);setAddressDraft({...a});};
 const cancelAddressEdit=()=>{setAddressEditing(null);setAddressDraft({});};
 const saveAddress=async()=>{
   if(!addressEditing)return;
   setAddressSaving(true);
   try{
     const payload={label:String(addressDraft.label||"").trim()||null,full_name:String(addressDraft.full_name||"").trim(),mobile:String(addressDraft.mobile||"").trim(),address:String(addressDraft.address||"").trim(),city:String(addressDraft.city||"").trim(),district:String(addressDraft.district||"").trim(),province:String(addressDraft.province||"").trim(),postal_code:String(addressDraft.postal_code||"").trim()||null};
     if(!payload.full_name||!payload.mobile||!payload.address||!payload.city||!payload.district||!payload.province)throw Error("Please complete all required address fields.");
     const{data,error}=await supabase.from("customer_addresses").update(payload).eq("id",addressEditing).eq("customer_id",selectedCustomer.id).select("*").single();
     if(error)throw error;
     setSelectedCustomer(c=>({...c,addresses:(c.addresses||[]).map(a=>a.id===data.id?data:a)}));
     cancelAddressEdit();
   }catch(e){alert(e?.message||"Unable to save address.")}finally{setAddressSaving(false)}
 };

 return <><div className="page-title"><div><h2>Customers</h2><p>View registered customer accounts and their order history.</p></div></div>
   <div className="card admin-customer-tab">
     <div className="toolbar">
       <input placeholder="Search name or phone" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)}/>
       <select value={customerStatus} onChange={e=>setCustomerStatus(e.target.value)}><option value="all">All customers</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
     </div>
     <div className="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
       {filteredCustomers.map(c=><tr key={c.id}><td>{c.name||"—"}</td><td>{c.phone||"—"}</td><td>{[c.city,c.district].filter(Boolean).join(", ")||c.address||"—"}</td><td><span className={c.is_active?"badge active":"badge inactive"}>{c.is_active?"Active":"Inactive"}</span></td><td>{c.created_at?new Date(c.created_at).toLocaleDateString():"—"}</td><td><button type="button" className="secondary" onClick={()=>customerDetails(c)}>View</button></td></tr>)}
     </tbody></table></div>
   </div>

   <AdminModal open={!!selectedCustomer} onClose={close} title={selectedCustomer?.name||"Customer"} subtitle="Customer profile, saved addresses and order history" bodyClassName="admin-customer-modal-body" maxWidth="980px"
     footer={customerEditing
       ? <div className="admin-customer-modal-footer-content"><button type="button" className="secondary" onClick={()=>setCustomerEditing(false)} disabled={customerSaving||addressSaving}>Cancel</button><button type="button" className={selectedCustomer?.is_active?"danger":"primary"} onClick={()=>toggleCustomer(selectedCustomer)} disabled={customerSaving||addressSaving}>{selectedCustomer?.is_active?"Deactivate Customer":"Activate Customer"}</button><button type="button" className="primary" onClick={saveCustomer} disabled={customerSaving||addressSaving}>{customerSaving?"Saving…":"Save Customer Details"}</button></div>
       : <div className="admin-customer-modal-footer-content"><button type="button" className="secondary" onClick={()=>setCustomerEditing(true)}>Edit Details</button><button type="button" className={selectedCustomer?.is_active?"danger":"primary"} onClick={()=>toggleCustomer(selectedCustomer)} disabled={customerSaving||addressSaving}>{selectedCustomer?.is_active?"Deactivate Customer":"Activate Customer"}</button><button type="button" className="secondary" onClick={resetCustomerPassword} disabled={customerSaving||addressSaving||!selectedCustomer?.auth_user_id}>Send Magic Link</button><button type="button" className="primary" onClick={close}>Close</button></div>}>
     {selectedCustomer&&<div>
       {customerEditing
         ? <div className="admin-form customer-edit-form admin-customer-compact-form">
             <div className="admin-customer-compact-grid">
               <label>First Name *<input value={selectedCustomer.first_name||""} onChange={e=>setSelectedCustomer({...selectedCustomer,first_name:e.target.value})}/></label>
               <label>Last Name *<input value={selectedCustomer.last_name||""} onChange={e=>setSelectedCustomer({...selectedCustomer,last_name:e.target.value})}/></label>
               <label>Email *<input type="email" value={selectedCustomer.email||""} onChange={e=>setSelectedCustomer({...selectedCustomer,email:e.target.value})}/></label>
               <label>Phone *<input value={selectedCustomer.phone||""} onChange={e=>setSelectedCustomer({...selectedCustomer,phone:e.target.value})}/></label>
             </div>
           </div>
         : <div className="customer-profile-grid customer-profile-compact-grid customer-basic-only">
             {[["Name",selectedCustomer.name],["Email",selectedCustomer.email],["Phone",selectedCustomer.phone]].map(([l,v])=><div key={l}><b>{l}</b><span>{v||"—"}</span></div>)}
           </div>}

       <div className="admin-customer-addresses">
         <div className="admin-customer-orders-heading"><h3>Saved Addresses</h3><span>{(selectedCustomer.addresses||[]).length} address{(selectedCustomer.addresses||[]).length===1?"":"es"}</span></div>
         {(selectedCustomer.addresses||[]).length
           ? <div className="admin-customer-address-list">{selectedCustomer.addresses.map(a=>
             <div className="admin-customer-address-card" key={a.id}>
               {addressEditing===a.id
                 ? <div className="admin-customer-address-edit">
                     <div className="admin-customer-address-edit-grid">
                       <label>Label<input value={addressDraft.label||""} onChange={e=>setAddressDraft({...addressDraft,label:e.target.value})}/></label>
                       <label>Name *<input value={addressDraft.full_name||""} onChange={e=>setAddressDraft({...addressDraft,full_name:e.target.value})}/></label>
                       <label>Mobile *<input value={addressDraft.mobile||""} onChange={e=>setAddressDraft({...addressDraft,mobile:e.target.value})}/></label>
                       <label>Postal Code<input value={addressDraft.postal_code||""} onChange={e=>setAddressDraft({...addressDraft,postal_code:e.target.value})}/></label>
                     </div>
                     <label>Address *<textarea rows="2" value={addressDraft.address||""} onChange={e=>setAddressDraft({...addressDraft,address:e.target.value})}/></label>
                     <div className="admin-customer-address-edit-grid">
                       <label>City *<input value={addressDraft.city||""} onChange={e=>setAddressDraft({...addressDraft,city:e.target.value})}/></label>
                       <label>District *<input value={addressDraft.district||""} onChange={e=>setAddressDraft({...addressDraft,district:e.target.value})}/></label>
                       <label>Province *<input value={addressDraft.province||""} onChange={e=>setAddressDraft({...addressDraft,province:e.target.value})}/></label>
                     </div>
                     <div className="admin-customer-address-actions"><button type="button" className="secondary" onClick={cancelAddressEdit} disabled={addressSaving}>Cancel</button><button type="button" className="primary" onClick={saveAddress} disabled={addressSaving}>{addressSaving?"Saving…":"Save Address"}</button></div>
                   </div>
                 : <div className="admin-customer-address-view">
                     <div className="admin-customer-address-title"><strong>{a.label||"Address"}</strong>{a.is_default&&<span className="badge active">Default</span>}<button type="button" className="secondary" onClick={()=>editAddress(a)}>Edit</button></div>
                     <div className="admin-customer-address-main"><b>{a.full_name||"—"}</b><span>{a.mobile||"—"}</span><span>{a.address||"—"}</span><span>{[a.city,a.district,a.province,a.postal_code].filter(Boolean).join(", ")||"—"}</span></div>
                   </div>}
             </div>
           )}</div>
           : <p className="small-note">No saved addresses found.</p>}
       </div>

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