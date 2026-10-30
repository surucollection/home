import React,{useCallback,useEffect,useRef,useState} from "react";
import { get } from "../lib/api.js";
import ProductCard from "./ProductCard.jsx";

const PAGE_SIZE=24;
const CATALOG_CACHE_KEY="suru_full_product_catalog_v1";
const CATALOG_REVALIDATE_MS=60000;

let catalogMemoryCache=null;
let catalogRequestPromise=null;

const catalogParams={
  select:"id,product_code,name,category,price,compare_at_price,is_active,is_featured,color,preorder_enabled,product_images(product_id,image_url,alt_text,is_main,sort_order,color,media_type),product_sizes(id,size,color,stock,is_active)",
  is_active:"eq.true",
  "product_sizes.is_active":"eq.true",
  order:"created_at.desc",
  limit:"1000",
  offset:"0"
};

function readCatalogCache(){
  if(catalogMemoryCache?.products?.length)return catalogMemoryCache;
  try{
    const raw=sessionStorage.getItem(CATALOG_CACHE_KEY);
    if(raw){
      const parsed=JSON.parse(raw);
      if(parsed&&Array.isArray(parsed.products)){
        catalogMemoryCache=parsed;
        return parsed;
      }
    }
  }catch{}
  return null;
}

function writeCatalogCache(products){
  const entry={savedAt:Date.now(),products};
  catalogMemoryCache=entry;
  try{sessionStorage.setItem(CATALOG_CACHE_KEY,JSON.stringify(entry))}catch{}
}

function fetchFullCatalog(){
  if(catalogRequestPromise)return catalogRequestPromise;
  catalogRequestPromise=get("products",catalogParams)
    .then(rows=>{
      const products=Array.isArray(rows)?rows:[];
      writeCatalogCache(products);
      return products;
    })
    .finally(()=>{catalogRequestPromise=null});
  return catalogRequestPromise;
}

function filterCatalog(rows,category,featured,excludeFeatured){
  return (rows||[]).filter(product=>{
    if(category&&String(product.category||"").trim().toLowerCase()!==String(category).trim().toLowerCase())return false;
    if(featured&&!product.is_featured)return false;
    if(!featured&&excludeFeatured&&product.is_featured)return false;
    return true;
  });
}

function expandProducts(products){
  return (products||[]).flatMap(product=>{
    const variants=product.product_sizes||[];
    const images=(product.product_images||[]).filter(i=>i.media_type!=="video");
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
}

export default function ProductsGrid({limit,category,featured=false,excludeFeatured=false}){
  const[p,setP]=useState([]),[loadedCount,setLoadedCount]=useState(0),[err,setErr]=useState(""),[loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false),[hasMore,setHasMore]=useState(true);
  const requestId=useRef(0),loadedCountRef=useRef(0),filteredCatalogRef=useRef([]);
  const pageSize=limit?Math.max(1,Math.min(Number(limit)||1,PAGE_SIZE)):PAGE_SIZE;

  const applyCatalog=useCallback((rows,reset=true)=>{
    const filtered=filterCatalog(rows,category,featured,excludeFeatured);
    filteredCatalogRef.current=filtered;
    const offset=reset?0:loadedCountRef.current;
    const next=filtered.slice(offset,offset+pageSize);
    setP(prev=>reset?expandProducts(next):[...prev,...expandProducts(next)]);
    const count=reset?next.length:offset+next.length;
    loadedCountRef.current=count;
    setLoadedCount(count);
    setHasMore(count<filtered.length);
    setLoading(false);
    setLoadingMore(false);
  },[category,featured,excludeFeatured,pageSize]);

  useEffect(()=>{
    const id=++requestId.current;
    let active=true;
    const cached=readCatalogCache();
    if(cached){
      applyCatalog(cached.products,true);
    }else{
      setP([]);
      setLoadedCount(0);
      loadedCountRef.current=0;
      filteredCatalogRef.current=[];
      setHasMore(true);
      setLoading(true);
    }
    setErr("");

    const shouldRefresh=!cached||(Date.now()-Number(cached.savedAt||0)>=CATALOG_REVALIDATE_MS);
    if(shouldRefresh){
      fetchFullCatalog().then(rows=>{
        if(!active||id!==requestId.current)return;
        applyCatalog(rows,true);
      }).catch(error=>{
        if(!active||id!==requestId.current)return;
        if(!cached)setErr(error?.message||"Unable to load products.");
      });
    }else if(!cached){
      setLoading(true);
    }
    return()=>{active=false};
  },[category,featured,excludeFeatured,applyCatalog]);

  const loadMore=useCallback(()=>{
    if(loadingMore||!hasMore)return;
    setLoadingMore(true);
    const offset=loadedCountRef.current;
    const next=filteredCatalogRef.current.slice(offset,offset+pageSize);
    setP(prev=>[...prev,...expandProducts(next)]);
    const count=offset+next.length;
    loadedCountRef.current=count;
    setLoadedCount(count);
    setHasMore(count<filteredCatalogRef.current.length);
    setLoadingMore(false);
  },[loadingMore,hasMore,pageSize]);

  if(loading&&!p.length)return <div className="product-loading">Loading products…</div>;
  if(err&&!p.length)return <div className="product-loading">{err}</div>;
  if(!p.length)return category?<div className="category-coming-soon"><div className="coming-soon-ornament" aria-hidden="true"><span>✦</span><i></i><span>✦</span></div><p className="coming-soon-eyebrow">A little something is on its way</p><h2>Coming Soon</h2><p className="coming-soon-category">{category}</p><div className="coming-soon-divider"><span>✧</span></div><p className="coming-soon-copy">We’re curating beautiful pieces for this collection.<br/>Stay tuned for something special.</p><a className="coming-soon-link" href="products.html">Explore All Collections <span aria-hidden="true">→</span></a></div>:<div className="product-loading">No products found.</div>;

  const visible=limit?p.slice(0,limit):p;
  return <>
    <div className="product-grid">
      {visible.map((product,index)=>{
        const images=(product.product_images||[]).filter(i=>i.media_type!=="video");
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
      <button className="secondary-button" type="button" onClick={loadMore} disabled={loadingMore}>
        {loadingMore?"Loading…":"Load More Products"}
      </button>
    </div>}
    {err&&p.length>0&&<div className="product-loading">{err}</div>}
  </>;
}
