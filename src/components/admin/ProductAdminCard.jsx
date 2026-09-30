import React,{useEffect,useState} from "react";
import { money, supabase, imageUrl } from "../../lib/api.js";

export default function ProductAdminCard({p,editing,setEditing,saveProduct}){
  const[e,setE]=useState({...p});
  const[images,setImages]=useState([]);
  const[imagesLoading,setImagesLoading]=useState(false);
  const[imageText,setImageText]=useState("");
  useEffect(()=>setE({...p}),[p]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setImagesLoading(true);
      const{data,error}=await supabase.from("product_images").select("id,image_url,alt_text,is_main,sort_order").eq("product_id",p.id).order("sort_order",{ascending:true});
      const next=error?[]:(data||[]);
      if(!cancelled){setImages(next);setImageText(next.map(x=>String(x.image_url||"").trim()).filter(Boolean).join("\n"));}
      if(!cancelled)setImagesLoading(false);
    })();
    return()=>{cancelled=true};
  },[p.id]);
  const imageLinks=images.map(x=>String(x.image_url||"").trim()).filter(Boolean);
  return <div className="product-admin-card">
    <small>{p.product_code} · {p.category}</small>
    <h3>{p.name}</h3>
    {editing?<div className="admin-form">
      <div className="form-grid">{[["product_code","Product Code"],["name","Product Name"],["price","Price"],["compare_at_price","Compare-at Price"],["moq","MOQ"],["fabric","Fabric"],["color","Colour"],["pattern","Pattern"]].map(([k,l])=><label key={k}>{l}<input value={e[k]??""} onChange={x=>setE({...e,[k]:x.target.value})}/></label>)}<label>Category<select value={e.category||""} onChange={x=>setE({...e,category:x.target.value})} required><option value="" disabled>Select Category</option>{["Sarees","Lehengas","Suits","Gowns","Kurtis","Dupattas","Kids Wear","Accessories"].map(x=><option key={x} value={x}>{x}</option>)}</select></label></div>
      <label>Description<textarea value={e.description||""} onChange={x=>setE({...e,description:x.target.value})}/></label>
      <div className="image-links-field">
        <div><b>Image Links</b> <small>(One image link per line. The first link is the main image.)</small></div>
        <textarea rows="6" placeholder={"https://example.com/image-1.jpg\nhttps://example.com/image-2.jpg\nhttps://example.com/image-3.jpg"} value={imagesLoading?"":imageText} onChange={x=>{
          const value=x.target.value;
          setImageText(value);
          const lines=value.split(/\r?\n/).map(v=>v.trim());
          setImages(lines.map((url,i)=>({id:i<images.length?images[i].id:null,image_url:url,alt_text:i<images.length?images[i].alt_text||null:null,is_main:i===0,sort_order:i})));
        }} disabled={imagesLoading}/>
      </div>
      <div className="check-row"><label><input type="checkbox" checked={!!e.is_active} onChange={x=>setE({...e,is_active:x.target.checked})}/> Active</label><label><input type="checkbox" checked={!!e.is_featured} onChange={x=>setE({...e,is_featured:x.target.checked})}/> Featured</label></div>
      <button className="primary" onClick={()=>saveProduct(e,images)} disabled={imagesLoading}>Save Product</button> <button className="secondary" onClick={()=>setEditing(null)}>Cancel</button>
    </div>:<>
      <div><b>{money(p.price)}</b> · MOQ: {p.moq}</div>
      <p><span className={p.is_active?"badge active":"badge inactive"}>{p.is_active?"Active":"Inactive"}</span> {p.is_featured&&<span className="badge">Featured</span>}</p>
      <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
        <button className="primary" onClick={()=>setEditing(p)}>Edit Product</button>
        {imageLinks[0]&&<img src={imageUrl(imageLinks[0],192)} alt={p.name||"Product"} style={{width:"96px",height:"96px",objectFit:"cover",borderRadius:"8px",border:"1px solid #ddd",display:"block"}} onError={e=>{e.currentTarget.style.visibility="hidden"}}/>}
      </div>
    </> }
  </div>
}
