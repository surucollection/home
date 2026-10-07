import React,{useState} from "react";
import { money,supabase } from "../../lib/api.js";
import AdminModal from "./AdminModal.jsx";
const NEPAL_PROVINCES=[
  "Koshi","Madhesh","Bagmati","Gandaki","Lumbini","Karnali","Sudurpashchim"
];
const NEPAL_DISTRICTS={
  Koshi:["Bhojpur","Dhankuta","Ilam","Jhapa","Khotang","Morang","Okhaldhunga","Panchthar","Sankhuwasabha","Solukhumbu","Sunsari","Taplejung","Terhathum","Udayapur"],
  Madhesh:["Bara","Dhanusha","Mahottari","Parsa","Rautahat","Saptari","Sarlahi","Siraha"],
  Bagmati:["Bhaktapur","Chitwan","Dhading","Dolakha","Kathmandu","Kavrepalanchok","Lalitpur","Makwanpur","Nuwakot","Ramechhap","Rasuwa","Sindhuli","Sindhupalchok"],
  Gandaki:["Baglung","Gorkha","Kaski","Lamjung","Manang","Mustang","Myagdi","Nawalpur","Parbat","Syangja","Tanahun"],
  Lumbini:["Arghakhanchi","Banke","Bardiya","Dang","Gulmi","Kapilvastu","Palpa","Pyuthan","Rolpa","Rukum East","Rupandehi"],
  Karnali:["Dailekh","Dolpa","Humla","Jajarkot","Jumla","Kalikot","Mugu","Rukum West","Salyan","Surkhet"],
  Sudurpashchim:["Achham","Baitadi","Bajhang","Bajura","Dadeldhura","Darchula","Doti","Kailali","Kanchanpur"]
};
const districtOptions=province=>(NEPAL_DISTRICTS[province]||[]); 


