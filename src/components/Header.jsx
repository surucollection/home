import React,{useEffect,useState} from "react";
import { readCart } from "../lib/cart.js";\nimport { supabase } from "../lib/api.js";

function Header(){
  const[count,setCount]=useState(()=>readCart().reduce((n,x)=>n+Number(x.quantity||x.qty||0),0));
  const[open,setOpen]=useState(false);\n  const[loggedIn,setLoggedIn]=useState(false);\n  useEffect(()=>{let mounted=true;supabase.auth.getSession().then(({data})=>{if(mounted)setLoggedIn(!!data.session)});const{data:sub}=supabase.auth.onAuthStateChange((_event,session)=>{if(mounted)setLoggedIn(!!session)});return()=>{mounted=false;sub.subscription.unsubscribe()};},[]);
  useEffect(()=>{const f=()=>setCount(readCart().reduce((n,x)=>n+Number(x.quantity||x.qty||0),0));addEventListener("storage",f);addEventListener("suruCartChanged",f);return()=>{removeEventListener("storage",f);removeEventListener("suruCartChanged",f)}},[]);
  return <header className="nav"><div className="nav-inner"><a className="brand" href="/"><img src="assets/suru-logo-official.png" alt="Suru Collection"/></a><button className="menu-toggle" onClick={()=>setOpen(!open)} aria-expanded={open}>☰</button><nav className={open?"open":""}><a href="index.html">Home</a><a href="/about">About Us</a><a href="/?page=home#collection">Our Collection</a><a href="/products">Products</a><a href="/contact">Contact</a><a href="/account">My Account</a>{loggedIn&&<a href="/orders">My Orders</a>}</nav><a href="/order" className="cart-link">🛍️<span>{count}</span></a></div></header>
}
export default Header;
