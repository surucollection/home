import React,{useEffect,useState} from "react";
import { money, supabase, imageUrl } from "../../lib/api.js";
import AdminModal from "./AdminModal.jsx";

export default function ProductAdminCard({p,editing,setEditing,saveProduct}){
  const[e,setE]=useState({...p});
  const[images,setImages]=useState([]);
  const[imagesLoading,setImagesLoading]=useState(false);
  const[driveFolderUrl,setDriveFolderUrl]=useState("");
  const[driveBusy,setDriveBusy]=useState(false);
  const[driveMessage,setDriveMessage]=useState("");
  useEffect(()=>setE({...p}),[p]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setImagesLoading(true);
      const{data,error}=await supabase.from("product_images").select("id,image_url,alt_text,is_main,sort_order,color").eq("product_id",p.id).order("sort_order",{ascending:true});
      const rows=error?[]:(data||[]).filter(x=>String(x.image_url||"").trim()).filter((x,i,a)=>a.findIndex(y=>String(y.image_url||"").trim()===String(x.image_url||"").trim()&&String(y.color||"")===String(x.color||""))===i);
      if(!cancelled)setImages(rows.map(x=>({...x,color:x.color||""})));
      if(!cancelled)setImagesLoading(false);
    })();
    return()=>{cancelled=true};
  },[p.id]);
  const updateImage=(index,patch)=>setImages(prev=>prev.map((x,i)=>i===index?{...x,...patch}:x));
  const addImage=()=>setImages(prev=>[...prev,{id:null,image_url:"",alt_text:p.name||"",color:""}]);
  const imageLinks=images.map(x=>String(x.image_url||"").trim()).filter(Boolean);
  const close=()=>setEditing(null);
  return <div className="product-admin-card">
    <div className="product-admin-summary">
      <div className="product-admin-thumb">
        {imageLinks[0]?<img src={imageUrl(imageLinks[0],160)} alt={p.name||"Product"} loading="lazy" onError={e=>{e.currentTarget.style.visibility="hidden"}}/>:<span aria-hidden="true">No image</span>}
      </div>
      <div className="product-admin-info" style={{minWidth:0,width:"100%",maxWidth:"100%",overflow:"hidden"}}>
        <div className="product-admin-title" style={{minWidth:0,maxWidth:"100%",overflow:"hidden"}}><b style={{display:"block",whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"break-word",maxWidth:"100%"}}>{p.name}</b><small>{p.product_code} · {p.category}</small></div>
        <div className="product-admin-meta"><b>{money(p.price)}</b><span>MOQ {p.moq}</span><span className={p.is_active?"badge active":"badge inactive"}>{p.is_active?"Active":"Inactive"}</span>{p.is_featured&&<span className="badge">Featured</span>}</div>
      </div>
      <button className="primary product-admin-edit" onClick={()=>setEditing(p)}>Edit Product</button>
    </div>

    <AdminModal
      open={!!editing}
      onClose={close}
      title="Edit Product"
      subtitle={p.product_code+" · "+p.name}
      bodyClassName="admin-product-modal-body"
      maxWidth="900px"
      footer={<div className="admin-product-modal-footer-content"><button className="secondary" type="button" onClick={close}>Cancel</button><button className="primary" type="button" onClick={()=>saveProduct(e,images)} disabled={imagesLoading||driveBusy}>{imagesLoading?"Loading images…":"Save Product"}</button></div>}
    >

          <div className="admin-form">
            <div className="form-grid">{[["product_code","Product Code"],["name","Product Name"],["price","Price"],["compare_at_price","Compare-at Price"],["moq","MOQ"],["fabric","Fabric"],["color","Colour"],["pattern","Pattern"]].map(([k,l])=><label key={k}>{l}<input value={e[k]??""} onChange={x=>setE({...e,[k]:x.target.value})}/></label>)}<label>Category<select value={e.category||""} onChange={x=>setE({...e,category:x.target.value})} required><option value="" disabled>Select Category</option>{["Sarees","Lehengas","Suits","Gowns","Kurtis","Dupattas","Kids Wear","Accessories"].map(x=><option key={x} value={x}>{x}</option>)}</select></label></div>
            <label>Description<textarea value={e.description||""} onChange={x=>setE({...e,description:x.target.value})}/></label>
            <div className="preorder-admin-settings"><b>Preorder Settings</b><label><input type="checkbox" checked={!!e.preorder_enabled} onChange={x=>setE({...e,preorder_enabled:x.target.checked})}/> Enable preorders for this product</label><label>Advance payment (%)<input type="number" min="1" max="100" step="1" value={e.preorder_advance_percent??30} onChange={x=>setE({...e,preorder_advance_percent:x.target.value})}/></label></div>
            <div className="check-row"><label><input type="checkbox" checked={!!e.is_active} onChange={x=>setE({...e,is_active:x.target.checked})}/> Active</label><label><input type="checkbox" checked={!!e.is_featured} onChange={x=>setE({...e,is_featured:x.target.checked})}/> Featured</label></div>
            <div className="admin-product-section">
              <div className="admin-product-section-head"><div><b>Google Drive Folder — Fetch Images</b><small>Folder must be shared as “Anyone with the link”.</small></div></div>
              <div className="admin-product-drive"><input value={driveFolderUrl} onChange={x=>{setDriveFolderUrl(x.target.value);setDriveMessage("");}} placeholder="https://drive.google.com/drive/folders/..." disabled={driveBusy}/><button type="button" className="secondary" disabled={driveBusy||!driveFolderUrl.trim()} onClick={async()=>{setDriveBusy(true);setDriveMessage("Fetching images…");const{data,error}=await supabase.functions.invoke("google-drive-folder",{body:{folder_url:driveFolderUrl.trim()}});if(error){setDriveMessage(error.message||"Unable to fetch the Drive folder.");setDriveBusy(false);return}const files=Array.isArray(data?.files)?data.files:[];if(!files.length){setDriveMessage(data?.message||"No image files were found in this folder.");setDriveBusy(false);return}setImages(prev=>[...prev,...files.map(file=>({id:null,image_url:file.url,alt_text:file.name||p.name,color:""}))]);setDriveMessage(files.length+" images imported. Assign a colour to each image, then save.");setDriveBusy(false)}}>{driveBusy?"Fetching…":"Fetch Images"}</button></div>
              {driveMessage&&<small>{driveMessage}</small>}
            </div>
            <div className="image-links-field">
              <div className="admin-product-section-head"><div><b>Product Images</b><small>Assign a colour to each photo. Leave colour blank for shared/default images.</small></div><button type="button" className="secondary" onClick={addImage}>+ Add Image</button></div>
              {images.map((img,i)=><div key={img.id||"new-"+i} className="product-image-row"><input aria-label={"Image URL "+(i+1)} value={img.image_url||""} onChange={x=>updateImage(i,{image_url:x.target.value})} placeholder="Image URL"/><input aria-label={"Image colour "+(i+1)} value={img.color||""} onChange={x=>updateImage(i,{color:x.target.value})} placeholder="Colour (optional)"/><button type="button" className="danger" onClick={()=>setImages(prev=>prev.filter((_,j)=>j!==i))}>Remove</button></div>)}
              {imageLinks[0]&&<div className="admin-image-preview"><small>Image preview</small><img src={imageUrl(imageLinks[0],400)} alt="Product preview" onError={x=>{x.currentTarget.style.display="none"}}/></div>}
            </div>
          </div>
        
    </AdminModal>
  </div>
}