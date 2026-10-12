import React,{useCallback,useEffect,useRef,useState} from "react";
import { get } from "../lib/api.js";
import ProductCard from "./ProductCard.jsx";

const PAGE_SIZE=24;

export default function ProductsGrid({limit,category,featured=false}){
  const[p,setP]=useState([]),[err,setErr]=useState(""),[loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false),[hasMore,setHasMore]=useState(true);
  const requestId=useRef(0);

  const load=useCallback(async(reset=false)=>{
    const id=++requestId.current;
    const pageSize=limit?Math.max(1,Math.min(Number(limit)||1,PAGE_SIZE)):PAGE_SIZE;
    const offset=reset?0:p.length;
    if(reset)setLoading(true);else setLoadingMore(true);
    setErr("");
    try{
      const params={
        select:"id,product_code,name,category,price,compare_at_price,is_active,color,product_images(product_id,image_url,alt_text,is_main,sort_order),product_sizes(id,size,color,stock,is_active)",
        is_active:"eq.true",
        "product_sizes.is_active":"eq.true",
        order:"created_at.desc",
        limit:String(pageSize),
        offset:String(offset)
      };
      if(category)params.category="eq."+category;
      if(featured)params.is_featured="eq.true";
      const rows=await get("products",params);
      if(id!==requestId.current)return;
      const next=rows||[];
      // Expand each product into one listing card per colour variant across every ProductsGrid section.
      const expanded=next.flatMap(product=>{
        const variants=product.product_sizes||[];
        const images=product.product_images||[];
        const colours=[...new Set([...variants.map(v=>String(v.color||"").trim()),...images.map(i=>String(i.color||"").trim())].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
        if(!colours.length)return [{...product,listingColour:"",listingImage:undefined,listingVariants:variants}];
        return colours.map(colour=>{
          const sameColour=images.filter(i=>String(i.color||"").trim().toLowerCase()===colour.toLowerCase());
          const shared=images.filter(i=>!String(i.color||"").trim());
          const candidates=sameColour.length?sameColour:(shared.length?shared:images);
          const listingImage=candidates.find(i=>i.is_main)||[...candidates].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0];
          return {...product,listingColour:colour,listingImage,listingVariants:variants.filter(v=>String(v.color||"").trim().toLowerCase()===colour.toLowerCase()||!String(v.color||"").trim())};
        });
      });
      setP(prev=>reset?expanded:[...prev,...expanded]);
      setHasMore(next.length===pageSize);
    }catch(e){
      if(id===requestId.current)setErr(e.message||"Unable to load products.");
    }finally{
      if(id===requestId.current){setLoading(false);setLoadingMore(false);}
    }
  },[category,featured,p.length]);

  useEffect(()=>{setP([]);setHasMore(true);load(true)},[category,featured]);

  if(loading&&!p.length)return <div className="product-loading">Loading products…</div>;
  if(err&&!p.length)return <div className="product-loading">{err}</div>;
  if(!p.length)return category?<div className="category-coming-soon"><div className="coming-soon-ornament" aria-hidden="true"><span>✦</span><i></i><span>✦</span></div><p className="coming-soon-eyebrow">A little something is on its way</p><h2>Coming Soon</h2><p className="coming-soon-category">{category}</p><div className="coming-soon-divider"><span>✧</span></div><p className="coming-soon-copy">We’re curating beautiful pieces for this collection.<br/>Stay tuned for something special.</p><a className="coming-soon-link" href="products.html">Explore All Collections <span aria-hidden="true">→</span></a></div>:<div className="product-loading">No products found.</div>;

  const visible=limit?p.slice(0,limit):p;
  return <>
    <div className="product-grid">
      {visible.map((product,index)=>{
        const images=product.product_images||[];
        const image=product.listingImage||images.find(i=>i.is_main)||[...images].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0];
        return <ProductCard
          key={product.id+(product.listingColour?"-"+product.listingColour:"")}
          product={product}
          image={image}
          variants={product.listingVariants||product.product_sizes||[]}
          displayColour={product.listingColour||""}
          priority={index<2}
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
