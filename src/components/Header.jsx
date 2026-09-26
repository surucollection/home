import React,{useEffect,useState} from "react";
import { readCart } from "../lib/cart.js";
import { supabase } from "../lib/api.js";

function Header(){
  const[count,setCount]=useState(()=>readCart().reduce((n,x)=>n+Number(x.quantity||x.qty||0),0));
  const[open,setOpen]=useState(false);
  const[accountOpen,setAccountOpen]=useState(false);
  const[loggedIn,setLoggedIn]=useState(false);
  const[account,setAccount]=useState({name:"",first_name:"",last_name:"",phone:"",email:""});
  useEffect(()=>{
    let mounted=true;
    const load=async(session)=>{
      if(!session){
        if(mounted){setLoggedIn(false);setAccount({name:"",first_name:"",last_name:"",phone:"",email:""});setAccountOpen(false)}
        return;
      }
      if(mounted)setLoggedIn(true);
      const{data}=await supabase.rpc("my_customer_profile");
      if(mounted){
        let p=data;
        if(typeof p==="string"){try{p=JSON.parse(p)}catch{}}
        setAccount({name:p?.name||session.user.user_metadata?.name||"Account",first_name:p?.first_name||session.user.user_metadata?.first_name||"",last_name:p?.last_name||session.user.user_metadata?.last_name||"",phone:p?.phone||session.user.user_metadata?.phone||"",email:session.user.email||""});
      }
    };
    supabase.auth.getSession().then(({data})=>load(data.session));
    const{data:sub}=supabase.auth.onAuthStateChange((_event,session)=>load(session));
    return()=>{mounted=false;sub.subscription.unsubscribe()};
  },[]);
  useEffect(()=>{
    const f=()=>setCount(readCart().reduce((n,x)=>n+Number(x.quantity||x.qty||0),0));
    addEventListener("storage",f);addEventListener("suruCartChanged",f);
    return()=>{removeEventListener("storage",f);removeEventListener("suruCartChanged",f)}
  },[]);
  useEffect(()=>{
    const close=e=>{
      if(!e.target.closest?.(".account-menu"))setAccountOpen(false);
    };
    document.addEventListener("click",close);
    return()=>document.removeEventListener("click",close);
  },[]);
  async function logout(){setAccountOpen(false);await supabase.auth.signOut();location.href="/login.html"}
  const firstName=(account.first_name||account.name||"Account").trim().split(/\s+/)[0]||"Account";
  const initial=firstName.charAt(0).toUpperCase();
  return <header className="nav"><div className="nav-inner">
    <a className="brand" href="/"><img src="/assets/suru-logo-official.png" alt="Suru Collection"/></a>
    <button className="menu-toggle" onClick={()=>setOpen(!open)} aria-expanded={open}>☰</button>
    <nav className={open?"open":""}>
      <a href="/">Home</a><a href="/about.html">About Us</a><a href="/products.html">Products</a><a href="/contact.html">Contact</a>
      {!loggedIn?<a href="/login.html">Login</a>:<div className="account-menu">
        <button type="button" className="account-menu-toggle" onClick={e=>{e.stopPropagation();setAccountOpen(!accountOpen)}} aria-expanded={accountOpen}>
          <span className="account-avatar">{initial}</span><span className="account-menu-name">{firstName}</span><span className="account-menu-arrow">⌄</span>
        </button>
        {accountOpen&&<div className="account-dropdown">
          <div className="account-dropdown-profile"><span className="account-avatar large">{initial}</span><div><strong>{account.email||"—"}</strong><small>{account.phone||"—"}</small></div></div>
          <div className="account-dropdown-divider"/>
          <a href="/account/" onClick={()=>setAccountOpen(false)}>My Account</a>
          <a href="/orders/" onClick={()=>setAccountOpen(false)}>My Orders</a>
          <div className="account-dropdown-divider"/>
          <button type="button" className="account-logout" onClick={logout}><i className="fa fa-sign-out logout-icon" aria-hidden="true"></i>Logout</button>
        </div>}
      </div>}
    </nav>
    <a href="/order.html" className="cart-link">🛍️<span>{count}</span></a>
  </div></header>
}
export default Header;
