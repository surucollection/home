import React,{useEffect,useMemo,useState} from "react";
import { money, norm, get } from "../lib/api.js";
import { addCart } from "../lib/cart.js";

export default function ProductCard({product,image,variants=[]}){
  const href="/product.html?code="+encodeURIComponent(product.product_code);
  const[added,setAdded]=useState(false),[open,setOpen]=useState(false),[buyNow,setBuyNow]=useState(false),[size,setSize]=useState(""),[colour,setColour]=useState(""),[qty,setQty]=useState(1);
  const sizes=useMemo(()=>[...new Set(variants.map(v=>v.size).filter(Boolean))],[variants]);
  const colours=useMemo(()=>[...new Set(variants.map(v=>v.color).filter(Boolean))],[variants]);
  const variant=useMemo(()=>{
    if(!variants.length)return null;
    if(!sizes.length&&!colours.length)return variants[0];
    return variants.find(v=>(!sizes.length||norm(v.size)===norm(size))&&(!colours.length||norm(v.color)===norm(colour)))||null;
  },[variants,sizes,colours,size,colour]);
  useEffect(()=>{if(sizes.length===1)setSize(sizes[0]);if(colours.length===1)setColour(colours[0])},[sizes,colours]);
  const hasStock=variants.length===0||variants.some(v=>Number(v.stock||0)>0);
  const selectedOutOfStock=variants.length>0&&(!variant||Number(variant.stock||0)<=0);
  const productOutOfStock=variants.length>0&&!hasStock;
  const startAdd=(e)=>{e?.preventDefault();e?.stopPropagation();setBuyNow(false);setQty(1);setOpen(true)};
  const startBuyNow=(e)=>{e?.preventDefault();e?.stopPropagation();setBuyNow(true);setQty(1);setOpen(true)};
  const confirmAdd=()=>{
    if(variants.length&&(!variant||Number(variant.stock||0)<=0))return;
    const stock=Number(variant?.stock||0);
    const q=Math.max(1,Math.min(Number(qty)||1,stock||Number(qty)||1));
    if(buyNow)localStorage.removeItem("suruCart");
    addCart({product_id:product.id,code:product.product_code,name:product.name,price:Number(product.price||0),image:image?.image_url||"",size:variant?.size||size||null,color:variant?.color||colour||product.color||null,quantity:q});
    setOpen(false);if(buyNow){window.location.href="/order.html";return;}setAdded(true);window.setTimeout(()=>setAdded(false),1200);
  };
  return <article className="product-card">
    <a className="product-image" href={href}>
      {image?<img src={image.image_url} alt={image.alt_text||product.name} loading="lazy"/>:<div className="product-image-placeholder">Suru Collection</div>}
    </a>
    <div className="product-card-content">
      {product.category&&<div className="product-category">{product.category}</div>}
      <h3><a href={href}>{product.name}</a></h3>
      <div className="product-price">{money(product.price)}{product.compare_at_price&&<span className="compare-price">{money(product.compare_at_price)}</span>}</div>
      <div className="product-card-actions">
        <button type="button" className="secondary-button" onClick={startAdd}>{added?"Added ✓":"Add to Cart"}</button>
        <button type="button" className="buy-now-button" onClick={startBuyNow}>Buy Now</button>
      </div>
    </div>
    {open&&<div className="variant-modal-backdrop" onClick={()=>setOpen(false)}>
      <div className="variant-modal" onClick={e=>e.stopPropagation()}>
        <button className="variant-modal-close" type="button" onClick={()=>setOpen(false)} aria-label="Close">×</button>
        <p className="eyebrow">{buyNow?"BUY NOW":"ADD TO CART"}</p><h3>{product.name}</h3>
        {colours.length>1&&<label className="field">Colour<select value={colour} onChange={e=>setColour(e.target.value)}><option value="">Select Colour</option>{colours.map(x=><option key={x}>{x}</option>)}</select></label>}
        {colours.length===1&&<div className="variant-field"><label>Colour</label><div className="variant-fixed-value">{colours[0]}</div></div>}
        {sizes.length>0&&<label className="field">Size<select value={size} onChange={e=>setSize(e.target.value)}><option value="">Select Size</option>{sizes.map(x=><option key={x}>{x}</option>)}</select></label>}
        {variants.length>0&&<div className={"variant-stock"+(selectedOutOfStock?" out-of-stock":"")}>{selectedOutOfStock?(variant?"Out of Stock":"Select an available option."):Number(variant.stock||0)+" item(s) available"}</div>}
        <label className="field">Quantity<input type="number" min="1" max={variant?.stock||undefined} value={qty} onChange={e=>setQty(e.target.value)}/></label>
        <button className="buy-button" type="button" onClick={confirmAdd} disabled={selectedOutOfStock}>{buyNow?"Buy Now":"Add to Cart"}</button>
      </div>
    </div>}
  </article>;
}
