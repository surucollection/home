import React,{useCallback,useEffect,useState} from "react";
import {supabase} from "../lib/api.js";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";

const EMPTY_PROFILE={name:"",email:"",phone:""};

function AccountProfile(){
 const[session,setSession]=useState(null);
 const[profile,setProfile]=useState(null);
 const[editing,setEditing]=useState("");
 const[values,setValues]=useState(EMPTY_PROFILE);
 const[msg,setMsg]=useState("");
 const[msgType,setMsgType]=useState("");
 const[busy,setBusy]=useState(false);
 const[passkeys,setPasskeys]=useState([]);
 const[passkeyChecking,setPasskeyChecking]=useState(true);
 const[passkeyBusy,setPasskeyBusy]=useState(false);
 const[passkeyMsg,setPasskeyMsg]=useState("");
 const[googleLinkBusy,setGoogleLinkBusy]=useState(false);
 const[passwordOpen,setPasswordOpen]=useState(false);
 const[newPassword,setNewPassword]=useState("");
 const[confirmPassword,setConfirmPassword]=useState("");
 const[passwordBusy,setPasswordBusy]=useState(false);
 const[passwordMsg,setPasswordMsg]=useState("");

 const loadWishlist=useCallback(async(customerId)=>{
   if(!customerId){setWishlistItems([]);return}
   setWishlistBusy(true);
   setWishlistMsg("");
   try{
     const{data:saved,error:savedError}=await supabase.from("customer_wishlist")
       .select("product_id,created_at").eq("customer_id",customerId).order("created_at",{ascending:false});
     if(savedError)throw savedError;
     const ids=(saved||[]).map(row=>row.product_id).filter(Boolean);
     if(!ids.length){setWishlistItems([]);return}
     const[productResult,imageResult]=await Promise.all([
       supabase.from("products").select("id,product_code,name,price,compare_at_price,category").in("id",ids).eq("is_active",true),
       supabase.from("product_images").select("id,product_id,image_url,is_main,sort_order,media_type").in("product_id",ids).order("sort_order",{ascending:true})
     ]);
     if(productResult.error)throw productResult.error;
     if(imageResult.error)throw imageResult.error;
     const imageMap=new Map();
     (imageResult.data||[]).forEach(image=>{
       if(image.media_type==="video")return;
       const rows=imageMap.get(image.product_id)||[];
       rows.push(image);
       imageMap.set(image.product_id,rows);
     });
     const byId=new Map((productResult.data||[]).map(product=>{
       const images=imageMap.get(product.id)||[];
       return [product.id,{...product,image:images.find(image=>image.is_main)?.image_url||images[0]?.image_url||""}];
     }));
     setWishlistItems(ids.map(id=>byId.get(id)).filter(Boolean));
   }catch(error){
     setWishlistMsg(error?.message||"Unable to load your saved products.");
   }finally{
     setWishlistBusy(false);
   }
 },[]);

 const removeWishlistItem=async(productId)=>{
   if(!profile?.id)return;
   setWishlistBusy(true);
   setWishlistMsg("");
   try{
     const{error}=await supabase.from("customer_wishlist").delete()
       .eq("customer_id",profile.id).eq("product_id",productId);
     if(error)throw error;
     setWishlistItems(items=>items.filter(item=>item.id!==productId));
     setWishlistMsg("Product removed from your wishlist.");
   }catch(error){
     setWishlistMsg(error?.message||"Could not remove this product.");
   }finally{
     setWishlistBusy(false);
   }
 };

 const isGoogleLinked=!!session?.user?.identities?.some(i=>i.provider==="google");

 useEffect(()=>{
   let active=true;
   (async()=>{
     const{data}=await supabase.auth.getSession();
     if(!data.session){location.href="/login.html?return="+encodeURIComponent(location.pathname+location.search);return}
     if(!active)return;
     setSession(data.session);
     const[{data:p,error:profileError},keyResult]=await Promise.all([
       supabase.from("customers").select("id,name,email,phone").eq("auth_user_id",data.session.user.id).maybeSingle(),
       supabase.auth.passkey.list().catch(error=>({data:null,error}))
     ]);
     if(profileError)throw profileError;
     if(keyResult?.error)console.warn("Unable to check registered passkeys",keyResult.error);
     const keys=Array.isArray(keyResult?.data)?keyResult.data:[];
     const next={name:p?.name||"",email:p?.email||data.session.user.email||"",phone:p?.phone||""};
     setProfile(p||{});
     setValues(next);
     if(p?.id)await loadWishlist(p.id);
     setPasskeys(keys);
     setPasskeyChecking(false);
     if(new URLSearchParams(location.search).get("google_link")==="1"){
       setMsg("Google Sign-In is now linked to your account.");
       setMsgType("success");
     }
   })().catch(e=>{
     if(active){
       setMsg(e?.message||"Unable to load your account.");
       setMsgType("error");
       setPasskeyChecking(false);
     }
   });
   return()=>{active=false};
 },[loadWishlist]);

 useEffect(()=>{
   if(!profile?.id)return undefined;
   const channel=supabase.channel("website-customer-wishlist-"+profile.id)
     .on("postgres_changes",{event:"*",schema:"public",table:"customer_wishlist",filter:"customer_id=eq."+profile.id},()=>loadWishlist(profile.id))
     .subscribe();
   return()=>{supabase.removeChannel(channel)};
 },[profile?.id,loadWishlist]);

 const startEdit=field=>{
   setMsg("");
   setMsgType("");
   setValues(v=>({...v,[field]:field==="email"?(profile?.email||session?.user?.email||""):(profile?.[field]||"")}));
   setEditing(field);
 };
 const cancel=()=>{setEditing("");setMsg("");setMsgType("")};

 const save=async field=>{
   const value=String(values[field]||"").trim();
   if(!value){setMsg("Please enter your "+field+".");setMsgType("error");return}
   if(field==="email"&&!/^\S+@\S+\.\S+$/.test(value)){setMsg("Please enter a valid email address.");setMsgType("error");return}
   if(field==="phone"&&value.length<7){setMsg("Please enter a valid phone number.");setMsgType("error");return}
   setBusy(true);setMsg("");setMsgType("");
   try{
     if(!session?.user?.id)throw Error("Your session has expired. Please sign in again.");
     if(field==="email"){
       const{error}=await supabase.auth.updateUser({email:value});
       if(error)throw error;
     }
     const payload={updated_at:new Date().toISOString()};
     if(field==="name"){
       const parts=value.split(/\s+/);
       payload.name=value;
       payload.first_name=parts[0]||"";
       payload.last_name=parts.slice(1).join(" ");
     }else{
       payload[field]=value;
     }
     const{data,error}=await supabase.from("customers").update(payload).eq("auth_user_id",session.user.id).select("id,name,email,phone").maybeSingle();
     if(error)throw error;
     const nextProfile=data||{...profile,...payload};
     setProfile(nextProfile);
     setValues({name:nextProfile.name||"",email:nextProfile.email||value,phone:nextProfile.phone||""});
     setEditing("");
     setMsg(field==="email"?"Email update requested. Check your new email inbox if confirmation is required.":"Your "+field+" was updated successfully.");
     setMsgType("success");
   }catch(e){
     setMsg(e?.message||"Unable to update your account.");
     setMsgType("error");
   }finally{setBusy(false)}
 };

 const addPasskey=async()=>{
   setPasskeyBusy(true);
   setPasskeyMsg("Starting secure passkey setup…");
   try{
     const{data,error}=await supabase.auth.registerPasskey();
     if(error)throw error;
     if(data){
       setPasskeys(prev=>[...prev.filter(item=>item.id!==data.id),data]);
     }else{
       const{data:keys,error:listError}=await supabase.auth.passkey.list();
       if(listError)throw listError;
       setPasskeys(Array.isArray(keys)?keys:[]);
     }
     setPasskeyMsg("Passkey added successfully.");
   }catch(e){
     setPasskeyMsg(e?.message||"Passkey setup failed.");
   }finally{setPasskeyBusy(false)}
 };

 const deletePasskey=async key=>{
   if(!window.confirm("Delete this passkey? You may no longer be able to sign in with the device that uses it."))return;
   setPasskeyBusy(true);
   setPasskeyMsg("");
   try{
     const{error}=await supabase.auth.passkey.delete({passkeyId:key.id});
     if(error)throw error;
     setPasskeys(prev=>prev.filter(item=>item.id!==key.id));
     setPasskeyMsg("Passkey deleted.");
   }catch(e){
     setPasskeyMsg(e?.message||"Could not delete passkey.");
   }finally{setPasskeyBusy(false)}
 };

 const linkGoogle=async()=>{
   setGoogleLinkBusy(true);
   setMsg("");
   setMsgType("");
   try{
     const{error}=await supabase.auth.linkIdentity({
       provider:"google",
       options:{redirectTo:location.origin+"/account/?google_link=1"}
     });
     if(error)throw error;
   }catch(e){
     setMsg(e?.message||"Google Sign-In could not be connected.");
     setMsgType("error");
     setGoogleLinkBusy(false);
   }
 };

 const changePassword=async e=>{
   e.preventDefault();
   setPasswordMsg("");
   if(newPassword.length<6){setPasswordMsg("Your password must be at least 6 characters.");return}
   if(newPassword!==confirmPassword){setPasswordMsg("Passwords do not match.");return}
   setPasswordBusy(true);
   try{
     const{error}=await supabase.auth.updateUser({password:newPassword});
     if(error)throw error;
     setNewPassword("");
     setConfirmPassword("");
     setPasswordMsg("Password updated successfully.");
   }catch(e){
     setPasswordMsg(e?.message||"Unable to update your password.");
   }finally{setPasswordBusy(false)}
 };

 if(!profile&&!msg)return <><Header/><main className="page"><section className="account-card"><div className="product-loading">Loading account…</div></section></main><Footer/></>;

 return <><Header/><main className="page account-page"><section className="account-card account-profile-only">
   <div className="account-profile-hero">
     <div className="account-profile-identity">
       <span className="account-profile-avatar" aria-hidden="true">{(profile?.name||session?.user?.email||"A").trim().charAt(0).toUpperCase()}</span>
       <div>
         <p className="product-code">CUSTOMER ACCOUNT</p>
         <h1>My Account</h1>
         <p className="account-profile-subtitle">Manage your personal information and sign-in security.</p>
       </div>
     </div>
   </div>

   {msg&&<div className={"message account-profile-message "+(msgType==="error"?"error":"success")} role="status">{msg}</div>}

   <section className="account-section">
     <div className="account-section-heading">
       <div><p className="account-section-kicker">PROFILE</p><h2>Personal information</h2><p>Keep your basic account details up to date.</p></div>
     </div>
     <div className="account-profile-fields">
       {[["name","Name"],["email","Email"],["phone","Phone"]].map(([field,label])=>{
         const display=field==="email"?(profile?.email||session?.user?.email||""):(profile?.[field]||"");
         return <div className="account-profile-field" key={field}>
           <div className="account-profile-field-label">{label}</div>
           {editing===field?
             <div className="account-profile-edit-row">
               <input className="account-profile-input" value={values[field]} onChange={e=>setValues(v=>({...v,[field]:e.target.value}))} type={field==="email"?"email":field==="phone"?"tel":"text"} autoFocus/>
               <div className="account-profile-actions">
                 <button className="btn" type="button" disabled={busy} onClick={()=>save(field)}>{busy?"Saving…":"Update"}</button>
                 <button className="btn secondary" type="button" disabled={busy} onClick={cancel}>Cancel</button>
               </div>
             </div>
             :
             <div className="account-profile-value-row">
               <span>{display||"—"}</span>
               <button className="btn secondary account-profile-update" type="button" onClick={()=>startEdit(field)}>Update</button>
             </div>}
         </div>
       })}
     </div>
   </section>

   <section className="account-section account-wishlist-section">
     <div className="account-section-heading">
       <div><p className="account-section-kicker">SAVED FOR LATER</p><h2>My Wishlist</h2><p>Your saved styles are shared with your Suru Collection app account.</p></div>
       <a className="btn secondary" href="/products.html">Explore Products</a>
     </div>
     {wishlistBusy&&!wishlistItems.length?<p className="account-security-muted">Loading your wishlist…</p>:!wishlistItems.length?<p className="account-security-muted">Your wishlist is empty. Tap the heart on a product to save it here and in the mobile app.</p>:
       <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:14}}>
         {wishlistItems.map(item=><article key={item.id} style={{border:"1px solid var(--border,#e9dfd8)",borderRadius:12,overflow:"hidden",background:"#fff"}}>
           <a href={"/product.html?code="+encodeURIComponent(item.product_code)} style={{display:"block",color:"inherit",textDecoration:"none"}}>
             {item.image?<img src={item.image} alt={item.name} loading="lazy" style={{width:"100%",height:190,objectFit:"cover",display:"block"}}/>:<div style={{height:190,display:"grid",placeItems:"center",background:"#f8f2ee"}}>Suru Collection</div>}
             <div style={{padding:"10px 11px"}}>
               <strong style={{display:"block",fontSize:13,lineHeight:1.4}}>{item.name}</strong>
               <span style={{display:"block",marginTop:6,fontWeight:800,color:"var(--primary,#65413c)"}}>NPR {Number(item.price||0).toLocaleString("en-IN")}</span>
             </div>
           </a>
           <button className="btn secondary" type="button" disabled={wishlistBusy} onClick={()=>removeWishlistItem(item.id)} style={{margin:"0 10px 10px",width:"calc(100% - 20px)"}}>♥ Remove</button>
         </article>)}
       </div>}
     {wishlistMsg&&<div className="message">{wishlistMsg}</div>}
   </section>

   <section className="account-section account-security-section">
     <div className="account-section-heading">
       <div><p className="account-section-kicker">SECURITY</p><h2>Sign-in &amp; security</h2><p>Choose the sign-in methods you want to keep available.</p></div>
     </div>

     <div className="account-security-grid">
       <article className="account-security-card">
         <div className="account-security-icon" aria-hidden="true">⌁</div>
         <div className="account-security-content">
           <div className="account-security-title-row"><h3>Password</h3><span className="account-security-status">Available</span></div>
           <p>Change the password you use for email or mobile sign-in.</p>
           {!passwordOpen?
             <button className="btn secondary account-security-action" type="button" onClick={()=>{setPasswordOpen(true);setPasswordMsg("")}}>Change Password</button>
             :
             <form className="account-password-form" onSubmit={changePassword}>
               <label className="field">New Password<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password" minLength="6" required/></label>
               <label className="field">Confirm New Password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" minLength="6" required/></label>
               <div className="account-profile-actions"><button className="btn" disabled={passwordBusy}>{passwordBusy?"Updating…":"Update Password"}</button><button className="btn secondary" type="button" disabled={passwordBusy} onClick={()=>{setPasswordOpen(false);setNewPassword("");setConfirmPassword("");setPasswordMsg("")}}>Cancel</button></div>
               {passwordMsg&&<div className={"message "+(passwordMsg.toLowerCase().includes("success")?"success":"error")}>{passwordMsg}</div>}
             </form>}
         </div>
       </article>

       <article className="account-security-card">
         <div className="account-security-icon" aria-hidden="true">◉</div>
         <div className="account-security-content">
           <div className="account-security-title-row"><h3>Passkey</h3><span className="account-security-status">{passkeys.length?"Enabled":"Not set up"}</span></div>
           <p>Use Face ID, Touch ID, a device PIN, or your password manager for faster sign-in.</p>
           {passkeyChecking?
             <div className="account-security-muted">Checking saved passkeys…</div>
             :
             <>
               {passkeys.length>0&&<div className="passkey-list">{passkeys.map((key,index)=><div className="passkey-row" key={key.id}><div className="passkey-details"><strong>{key.friendly_name||"Passkey "+(index+1)}</strong><span>{key.created_at?"Added "+new Date(key.created_at).toLocaleDateString():"Registered passkey"}</span></div><button className="passkey-delete-button" type="button" disabled={passkeyBusy} onClick={()=>deletePasskey(key)}>Delete</button></div>)}</div>}
               <button className="btn secondary account-security-action" type="button" disabled={passkeyBusy} onClick={addPasskey}>{passkeyBusy?"Working…":passkeys.length?"Add Another Passkey":"Set Up Passkey"}</button>
               {passkeyMsg&&<div className={"message "+(passkeyMsg.toLowerCase().includes("success")||passkeyMsg.toLowerCase().includes("deleted")?"success":"error")}>{passkeyMsg}</div>}
             </>}
         </div>
       </article>

       <article className="account-security-card account-google-security-card">
         <div className="account-security-icon google-security-g" aria-hidden="true">G</div>
         <div className="account-security-content">
           <div className="account-security-title-row"><h3>Google Sign-In</h3><span className="account-security-status">{isGoogleLinked?"Linked":"Not linked"}</span></div>
           <p>{isGoogleLinked?"Your Google account is connected and can be used with this Suru Collection account.":"Connect Google for another convenient sign-in option."}</p>
           <button className="btn secondary account-security-action" type="button" disabled={googleLinkBusy||isGoogleLinked} onClick={linkGoogle}>{googleLinkBusy?"Connecting…":isGoogleLinked?"Google Linked":"Connect Google"}</button>
         </div>
       </article>
     </div>
   </section>
 </section></main><Footer/></>;
}

export default AccountProfile;
