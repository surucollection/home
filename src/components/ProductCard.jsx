import React,{useEffect,useMemo,useState} from "react";
import { money, norm, get } from "../lib/api.js";
import { addCart } from "../lib/cart.js";

export default function ProductCard({product,image,variants=[]}){
  const href="/product.html?code="+encodeURIComponent(product.product_code);
  const[added,setAdded]=useState(false),[open,setOpen]=useState(false),[size,setSize]=useState(""),[colour,setColour]=useState(""),[qty,setQty]=useState(1);
  const sizes=useMemo(()=>[...new Set(variants.map(v=>v.size).filter(Boolean))],[variants]);
  const colours=useMemo(()=>[...new Set(variants.map(v=>v.color).filter(Boolean))],[variants]);
  const variant=useMemo(()=>{
    if(!variants.length)return null;
    if(!sizes.length&&!colours.length)return variants[0];
    return variants.find(v=>(!sizes.length||norm(v.size)===norm(size))&&(!colours.length||norm(v.color)===norm(colour)))||null;
  },[variants,sizes,colours,size,colour]);
  useEffect(()=>{if(sizes.length===1)setSize(sizes[0]);if(colours.length===1)setColour(colours[0])},[sizes,colours]);
  const startAdd=(e)=>{e?.preventDefault();e?.stopPropagation();setQty(1);setOpen(true)};
  const confirmAdd=()=>{
    if(variants.length&&(!variant||Number(variant.stock||0)<=0))return;
    const stock=Number(variant?.stock||0);
    const q=Math.max(1,Math.min(Number(qty)||1,stock||Number(qty)||1));
    addCart({product_id:product.id,code:product.product_code,name:product.name,price:Number(product.price||0),image:image?.image_url||"",size:variant?.size||size||null,color:variant?.color||colour||product.color||null,quantity:q});
    setOpen(false);setAdded(true);window.setTimeout(()=>setAdded(false),1200);
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
        <a className="secondary-button" href={href}>View Details</a>
      </div>
    </div>
    {open&&<div className="variant-modal-backdrop" onClick={()=>setOpen(false)}>
      <div className="variant-modal" onClick={e=>e.stopPropagation()}>
        <button className="variant-modal-close" type="button" onClick={()=>setOpen(false)} aria-label="Close">×</button>
        <p className="eyebrow">ADD TO CART</p><h3>{product.name}</h3>
        {colours.length>1&&<label className="field">Colour<select value={colour} onChange={e=>setColour(e.target.value)}><option value="">Select Colour</option>{colours.map(x=><option key={x}>{x}</option>)}</select></label>}
        {colours.length===1&&<div className="variant-field"><label>Colour</label><div className="variant-fixed-value">{colours[0]}</div></div>}
        {sizes.length>0&&<label className="field">Size<select value={size} onChange={e=>setSize(e.target.value)}><option value="">Select Size</option>{sizes.map(x=><option key={x}>{x}</option>)}</select></label>}
        {variants.length>0&&<div className="variant-stock">{variant?Number(variant.stock||0)+" item(s) available":"Select an available option."}</div>}
        <label className="field">Quantity<input type="number" min="1" max={variant?.stock||undefined} value={qty} onChange={e=>setQty(e.target.value)}/></label>
        <button className="buy-button" type="button" onClick={confirmAdd} disabled={variants.length>0&&(!variant||Number(variant.stock||0)<=0)}>Add to Cart</button>
      </div>
    </div>}
  </article>;
}
