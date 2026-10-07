import React,{useEffect,useState} from "react";
import {supabase} from "../lib/api.js";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";

function AccountProfile(){
 const[session,setSession]=useState(null);
 const[profile,setProfile]=useState(null);
 const[editing,setEditing]=useState("");
 const[values,setValues]=useState({name:"",email:"",phone:""});
 const[msg,setMsg]=useState("");
 const[busy,setBusy]=useState(false);

 useEffect(()=>{(async()=>{
   const{data}=await supabase.auth.getSession();
   if(!data.session){location.href="/login.html?return="+encodeURIComponent(location.pathname+location.search);return}
   setSession(data.session);
   const{data:p,error}=await supabase.from("customers").select("id,name,email,phone").eq("auth_user_id",data.session.user.id).maybeSingle();
   if(error)throw error;
   const next={name:p?.name||"",email:p?.email||data.session.user.email||"",phone:p?.phone||""};
   setProfile(p||{});
   setValues(next);
 })().catch(e=>setMsg(e?.message||"Unable to load your account."))},[]);

 const startEdit=field=>{
   setMsg("");
   setValues(v=>({...v,[field]:field==="email"?(profile?.email||session?.user?.email||""):(profile?.[field]||"")}));
   setEditing(field);
 };
 const cancel=()=>{setEditing("");setMsg("")};

 const save=async field=>{
   const value=String(values[field]||"").trim();
   if(!value){setMsg("Please enter your "+field+".");return}
   if(field==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){setMsg("Please enter a valid email address.");return}
   if(field==="phone"&&value.length<7){setMsg("Please enter a valid phone number.");return}
   setBusy(true);setMsg("");
   try{
     if(!session?.user?.id)throw Error("Your session has expired. Please sign in again.");
     if(field==="email"){
       const{error}=await supabase.auth.updateUser({email:value});
       if(error)throw error;
     }
     const payload={updated_at:new Date().toISOString()};
     if(field==="name"){
       const parts=value.split(/\s+/);
       payload.name=value;payload.first_name=parts[0]||"";payload.last_name=parts.slice(1).join(" ");
     }else payload[field]=value;
     const{data,error}=await supabase.from("customers").update(payload).eq("auth_user_id",session.user.id).select("id,name,email,phone").maybeSingle();
     if(error)throw error;
     const nextProfile=data||{...profile,...payload};
     setProfile(nextProfile);
     setValues({name:nextProfile.name||"",email:nextProfile.email||value,phone:nextProfile.phone||""});
     setEditing("");
     setMsg(field==="email"?"Email update requested. Check your new email inbox if confirmation is required.":"Your "+field+" was updated successfully.");
   }catch(e){setMsg(e?.message||"Unable to update your account.")}
   finally{setBusy(false)}
 };

 if(!profile&&!msg)return <><Header/><main className="page"><section className="account-card"><div className="product-loading">Loading account…</div></section></main><Footer/></>;
 return <><Header/><main className="page"><section className="account-card account-profile-only">
   <div className="account-profile-heading"><div><p className="product-code">MY ACCOUNT</p><h1>My Account</h1><p className="form-note">Update your basic account information below.</p></div></div>
   {msg&&<div className={"message"+(msg.toLowerCase().includes("unable")||msg.toLowerCase().includes("valid")||msg.toLowerCase().includes("expired")?" error":"")}>{msg}</div>}
   <div className="account-profile-fields">
     {[["name","Name"],["email","Email"],["phone","Phone"]].map(([field,label])=>{
       const display=field==="email"?(profile?.email||session?.user?.email||""):(profile?.[field]||"");
       return <div className="account-profile-field" key={field}>
         <div className="account-profile-field-label">{label}</div>
         {editing===field?<div className="account-profile-edit-row"><input className="field" value={values[field]} onChange={e=>setValues(v=>({...v,[field]:e.target.value}))} type={field==="email"?"email":field==="phone"?"tel":"text"} autoFocus/><div className="account-profile-actions"><button className="btn" type="button" disabled={busy} onClick={()=>save(field)}>{busy?"Saving…":"Update"}</button><button className="btn secondary" type="button" disabled={busy} onClick={cancel}>Cancel</button></div></div>:<div className="account-profile-value-row"><span>{display||"—"}</span><button className="btn secondary account-profile-update" type="button" onClick={()=>startEdit(field)}>Update</button></div>}
       </div>
     })}
   </div>
   <button className="btn secondary" type="button" onClick={async()=>{await supabase.auth.signOut();location.href="/login.html"}}>Logout</button>
 </section></main><Footer/></>;
}
export default AccountProfile;
