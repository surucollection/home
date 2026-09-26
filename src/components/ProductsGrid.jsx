import React,{useEffect,useState} from "react";
import { get } from "../lib/api.js";
import ProductCard from "./ProductCard.jsx";

export default function ProductsGrid({limit}){
  const[p,setP]=useState([]),[im,setIm]=useState([]),[err,setErr]=useState("");
  useEffect(()=>{let ok=true;(async()=>{try{const products=await get("products",{select:"id,product_code,name,category,price,compare_at_price,is_active",is_active:"eq.true",order:"created_at.desc"});const imgs=await Promise.all((products||[]).map(x=>get("product_images",{select:"product_id,image_url,alt_text,is_main,sort_order",product_id:"eq."+x.id,order:"sort_order.asc"}).catch(()=>[])));if(ok){setP(products||[]);setIm(imgs.flat())}}catch(e){if(ok)setErr(e.message)}})();return()=>{ok=false}},[]);
  if(err)return <div className="product-loading">{err}</div>;
  if(!p.length)return <div className="product-loading">Loading products…</div>;
  return <div className="product-grid">{(limit?p.slice(0,limit):p).map(product=>{const image=im.find(i=>i.product_id===product.id&&i.is_main)||im.find(i=>i.product_id===product.id);return <ProductCard key={product.id} product={product} image={image}/>})}</div>
}
