import React,{useEffect,useMemo,useRef,useState} from "react";
import QRCode from "qrcode";
import { supabase, get, money, norm, imageUrl } from "../lib/api.js";
import { readCart, addCart, removeCart, clearCart, cartKey } from "../lib/cart.js";
import { openInvoice, openCustomerInvoice } from "../lib/invoice.js";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import Hero from "../components/Hero.jsx";
import CollectionCard from "../components/CollectionCard.jsx";
import ProductsGrid from "../components/ProductsGrid.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import OrderTable from "../components/admin/OrderTable.jsx";
import ProductAdminCard from "../components/admin/ProductAdminCard.jsx";
import StockRow from "../components/admin/StockRow.jsx";
import PreorderAdminQueue from "../components/admin/PreorderAdminQueue.jsx";
import CustomerAddressesPanel from "../components/customer/CustomerAddressesPanel.jsx";
import { SIZE_ORDER,sizeRank,getNcmBranches,ncmNorm,ncmCoords,ncmDistanceKm,ncmFieldTokens,ncmWordMatch,matchNcmBranch,cats,NEPAL_PROVINCES,provinceDistricts,canonicalProvince,offerPasskeyPrompt,normalizeNepalPhone } from "../lib/appShared.js";

function Register(){
 const[verifyMethod,setVerifyMethod]=useState("email"),[f,setF]=useState({first_name:"",last_name:"",email:"",password:"",confirm:"",phone:"",address:"",city:"",district:"",province:"",postal_code:""}),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[otp,setOtp]=useState(""),[otpStep,setOtpStep]=useState(false),[registeredPhone,setRegisteredPhone]=useState(""),[pendingUser,setPendingUser]=useState(null);
 async function googleSignIn(){setBusy(true);setMsg("Redirecting to Google account creation…");const{error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/login/?return=%2Faccount%2F"}});if(error){setMsg(error.message||"Google sign-up could not be started.");setBusy(false)}}
 const change=e=>{const{name,value}=e.target;if(name==="province")setF({...f,province:value,district:""});else if(name==="phone")setF({...f,phone:value.replace(/\D/g,"").slice(0,10)});else setF({...f,[name]:value});};
 async function createAccount(e){
   e.preventDefault();
   if(!f.first_name.trim()||!f.last_name.trim()||!f.address.trim()||!f.city.trim()||!f.district.trim()||!f.province.trim())return setMsg("Please fill in all required fields.");
   if(verifyMethod==="email"&&!f.email.trim())return setMsg("Enter an email address to receive your verification code.");
   if(!f.phone.trim())return setMsg("Enter your mobile number.");
   if(f.password.length<6)return setMsg("Password must be at least 6 characters.");
   if(f.password!==f.confirm)return setMsg("Passwords do not match.");
   const phone=f.phone.trim()?normalizeNepalPhone(f.phone):"";
   if(!/^\+9779\d{9}$/.test(phone))return setMsg("Please enter a valid Nepal mobile number.");
   setBusy(true);setMsg("Creating your account and sending OTP…");
   const metadata={name:(f.first_name.trim()+" "+f.last_name.trim()).trim(),first_name:f.first_name.trim(),last_name:f.last_name.trim(),email:f.email.trim().toLowerCase()||null,phone:phone||null,address:f.address.trim(),city:f.city.trim(),district:f.district.trim(),province:f.province.trim(),postal_code:f.postal_code.trim()||null};
   const result=verifyMethod==="mobile"
     ?await supabase.auth.signUp({phone,password:f.password,options:{channel:"whatsapp",data:metadata}})
     :await supabase.auth.signUp({email:f.email.trim().toLowerCase(),password:f.password,options:{data:metadata}});
   const{data,error}=result;
   if(error){setMsg(error.message);setBusy(false);return}
   if(!data?.user){setMsg("Unable to start registration. Please try again.");setBusy(false);return}
   setRegisteredPhone(phone);setPendingUser(data.user);setOtp("");setOtpStep(true);
   setMsg(verifyMethod==="mobile"?"WhatsApp OTP sent to "+phone+". Enter the 6-digit code to complete registration.":"Email OTP sent to "+f.email.trim()+". Enter the 6-digit code to complete registration.");
   setBusy(false);
 }
 async function verifyRegistration(e){
   e.preventDefault();const token=otp.trim();
   if(!/^\d{6}$/.test(token)){setMsg("Please enter the 6-digit OTP.");return}
   setBusy(true);setMsg(verifyMethod==="mobile"?"Verifying mobile number…":"Verifying email address…");
   const{data,error}=verifyMethod==="mobile"
     ?await supabase.auth.verifyOtp({phone:registeredPhone,token,type:"sms"})
     :await supabase.auth.verifyOtp({email:f.email.trim().toLowerCase(),token,type:"signup"});
   if(error){setMsg(error.message||"Invalid or expired OTP.");setBusy(false);return}
   const user=data?.user||pendingUser;
   if(!user){setMsg("Verification succeeded, but the account session could not be loaded. Please sign in.");setBusy(false);return}
   const{data:customerId,error:profileError}=await supabase.rpc("link_verified_customer",{p_name:(f.first_name.trim()+" "+f.last_name.trim()).trim(),p_first_name:f.first_name.trim(),p_last_name:f.last_name.trim(),p_email:f.email.trim().toLowerCase()||null,p_phone:registeredPhone||null,p_address:f.address.trim(),p_city:f.city.trim(),p_district:f.district.trim(),p_province:f.province.trim(),p_postal_code:f.postal_code.trim()||null});
   if(profileError){setMsg(profileError.message);setBusy(false);return}
   if(customerId){const{error:addressError}=await supabase.rpc("save_customer_address",{p_address_id:null,p_label:"Home",p_full_name:(f.first_name.trim()+" "+f.last_name.trim()).trim(),p_phone:registeredPhone,p_address:f.address.trim(),p_city:f.city.trim(),p_district:f.district.trim(),p_province:canonicalProvince(f.province),p_postal_code:f.postal_code.trim()||null,p_is_default:true});if(addressError)console.warn("Registration address could not be saved separately:",addressError)}
   setMsg((verifyMethod==="mobile"?"Mobile number":"Email address")+" verified. Your account is ready.");
   await offerPasskeyPrompt(user.id);location.href="account/";
 }
 async function resendOtp(){
   if(busy)return;
   setBusy(true);setMsg("Sending a new OTP…");
   const{error}=verifyMethod==="mobile"
     ?await supabase.auth.resend({type:"sms",phone:registeredPhone,options:{channel:"whatsapp"}})
     :await supabase.auth.resend({type:"signup",email:f.email.trim().toLowerCase()});
   setMsg(error?error.message:verifyMethod==="mobile"?"A new OTP has been sent to "+registeredPhone+".":"A new OTP has been sent to "+f.email.trim()+".");
   setBusy(false);
 }
 if(otpStep)return <AuthLayout title={verifyMethod==="mobile"?"Verify Mobile Number":"Verify Email Address"}><p className="auth-intro">Enter the 6-digit OTP sent to <b>{verifyMethod==="mobile"?registeredPhone:f.email.trim()}</b> to finish creating your account.</p><form onSubmit={verifyRegistration}><label className="field">OTP <span className="required-star">*</span><input type="text" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" maxLength="6" required autoFocus/></label><button className="btn" disabled={busy}>{busy?"Verifying…":"Verify & Create Account"}</button>{msg&&<div className={msg.toLowerCase().includes("verified")?"message success":"message error"}>{msg}</div>}</form><div className="auth-links"><button type="button" className="text-button" onClick={resendOtp} disabled={busy}>Resend OTP</button> · <button type="button" className="text-button" onClick={()=>{supabase.auth.signOut();setOtpStep(false);setMsg("");}}>Change Details</button></div></AuthLayout>;
 return <AuthLayout title="Create Account"><p className="auth-intro">Create your account and verify either your email address or mobile number with a one-time code.</p><div className="login-method-switch" role="group" aria-label="Verification method"><button type="button" className={verifyMethod==="email"?"active":""} onClick={()=>{setVerifyMethod("email");setMsg("");}}>Email OTP</button><button type="button" className={verifyMethod==="mobile"?"active":""} onClick={()=>{setVerifyMethod("mobile");setMsg("");}}>Mobile OTP</button></div><form onSubmit={createAccount}>
 <label className="field">First Name <span className="required-star">*</span><input name="first_name" type="text" value={f.first_name} onChange={change} required autoComplete="given-name"/></label>
 <label className="field">Last Name <span className="required-star">*</span><input name="last_name" type="text" value={f.last_name} onChange={change} required autoComplete="family-name"/></label>
 <label className="field">Email Address {verifyMethod==="email"?<span className="required-star">*</span>:<span className="optional-label">(Optional)</span>}<input name="email" type="email" value={f.email} onChange={change} autoComplete="email" required={verifyMethod==="email"}/></label>
 <label className="field">Password <span className="required-star">*</span><input name="password" type="password" value={f.password} onChange={change} required autoComplete="new-password"/></label>
 <label className="field">Confirm Password <span className="required-star">*</span><input name="confirm" type="password" value={f.confirm} onChange={change} required autoComplete="new-password"/></label>
 <label className="field">Mobile Number <span className="required-star">*</span><div className="phone-input-wrap"><span className="phone-country-code">+977</span><input name="phone" type="tel" value={f.phone} onChange={change} required autoComplete="tel-national" inputMode="numeric" maxLength="10" placeholder="10-digit mobile number"/></div></label>
 <div className="registration-address-container">
  <div className="registration-address-heading"><h2>Delivery Address</h2><p>Where should we deliver your orders?</p></div>
  <label className="field">Delivery Address <span className="required-star">*</span><textarea name="address" rows="3" value={f.address} onChange={change} required placeholder="House/street, area"/></label>
  <div className="registration-address-grid">
   <label className="field">Province <span className="required-star">*</span><select name="province" value={f.province} onChange={change} required><option value="">Select Province</option>{NEPAL_PROVINCES.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
   <label className="field">District <span className="required-star">*</span><select name="district" value={f.district} onChange={change} required disabled={!f.province}><option value="">{f.province?"Select District":"Select Province First"}</option>{provinceDistricts(f.province).map(d=><option key={d} value={d}>{d}</option>)}</select></label>
   <label className="field">City <span className="required-star">*</span><input name="city" value={f.city} onChange={change} required placeholder="e.g. Gaur"/></label>
   <label className="field">Postal Code <span className="optional-label">(Optional)</span><input name="postal_code" value={f.postal_code} onChange={change} inputMode="numeric" autoComplete="postal-code" placeholder="Postal code"/></label>
  </div>
 </div>
 <button className="btn" disabled={busy}>{busy?"Sending OTP…":verifyMethod==="mobile"?"Continue & Verify Mobile":"Continue & Verify Email"}</button>{msg&&<div className="message error">{msg}</div>}</form><div className="auth-google"><button type="button" className="google-auth-button" onClick={googleSignIn} disabled={busy}><span className="google-g" aria-hidden="true">G</span>Continue with Google</button></div><div className="auth-links">Already have an account? <a href="login.html">Sign in</a></div></AuthLayout>
}

export default Register;
