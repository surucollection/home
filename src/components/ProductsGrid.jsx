import React,{useEffect,useState} from "react";
import { get } from "../lib/api.js";
import ProductCard from "./ProductCard.jsx";

export default function ProductsGrid({limit}){
  const[p,setP]=useState([]),[im,setIm]=useState([]),[vars,setVars]=useState({}),[err,setErr]=useState("");
  useEffect(()=>{let ok=true;(async()=>{try{
    const products=await get("products",{select:"id,product_code,name,category,price,compare_at_price,is_active,color",is_active:"eq.true",order:"created_at.desc"});
    const images=await Promise.all((products||[]).map(x=>get("product_images",{select:"product_id,image_url,alt_text,is_main,sort_order",product_id:"eq."+x.id,order:"sort_order.asc"}).catch(()=>[])));
    const variants=await Promise.all((products||[]).map(x=>get("product_sizes",{select:"id,size,color,stock,is_active",product_id:"eq."+x.id,is_active:"eq.true",order:"size.asc"}).catch(()=>[])));
    if(ok){setP(products||[]);setIm(images.flat());setVars(Object.fromEntries((products||[]).map((x,i)=>[x.id,variants[i]||[]])));}
  }catch(e){if(ok)setErr(e.message)}})();return()=>{ok=false}},[]);
  if(err)return <div className="product-loading">{err}</div>;
  if(!p.length)return <div className="product-loading">Loading products…</div>;
  return <div className="product-grid">{(limit?p.slice(0,limit):p).map(product=>{const image=im.find(i=>i.product_id===product.id&&i.is_main)||im.find(i=>i.product_id===product.id);return <ProductCard key={product.id} product={product} image={image} variants={vars[product.id]||[]}/>})}</div>
}
