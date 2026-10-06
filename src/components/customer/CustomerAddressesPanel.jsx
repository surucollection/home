import React,{useEffect,useMemo,useState} from "react";
import { supabase } from "../../lib/api.js";

const emptyDraft=profile=>({
  label:"Home",full_name:String(profile?.name||"").trim(),phone:String(profile?.phone||"").trim(),
  address:String(profile?.address||"").trim(),city:String(profile?.city||"").trim(),
  district:String(profile?.district||"").trim(),province:String(profile?.province||"").trim(),
  postal_code:String(profile?.postal_code||"").trim(),is_default:false
});

export default function CustomerAddressesPanel({customerId,profile,provinces=[],provinceDistricts=()=>[],canonicalProvince=v=>String(v||""),mode="manage",selectedAddressId="",onSelect=()=>{}}){
 const[addresses,setAddresses]=useState([]),[draft,setDraft]=useState(()=>emptyDraft(profile)),[editingId,setEditingId]=useState(""),[formOpen,setFormOpen]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const load=async()=>{
  if(!customerId)return;
  const{data,error}=await supabase.from("customer_addresses").select("id,customer_id,label,full_name,phone,address,city,district,province,postal_code,is_default,created_at,updated_at").eq("customer_id",customerId).order("is_default",{ascending:false}).order("created_at",{ascending:true});
  if(error){setMsg(error.message);return}
  const rows=Array.isArray(data)?data:[];setAddresses(rows);
  if(mode==="select"){const selected=rows.find(x=>x.id===selectedAddressId)||rows.find(x=>x.is_default)||rows[0];if(selected)onSelect(selected)}
 };
 useEffect(()=>{void load()},[customerId]);
 const canSubmit=useMemo(()=>Boolean(draft.label.trim()&&draft.full_name.trim()&&draft.phone.trim()&&draft.address.trim()&&draft.city.trim()&&draft.district.trim()&&draft.province.trim()),[draft]);
 const startAdd=()=>{setEditingId("");setDraft({...emptyDraft(profile),is_default:addresses.length===0});setMsg("");setFormOpen(true)};
 const startEdit=a=>{setEditingId(a.id);setDraft({label:a.label||"Home",full_name:a.full_name||"",phone:a.phone||"",address:a.address||"",city:a.city||"",district:a.district||"",province:canonicalProvince(a.province),postal_code:a.postal_code||"",is_default:!!a.is_default});setMsg("");setFormOpen(true)};
 const closeForm=()=>{if(!busy){setFormOpen(false);setEditingId("");setMsg("")}};
 const save=async e=>{
  e.preventDefault();if(!canSubmit){setMsg("Please fill in all required address fields.");return}setBusy(true);setMsg("");
  try{const{data,error}=await supabase.rpc("save_customer_address",{p_address_id:editingId||null,p_label:draft.label.trim(),p_full_name:draft.full_name.trim(),p_phone:draft.phone.trim(),p_address:draft.address.trim(),p_city:draft.city.trim(),p_district:draft.district.trim(),p_province:canonicalProvince(draft.province),p_postal_code:draft.postal_code.trim()||null,p_is_default:!!draft.is_default});if(error)throw error;
   setFormOpen(false);setEditingId("");if(data&&mode==="select")onSelect(data);setMsg(editingId?"Address updated successfully.":"Address added successfully.");await load();
  }catch(error){setMsg(error?.message||"Unable to save this address.")}finally{setBusy(false)}
 };
 const makeDefault=async a=>{setBusy(true);setMsg("");try{const{data,error}=await supabase.rpc("save_customer_address",{p_address_id:a.id,p_label:a.label||"Home",p_full_name:a.full_name||"",p_phone:a.phone||"",p_address:a.address||"",p_city:a.city||"",p_district:a.district||"",p_province:canonicalProvince(a.province),p_postal_code:a.postal_code||null,p_is_default:true});if(error)throw error;if(data)onSelect(data);setMsg("Default address updated.");await load()}catch(error){setMsg(error?.message||"Unable to set the default address.")}finally{setBusy(false)}};
 const remove=async a=>{if(!window.confirm("Delete this saved address? This cannot be undone."))return;setBusy(true);setMsg("");try{const{error}=await supabase.rpc("delete_customer_address",{p_address_id:a.id});if(error)throw error;setMsg("Address deleted.");await load()}catch(error){setMsg(error?.message||"Unable to delete this address.")}finally{setBusy(false)}};
 const choose=a=>{if(mode==="select"){onSelect(a);setMsg("")}};
 const modal=formOpen?<div className="address-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeForm()}}><div className="address-modal" role="dialog" aria-modal="true" aria-labelledby="address-modal-title">
  <div className="address-form-heading"><div><h3 id="address-modal-title">{editingId?"Edit Address":"Add New Address"}</h3><p className="form-note">Update your saved delivery address.</p></div><button className="secondary" type="button" onClick={closeForm} disabled={busy}>Close</button></div>
  <form className="address-form-grid" onSubmit={save}>
   <label className="field">Address Label <span className="required-star">*</span><input value={draft.label} onChange={e=>setDraft({...draft,label:e.target.value})} placeholder="Home, Office, Family" required/></label>
   <label className="field">Full Name <span className="required-star">*</span><input value={draft.full_name} onChange={e=>setDraft({...draft,full_name:e.target.value})} required/></label>
   <label className="field">Phone Number <span className="required-star">*</span><input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} inputMode="tel" required/></label>
   <label className="field address-wide">Delivery Address <span className="required-star">*</span><textarea rows="3" value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})} required/></label>
   <label className="field">Province <span className="required-star">*</span><select value={canonicalProvince(draft.province)} onChange={e=>setDraft({...draft,province:e.target.value,district:""})} required><option value="">Select Province</option>{provinces.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
   <label className="field">District <span className="required-star">*</span><select value={draft.district||""} onChange={e=>setDraft({...draft,district:e.target.value})} disabled={!canonicalProvince(draft.province)} required><option value="">{canonicalProvince(draft.province)?"Select District":"Select Province First"}</option>{provinceDistricts(canonicalProvince(draft.province)).map(d=><option key={d} value={d}>{d}</option>)}</select></label>
   <label className="field">City / Municipality <span className="required-star">*</span><input value={draft.city} onChange={e=>setDraft({...draft,city:e.target.value})} required/></label>
   <label className="field">Postal Code <span className="optional-label">(Optional)</span><input value={draft.postal_code} onChange={e=>setDraft({...draft,postal_code:e.target.value})} inputMode="numeric"/></label>
   <label className="address-default-check"><input type="checkbox" checked={!!draft.is_default} onChange={e=>setDraft({...draft,is_default:e.target.checked})} disabled={addresses.length===0&&!editingId}/><span>Set as default address</span></label>
   <div className="address-form-actions"><button className="btn" disabled={busy||!canSubmit}>{busy?"Saving…":editingId?"Save Address":"Add Address"}</button><button className="btn secondary" type="button" onClick={closeForm} disabled={busy}>Cancel</button></div>
  </form>
 </div></div>:null;

 return <div className={mode==="select"?"customer-addresses-panel address-selector-panel":"customer-addresses-panel"}>
  {mode==="manage"&&<div className="addresses-panel-heading"><div><h2>Saved Addresses</h2><p className="form-note">Save Home, Office, Family or other delivery addresses for faster checkout.</p></div><button className="btn" type="button" onClick={startAdd} disabled={busy}>+ Add New Address</button></div>}
  {mode==="select"&&<div className="addresses-panel-heading"><div><h3>Delivery Address</h3><p className="form-note">Select a saved address. You can edit the selected address when needed.</p></div><button className="btn secondary" type="button" onClick={startAdd} disabled={busy}>+ Add New Address</button></div>}
  {msg&&<div className="message" role="status">{msg}</div>}
  {addresses.length===0&&<div className="addresses-empty"><strong>No saved addresses yet.</strong><span>Add an address to continue checkout.</span>{mode==="manage"&&<button className="btn secondary" type="button" onClick={startAdd}>Add Your First Address</button>}</div>}
  {addresses.length>0&&<div className="addresses-list">{addresses.map(a=>{const selected=mode==="select"&&a.id===selectedAddressId;return <article key={a.id} className={"saved-address-card"+(selected?" selected":"")} onClick={()=>choose(a)} role={mode==="select"?"button":undefined} tabIndex={mode==="select"?0:undefined}>
   <div className="saved-address-top"><div><span className="saved-address-label">{a.label||"Address"}</span>{a.is_default&&<span className="saved-address-default">Default</span>}</div>{mode==="select"&&<span className={"saved-address-radio"+(selected?" checked":"")}>{selected?"●":"○"}</span>}</div>
   <div className="saved-address-summary"><strong>{a.full_name}</strong><span>{a.phone}</span><span>{a.address}, {[a.city,a.district,a.province,a.postal_code].filter(Boolean).join(", ")}</span></div>
   <div className="saved-address-actions">{mode==="manage"&&!a.is_default&&<button className="btn secondary" type="button" disabled={busy} onClick={e=>{e.stopPropagation();void makeDefault(a)}}>Set Default</button>}<button className="btn secondary" type="button" disabled={busy} onClick={e=>{e.stopPropagation();startEdit(a)}}>Edit</button>{mode==="manage"&&<button className="btn danger" type="button" disabled={busy} onClick={e=>{e.stopPropagation();void remove(a)}}>Delete</button>}</div>
  </article>})}</div>}
  {modal}
 </div>;
}
