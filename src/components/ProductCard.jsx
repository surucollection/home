import React from "react";
import { money } from "../lib/api.js";
import { addCart } from "../lib/cart.js";

export default function ProductCard({product,image}){
  const href="/product?code="+encodeURIComponent(product.product_code);
  const add=()=>{
    addCart({
      product_id:product.id,
      code:product.product_code,
      name:product.name,
      price:Number(product.price||0),
      image:image?.image_url||"",
      size:null,
      color:product.color||null,
      quantity:1
    });
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
        <button type="button" className="secondary-button" onClick={add}>Add to Cart</button>
        <a className="secondary-button" href={href}>View Details</a>
      </div>
    </div>
  </article>;
}
