import React,{useEffect,useState} from "react";
import { money, supabase } from "../../lib/api.js";

export default function ProductAdminCard({p,editing,setEditing,saveProduct}){
  const[e,setE]=useState({...p});
  const[images,setImages]=useState([]);
  const[imagesLoading,setImagesLoading]=useState(false);
  useEffect(()=>setE({...p}),[p]);
  useEffect(()=>{
    if(!editing)return;
    let cancelled=false;
    (async()=>{
      setImagesLoading(true);
      const{data,error}=await supabase.from("product_images").select("id,image_url,alt_text,is_main,sort_order").eq("product_id",p.id).order("sort_order",{ascending:true});
      if(!cancelled)setImages(error?[]:(data||[]));
      if(!cancelled)setImagesLoading(false);
    })();
    return()=>{cancelled=true};
  },[editing,p.id]);
  const updateImage=(index,key,value)=>setImages(prev=>prev.map((img,i)=>i===index?{...img,[key]:value}:img));
  const setMainImage=index=>setImages(prev=>prev.map((img,i)=>({...img,is_main:i===index})));
  const addImage=()=>setImages(prev=>[...prev,{id:null,image_url:"",alt_text:"",is_main:prev.length===0,sort_order:prev.length}]);
  const removeImage=index=>setImages(prev=>prev.filter((_,i)=>i!==index).map((img,i)=>({...img,sort_order:i,is_main:prev.length===1?true:img.is_main})));
  return <div className="product-admin-card"><small>{p.product_code} · {p.category}</small><h3>{p.name}</h3>{editing?<div className="admin-form"><div className="form-grid">{[["product_code","Product Code"],["name","Product Name"],["price","Price"],["compare_at_price","Compare-at Price"],["moq","MOQ"],["fabric","Fabric"],["color","Colour"],["pattern","Pattern"]].map(([k,l])=><label key={k}>{l}<input value={e[k]??""} onChange={x=>setE({...e,[k]:x.target.value})}/></label>)}<label>Category<select value={e.category||""} onChange={x=>setE({...e,category:x.target.value})} required><option value="" disabled>Select Category</option>{["Sarees","Lehengas","Suits","Gowns","Kurtis","Dupattas","Kids Wear","Accessories"].map(x=><option key={x} value={x}>{x}</option>)}</select></label></div><label>Description<textarea value={e.description||""} onChange={x=>setE({...e,description:x.target.value})}/></label><div className="product-image-editor"><div className="page-title"><div><h4>Product Images</h4><small>Add image links. The first/main image is used as the product's primary image.</small></div><button className="secondary" type="button" onClick={addImage}>Add Image</button></div>{imagesLoading?<p>Loading images…</p>:images.length?images.map((img,i)=><div className="product-image-row" key={img.id||"new-"+i}><input type="url" placeholder="https://example.com/product-image.jpg" value={img.image_url||""} onChange={x=>updateImage(i,"image_url",x.target.value)}/><input type="text" placeholder="Alt text (optional)" value={img.alt_text||""} onChange={x=>updateImage(i,"alt_text",x.target.value)}/><label className="image-main-check"><input type="radio" name={"main-image-"+p.id} checked={!!img.is_main} onChange={()=>setMainImage(i)}/> Main</label><button className="danger" type="button" onClick={()=>removeImage(i)}>Remove</button></div>):<p>No images added. Click <b>Add Image</b> to add an image link.</p>}</div><div className="check-row"><label><input type="checkbox" checked={!!e.is_active} onChange={x=>setE({...e,is_active:x.target.checked})}/> Active</label><label><input type="checkbox" checked={!!e.is_featured} onChange={x=>setE({...e,is_featured:x.target.checked})}/> Featured</label></div><button className="primary" onClick={()=>saveProduct(e,images)} disabled={imagesLoading}>Save Product</button> <button className="secondary" onClick={()=>setEditing(null)}>Cancel</button></div>:<><div><b>{money(p.price)}</b> · MOQ: {p.moq}</div><p><span className={p.is_active?"badge active":"badge inactive"}>{p.is_active?"Active":"Inactive"}</span> {p.is_featured&&<span className="badge">Featured</span>}</p><button className="primary" onClick={()=>setEditing(p)}>Edit Product</button></>}</div>
}
