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

function ResetPassword(){
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[sessionReady,setSessionReady]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[mode,setMode]=useState("request");
 useEffect(()=>{let active=true;const params=new URLSearchParams(location.search);const hash=new URLSearchParams(location.hash.slice(1));const callbackType=params.get("type")||hash.get("type");const isMagicLink=callbackType==="magiclink";const hasAuthCallback=()=>["recovery","magiclink"].includes(callbackType)||params.has("code")||hash.has("access_token")||hash.has("token_hash");const goToAccount=()=>{if(active&&isMagicLink)location.replace(location.origin+"/?page=account")};;const{data:listener}=supabase.auth.onAuthStateChange((event,session)=>{if(!active||!session)return;if(isMagicLink&&event==="SIGNED_IN"){goToAccount();return}if(event==="PASSWORD_RECOVERY"||event==="SIGNED_IN"&&hasAuthCallback()){setMode("update");setMsg("")}});supabase.auth.getSession().then(({data,error})=>{if(!active)return;if(!error&&data.session){if(isMagicLink){goToAccount()}else if(hasAuthCallback()||location.search.includes("page=reset-password")||location.pathname.replace(/\/+$/, "")==="/reset-password"){setMode("update");setMsg("")}}setSessionReady(true)});return()=>{active=false;listener.subscription.unsubscribe()}},[]);
 async function request(e){e.preventDefault();if(!email.trim()){setMsg("Enter your account email address.");return}setBusy(true);setMsg("Sending your secure link…");const{error}=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:location.origin+"/?page=reset-password"});setMsg(error?error.message:"If an account exists for that email, a secure link has been sent. Check your inbox and spam folder.");setBusy(false)}
 async function update(e){e.preventDefault();if(password.length<6){setMsg("Your password must be at least 6 characters.");return}if(password!==confirm){setMsg("Passwords do not match.");return}setBusy(true);setMsg("Updating password…");const{error}=await supabase.auth.updateUser({password});if(error){setMsg(error.message);setBusy(false);return}setMsg("Password updated successfully. You can now sign in with your new password.");setPassword("");setConfirm("");await supabase.auth.signOut();setMode("done");setBusy(false)}
 if(!sessionReady)return <AuthLayout title="Reset Password"><p className="auth-intro">Checking your password reset link…</p></AuthLayout>;
 return <AuthLayout title={mode==="update"?"Set New Password":mode==="done"?"Password Updated":"Reset Password"}><p className="auth-intro">{mode==="update"?"Choose a new password for your account.":mode==="done"?"Your password has been changed. Sign in to continue.":"Enter the email address linked to your account. We'll send you a secure reset link if an account is associated with it."}</p>{mode==="request"&&<form onSubmit={request}><label className="field">Email Address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="Enter your account email" required/></label><button className="btn" disabled={busy}>{busy?"Sending…":"Send Reset Link"}</button>{msg&&<div className={msg.startsWith("If an account")?"message success":"message error"}>{msg}</div>}</form>}{mode==="update"&&<form onSubmit={update}><label className="field">New Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" minLength="6" required/></label><label className="field">Confirm New Password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" minLength="6" required/></label><button className="btn" disabled={busy}>{busy?"Updating…":"Update Password"}</button>{msg&&<div className={msg.startsWith("Password updated")?"message success":"message error"}>{msg}</div>}</form>}{mode==="done"&&<div className="reset-done"><p>{msg}</p><a className="btn" href="/login/">Go to Sign In</a></div>}<div className="auth-links"><a href="/login/">Back to Sign In</a></div></AuthLayout>
}

export default ResetPassword;
