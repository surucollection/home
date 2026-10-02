import React,{useCallback,useEffect,useRef,useState} from "react";
import { get } from "../lib/api.js";
import ProductCard from "./ProductCard.jsx";

const PAGE_SIZE=24;

export default function ProductsGrid({limit,category,featured=false}){
  const[p,setP]=useState([]),[err,setErr]=useState(""),[loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false),[hasMore,setHasMore]=useState(true);
  const requestId=useRef(0);

  const load=useCallback(async(reset=false)=>{
    const id=++requestId.current;
    const offset=reset?0:p.length;
    if(reset)setLoading(true);else setLoadingMore(true);
    setErr("");
    try{
      const params={
        select:"id,product_code,name,category,price,compare_at_price,is_active,color,product_images(product_id,image_url,alt_text,is_main,sort_order),product_sizes(id,size,color,stock,is_active)",
        is_active:"eq.true",
        "product_sizes.is_active":"eq.true",
        order:"created_at.desc",
        limit:String(PAGE_SIZE),
        offset:String(offset)
      };
      if(category)params.category="eq."+category;
      if(featured)params.is_featured="eq.true";
      const rows=await get("products",params);
      if(id!==requestId.current)return;
      const next=rows||[];
      setP(prev=>reset?next:[...prev,...next]);
      setHasMore(next.length===PAGE_SIZE);
    }catch(e){
      if(id===requestId.current)setErr(e.message||"Unable to load products.");
    }finally{
      if(id===requestId.current){setLoading(false);setLoadingMore(false);}
    }
  },[category,featured,p.length]);

  useEffect(()=>{setP([]);setHasMore(true);load(true)},[category,featured]);

  if(loading&&!p.length)return <div className="product-loading">Loading products…</div>;
  if(err&&!p.length)return <div className="product-loading">{err}</div>;
  if(!p.length)return <div className="product-loading">No products found{category?" in "+category:""}.</div>;

  const visible=limit?p.slice(0,limit):p;
  return <>
    <div className="product-grid">
      {visible.map((product,index)=>{
        const images=product.product_images||[];
        const image=images.find(i=>i.is_main)||images.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0];
        return <ProductCard
          key={product.id}
          product={product}
          image={image}
          variants={product.product_sizes||[]}
          priority={index<4}
        />;
      })}
    </div>
    {!limit&&hasMore&&<div className="catalog-load-more">
      <button className="secondary-button" type="button" onClick={()=>load(false)} disabled={loadingMore}>
        {loadingMore?"Loading…":"Load More Products"}
      </button>
    </div>}
    {err&&p.length>0&&<div className="product-loading">{err}</div>}
  </>;
}