export default function AdminCustomersTab({
 customerSearch,setCustomerSearch,customerStatus,setCustomerStatus,
 filteredCustomers,customerDetails,toggleCustomer,selectedCustomer,
 customerEditing,setCustomerEditing,resetCustomerPassword,customerSaving,
 saveCustomer,setSelectedCustomer
}){
 const close=()=>setSelectedCustomer(null);
 const[addressEditing,setAddressEditing]=useState(null);
 const[addressDraft,setAddressDraft]=useState({});
 const[addressSaving,setAddressSaving]=useState(false),[addressMessage,setAddressMessage]=useState("");
 const editAddress=a=>{setAddressMessage("");setAddressEditing(a.id);setAddressDraft({...a,phone:a.phone||""});};
 const addAddress=()=>{setAddressMessage("");setAddressEditing("new");setAddressDraft({label:"",full_name:selectedCustomer?.name||"",phone:selectedCustomer?.phone||"",address:"",city:"",district:"",province:"",postal_code:"",is_default:!(selectedCustomer?.addresses||[]).length});};
 const cancelAddressEdit=()=>{setAddressEditing(null);setAddressDraft({});};
 const saveAddress=async()=>{
   if(!addressEditing)return;
   setAddressSaving(true);
   setAddressMessage("");
   try{
     const payload={label:String(addressDraft.label||"").trim()||"Home",full_name:String(addressDraft.full_name||"").trim(),phone:String(addressDraft.phone||"").trim(),address:String(addressDraft.address||"").trim(),city:String(addressDraft.city||"").trim(),district:String(addressDraft.district||"").trim(),province:String(addressDraft.province||"").trim(),postal_code:String(addressDraft.postal_code||"").trim()||null};
     if(!payload.full_name||!payload.phone||!payload.address||!payload.city||!payload.district||!payload.province)throw Error("Please complete all required address fields.");
     const makeDefault=!!addressDraft.is_default;
     if(makeDefault) {
       const{error:clearError}=await supabase.from("customer_addresses").update({is_default:false}).eq("customer_id",selectedCustomer.id).eq("is_default",true);
       if(clearError)throw clearError;
     }
     let data,error;
     if(addressEditing==="new"){
       ({data,error}=await supabase.from("customer_addresses").insert({...payload,customer_id:selectedCustomer.id,is_default:makeDefault||!(selectedCustomer.addresses||[]).length}).select("*").single());
     }else{
       ({data,error}=await supabase.from("customer_addresses").update({...payload,is_default:makeDefault}).eq("id",addressEditing).eq("customer_id",selectedCustomer.id).select("*").single());
     }
     if(error)throw error;
     setSelectedCustomer(c=>({...c,addresses:addressEditing==="new"?[...(c.addresses||[]),data]:(c.addresses||[]).map(a=>a.id===data.id?data:a)}));
     cancelAddressEdit();
     setAddressMessage(addressEditing==="new"?"Address saved successfully.":"Address updated successfully.");
     window.setTimeout(()=>setAddressMessage(""),3000);
   }catch(e){
     setAddressMessage(e?.message||"Unable to save address.");
     window.setTimeout(()=>setAddressMessage(""),4000);
   }finally{setAddressSaving(false)}
 };

 return <><div className="page-title"><div><h2>Customers</h2><p>View registered customer accounts and their order history.</p></div></div>
   <div className="card admin-customer-tab">
     <div className="toolbar">
       <input placeholder="Search name or phone" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)}/>
       <select value={customerStatus} onChange={e=>setCustomerStatus(e.target.value)}><option value="all">All customers</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
     </div>
     <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Status</th><th>Joined</th></tr></thead><tbody>
       {filteredCustomers.map(c=><tr key={c.id}><td><button type="button" className="admin-customer-name-link" onClick={()=>customerDetails(c)}>{c.name||"—"}{c.district&&<span className="admin-customer-district">, {c.district}</span>}</button></td><td>{c.phone||"—"}</td><td><span className={c.is_active?"badge active":"badge inactive"}>{c.is_active?"Active":"Inactive"}</span></td><td>{c.created_at?new Date(c.created_at).toLocaleDateString():"—"}</td></tr>)}
     </tbody></table></div>
   </div>

   <AdminModal open={!!selectedCustomer&&addressEditing!=="new"} onClose={close} title={selectedCustomer?.name||"Customer"} subtitle="Customer profile, saved addresses and order history" bodyClassName="admin-customer-modal-body" maxWidth="980px"
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

       <div className="admin-customer-addresses">{addressMessage&&<div className={"admin-customer-address-message "+(addressMessage.toLowerCase().includes("success")?"success":"error")} role="status">{addressMessage}</div>}
         <div className="admin-customer-orders-heading"><h3>Saved Addresses</h3><div className="admin-customer-address-heading-actions"><span>{(selectedCustomer.addresses||[]).length} address{(selectedCustomer.addresses||[]).length===1?"":"es"}</span><button type="button" className="primary" onClick={addAddress} disabled={addressSaving||addressEditing!==null}>+ Add Address</button></div></div>
         {(selectedCustomer.addresses||[]).length
           ? <div className="admin-customer-address-list">{selectedCustomer.addresses.map(a=>
             <div className="admin-customer-address-card" key={a.id}>
               {addressEditing===a.id
                 ? <div className="admin-customer-address-edit">
                     <div className="admin-customer-address-edit-grid">
                       <label>Label<input value={addressDraft.label||""} onChange={e=>setAddressDraft({...addressDraft,label:e.target.value})}/></label>
                       <label>Name *<input value={addressDraft.full_name||""} onChange={e=>setAddressDraft({...addressDraft,full_name:e.target.value})}/></label>
                       <label>Mobile *<input value={addressDraft.phone||""} onChange={e=>setAddressDraft({...addressDraft,phone:e.target.value})}/></label>
                       <label>Postal Code<input value={addressDraft.postal_code||""} onChange={e=>setAddressDraft({...addressDraft,postal_code:e.target.value})}/></label>
                     </div>
                     <label>Address *<textarea rows="2" value={addressDraft.address||""} onChange={e=>setAddressDraft({...addressDraft,address:e.target.value})}/></label>
                     <div className="admin-customer-address-edit-grid">
                       <label>Province *<select value={addressDraft.province||""} onChange={e=>setAddressDraft({...addressDraft,province:e.target.value,district:""})}><option value="">Select province</option>{NEPAL_PROVINCES.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
                       <label>District *<select value={addressDraft.district||""} onChange={e=>setAddressDraft({...addressDraft,district:e.target.value})} disabled={!addressDraft.province}><option value="">Select district</option>{districtOptions(addressDraft.province).map(d=><option key={d} value={d}>{d}</option>)}</select></label>
                       <label>City *<input value={addressDraft.city||""} onChange={e=>setAddressDraft({...addressDraft,city:e.target.value})}/></label>
                     </div>
                     <label className="admin-customer-address-default"><input type="checkbox" checked={!!addressDraft.is_default} onChange={e=>setAddressDraft({...addressDraft,is_default:e.target.checked})}/> Default address</label><div className="admin-customer-address-actions"><button type="button" className="secondary" onClick={cancelAddressEdit} disabled={addressSaving}>Cancel</button><button type="button" className="primary" onClick={saveAddress} disabled={addressSaving}>{addressSaving?"Saving…":"Save Address"}</button></div>
                   </div>
                 : <div className="admin-customer-address-view">
                     <div className="admin-customer-address-title"><strong>{a.label||"Address"}</strong>{a.is_default&&<span className="badge active">Default</span>}<button type="button" className="secondary" onClick={()=>editAddress(a)}>Edit</button></div>
                     <div className="admin-customer-address-main"><b>{a.full_name||"—"}</b><span>{a.phone||"—"}</span><span>{a.address||"—"}</span><span>{[a.city,a.district,a.province,a.postal_code].filter(Boolean).join(", ")||"—"}</span></div>
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

   <AdminModal open={!!selectedCustomer&&addressEditing==="new"} onClose={cancelAddressEdit} closeDisabled={addressSaving} title="Add Customer Address" subtitle={"Add a new saved address for "+(selectedCustomer?.name||"customer")} backdropClassName="admin-modal-layer-backdrop" shellClassName="admin-modal-layer-shell" maxWidth="720px"
     footer={<div className="admin-customer-modal-footer-content"><button type="button" className="secondary" onClick={cancelAddressEdit} disabled={addressSaving}>Cancel</button><button type="button" className="primary" onClick={saveAddress} disabled={addressSaving}>{addressSaving?"Saving…":"Save Address"}</button></div>}>
     <div className="admin-customer-address-edit admin-customer-address-add-form">
       <div className="admin-customer-address-edit-grid">
         <label>Label<input value={addressDraft.label||""} onChange={e=>setAddressDraft({...addressDraft,label:e.target.value})} placeholder="Home, Office, etc."/></label>
         <label>Name *<input value={addressDraft.full_name||""} onChange={e=>setAddressDraft({...addressDraft,full_name:e.target.value})}/></label>
         <label>Mobile *<input value={addressDraft.phone||""} onChange={e=>setAddressDraft({...addressDraft,phone:e.target.value})}/></label>
         <label>Postal Code<input value={addressDraft.postal_code||""} onChange={e=>setAddressDraft({...addressDraft,postal_code:e.target.value})}/></label>
       </div>
       <label>Address *<textarea rows="3" value={addressDraft.address||""} onChange={e=>setAddressDraft({...addressDraft,address:e.target.value})}/></label>
       <div className="admin-customer-address-edit-grid">
         <label>Province *<select value={addressDraft.province||""} onChange={e=>setAddressDraft({...addressDraft,province:e.target.value,district:""})}><option value="">Select province</option>{NEPAL_PROVINCES.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
         <label>District *<select value={addressDraft.district||""} onChange={e=>setAddressDraft({...addressDraft,district:e.target.value})} disabled={!addressDraft.province}><option value="">Select district</option>{districtOptions(addressDraft.province).map(d=><option key={d} value={d}>{d}</option>)}</select></label>
         <label>City *<input value={addressDraft.city||""} onChange={e=>setAddressDraft({...addressDraft,city:e.target.value})}/></label>
       </div>
       <label className="admin-customer-address-default"><input type="checkbox" checked={!!addressDraft.is_default} onChange={e=>setAddressDraft({...addressDraft,is_default:e.target.checked})}/> Default address</label>
     </div>
   </AdminModal> </>;
}