import React from "react";
import { money } from "../lib/api.js";

export default function ProductCard({product,image}){
  const href="product.html?code="+encodeURIComponent(product.product_code);
  return <article className="product-card"><a className="product-image" href={href}>{image?<img src={image.image_url} alt={image.alt_text||product.name} loading="lazy"/>:<div className="product-image-placeholder">Suru Collection</div>}</a><div className="product-card-content">{product.category&&<div className="product-category">{product.category}</div>}<h3><a href={href}>{product.name}</a></h3><div className="product-price">{money(product.price)}{product.compare_at_price&&<span className="compare-price">{money(product.compare_at_price)}</span>}</div><div className="product-card-actions"><a className="secondary-button" href={href}>View Details</a></div></div></article>
}
