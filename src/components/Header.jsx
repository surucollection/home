import React,{useEffect,useState} from "react";
import { readCart } from "../lib/cart.js";

function Header(){
  const[count,setCount]=useState(()=>readCart().reduce((n,x)=>n+Number(x.quantity||x.qty||0),0));
  const[open,setOpen]=useState(false);
  useEffect(()=>{const f=()=>setCount(readCart().reduce((n,x)=>n+Number(x.quantity||x.qty||0),0));addEventListener("storage",f);addEventListener("suruCartChanged",f);return()=>{removeEventListener("storage",f);removeEventListener("suruCartChanged",f)}},[]);
  return <header className="nav"><div className="nav-inner"><a className="brand" href="index.html"><img src="assets/suru-logo-official.png" alt="Suru Collection"/></a><button className="menu-toggle" onClick={()=>setOpen(!open)} aria-expanded={open}>☰</button><nav className={open?"open":""}><a href="index.html">Home</a><a href="about.html">About Us</a><a href="index.html#collection">Our Collection</a><a href="products.html">Products</a><a href="contact.html">Contact</a><a href="login.html">My Account</a></nav><a href="order.html" className="cart-link">🛍️<span>{count}</span></a></div></header>
}
export default Header;
