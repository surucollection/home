import React,{useEffect,useState} from "react";
import { get } from "../lib/api.js";
import ProductCard from "./ProductCard.jsx";

export default function RelatedProducts({product}){
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let active=true;
    (async()=>{
      setLoading(true);
      try{
        const params={
          select:"id,product_code,name,category,price,compare_at_price,color,is_active,preorder_enabled,created_at,product_images(product_id,image_url,alt_text,is_main,sort_order,color),product_sizes(id,size,color,stock,is_active)",
          is_active:"eq.true",
          id:"neq."+product.id,
          order:"created_at.desc",
          limit:"24"
        };
        if(product.category)params.category="eq."+product.category;
        const rows=await get("products",params);
        if(!active)return;
        const unique=(rows||[]).filter(item=>item.id!==product.id);
        setProducts(unique.slice(0,4));
      }catch{
        if(active)setProducts([]);
      }finally{
        if(active)setLoading(false);
      }
    })();
    return()=>{active=false};
  },[product.id,product.category]);

  if(loading)return <section className="related-products-section" aria-label="Related products"><p className="product-review-empty">Finding pieces you may like…</p></section>;
  if(!products.length)return null;

  return <section className="related-products-section" aria-labelledby="related-products-title">
    <div className="product-section-heading">
      <div><p className="product-section-eyebrow">COMPLETE YOUR LOOK</p><h2 id="related-products-title">You May Also Like</h2></div>
      <a className="related-products-browse" href={"/products.html"+(product.category?"?category="+encodeURIComponent(product.category):"")}>View all</a>
    </div>
    <div className="product-grid related-products-grid">
      {products.map((item,index)=>{
        const images=item.product_images||[];
        const image=images.find(value=>value.is_main)||[...images].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0];
        return <ProductCard key={item.id} product={item} image={image} variants={item.product_sizes||[]} displayColour="" priority={index<2}/>;
      })}
    </div>
  </section>;
}
