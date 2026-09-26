import React,{useEffect,useState} from "react";
import { readCart } from "../lib/cart.js";

function Header(){
  const[count,setCount]=useState(()=>readCart().reduce((n,x)=>n+Number(x.quantity||x.qty||0),0));
  const[open,setOpen]=useState(false);
  useEffect(()=>{const f=()=>setCount(readCart().reduce((n,x)=>n+Number(x.quantity||x.qty||0),0));addEventListener("storage",f);addEventListener("suruCartChanged",f);return()=>{removeEventListener("storage",f);removeEventListener("suruCartChanged",f)}},[]);
  return <header className="nav"><div className="nav-inner"><a className="brand" href="/"><img src="assets/suru-logo-official.png" alt="Suru Collection"/></a><button className="menu-toggle" onClick={()=>setOpen(!open)} aria-expanded={open}>☰</button><nav className={open?"open":""}><a href="index.html">Home</a><a href="/about">About Us</a><a href="/?page=home#collection">Our Collection</a><a href="/products">Products</a><a href="/contact">Contact</a><a href="/login">My Account</a></nav><a href="/order" className="cart-link">🛍️<span>{count}</span></a></div></header>
}
export default Header;
