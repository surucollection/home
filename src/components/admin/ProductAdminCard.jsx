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
      const{data,error}=await supabase.from("product_images")
        .select("id,image_url,alt_text,is_main,sort_order,color")
        .eq("product_id",p.id).order("sort_order",{ascending:true});
      const rows=error?[]:(data||[])
        .filter(x=>String(x.image_url||"").trim())
        .filter((x,i,a)=>a.findIndex(y=>String(y.image_url||"").trim()===String(x.image_url||"").trim()&&String(y.color||"")===String(x.color||""))===i);
      if(!cancelled)setImages(rows.map(x=>({...x,color:x.color||""})));
      if(!cancelled)setImagesLoading(false);
    })();
    return()=>{cancelled=true};
  },[p.id]);

  const updateImage=(index,patch)=>setImages(prev=>prev.map((x,i)=>i===index?{...x,...patch}:x));
  const addImage=()=>setImages(prev=>[...prev,{id:null,image_url:"",alt_text:p.name||"",color:"",is_main:false}]);
  const imageLinks=images.filter(x=>String(x.image_url||"").trim());
  const mainImage=imageLinks.find(x=>x.is_main)||imageLinks[0]||null;
  const close=()=>setEditing(null);

  return <div className="product-admin-card">
    <div className="product-admin-summary">
      <div className="product-admin-thumb">
        {imageLinks[0]?<img src={imageUrl(imageLinks[0].image_url,160)} alt={p.name||"Product"} loading="lazy" onError={e=>{e.currentTarget.style.visibility="hidden"}}/>:<span aria-hidden="true">No image</span>}
      </div>
      <div className="product-admin-info" style={{minWidth:0,width:"100%",maxWidth:"100%",overflow:"hidden"}}>
        <div className="product-admin-title" style={{minWidth:0,maxWidth:"100%",overflow:"hidden"}}><b style={{display:"block",whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"break-word",maxWidth:"100%"}}>{p.name}</b><small>{p.product_code} · {p.category}</small></div>
        <div className="product-admin-meta"><b>{money(p.price)}</b><span>MOQ {p.moq}</span><span className={p.is_active?"badge active":"badge inactive"}>{p.is_active?"Active":"Inactive"}</span>{p.is_featured&&<span className="badge">Featured</span>}</div>
      </div>
      <button type="button" className="primary product-admin-edit" onClick={()=>setEditing(p)}>Edit Product</button>
    </div>

    <AdminModal
      open={!!editing}
      onClose={close}
      title="Edit Product"
      subtitle={p.product_code+" · "+p.name}
      bodyClassName="admin-product-modal-body"
      maxWidth="1000px"
      footer={<div className="admin-product-modal-footer-content"><button className="secondary" type="button" onClick={close}>Cancel</button><button className="primary" type="button" onClick={()=>saveProduct(e,images)} disabled={imagesLoading||driveBusy}>{imagesLoading?"Loading images…":"Save Product"}</button></div>}
    >
      <div className="admin-form admin-product-compact-form">
        <div className="admin-product-row admin-product-row-code-name">
          <label className="product-code-field">Product Code<input maxLength="8" value={e.product_code??""} onChange={x=>setE({...e,product_code:x.target.value})}/></label>
          <label>Product Name<input value={e.name??""} onChange={x=>setE({...e,name:x.target.value})}/></label>
        </div>

        <div className="admin-product-row admin-product-row-price">
          <label>Price<input type="number" min="0" value={e.price??""} onChange={x=>setE({...e,price:x.target.value})}/></label>
          <label>Compare-at Price<input type="number" min="0" value={e.compare_at_price??""} onChange={x=>setE({...e,compare_at_price:x.target.value})}/></label>
          <label>MOQ<input type="number" min="1" value={e.moq??1} onChange={x=>setE({...e,moq:x.target.value})}/></label>
          <label>Category<select value={e.category||""} onChange={x=>setE({...e,category:x.target.value})} required><option value="" disabled>Select Category</option>{["Sarees","Lehengas","Suits","Gowns","Kurtis","Dupattas","Kids Wear","Accessories"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        </div>

        <div className="admin-product-row admin-product-row-attributes">
          <label>Fabric<input value={e.fabric??""} onChange={x=>setE({...e,fabric:x.target.value})}/></label>
          <label>Colour<input value={e.color??""} onChange={x=>setE({...e,color:x.target.value})}/></label>
          <label>Pattern<input value={e.pattern??""} onChange={x=>setE({...e,pattern:x.target.value})}/></label>
        </div>

        <div className="admin-product-checks">
          <label><input type="checkbox" checked={!!e.preorder_enabled} onChange={x=>setE({...e,preorder_enabled:x.target.checked})}/> Preorder</label>
          <label><input type="checkbox" checked={!!e.is_active} onChange={x=>setE({...e,is_active:x.target.checked})}/> Active</label>
          <label><input type="checkbox" checked={!!e.is_featured} onChange={x=>setE({...e,is_featured:x.target.checked})}/> Featured</label>
        </div>

        <label className="admin-product-description-field">Description<textarea rows="3" value={e.description??""} onChange={x=>setE({...e,description:x.target.value})}/></label>

        <div className="admin-product-section admin-product-drive-section">
          <div className="admin-product-inline-title"><b>Google Drive Image Folder</b><small>Share the folder as “Anyone with the link”.</small></div>
          <div className="admin-product-drive compact-drive-row">
            <input value={driveFolderUrl} onChange={x=>{setDriveFolderUrl(x.target.value);setDriveMessage("");}} placeholder="Paste Google Drive folder link" disabled={driveBusy}/>
            <button type="button" className="secondary" disabled={driveBusy||!driveFolderUrl.trim()} onClick={async()=>{
              setDriveBusy(true);setDriveMessage("Fetching…");
              const{data,error}=await supabase.functions.invoke("google-drive-folder",{body:{folder_url:driveFolderUrl.trim()}});
              if(error){setDriveMessage(error.message||"Unable to fetch the Drive folder.");setDriveBusy(false);return}
              const files=Array.isArray(data?.files)?data.files:[];
              if(!files.length){setDriveMessage(data?.message||"No image files were found in this folder.");setDriveBusy(false);return}
              setImages(prev=>[...prev,...files.map(file=>({id:null,image_url:file.url,alt_text:file.name||p.name,color:"",is_main:false}))]);
              setDriveMessage(files.length+" image"+(files.length===1?"":"s")+" imported.");
              setDriveBusy(false);
            }}>{driveBusy?"Fetching…":"Fetch Images"}</button>
          </div>
          {driveMessage&&<small className="admin-inline-message">{driveMessage}</small>}
        </div>

        <div className="admin-product-section admin-product-images-section">
          <div className="product-images-toolbar">
            <div className="admin-product-inline-title"><b>Product Images</b><small>Image links and colour assignment.</small></div>
            <div className="product-images-main-preview"><span>Main</span>{mainImage?<img src={imageUrl(mainImage.image_url,96)} alt="Main product" onError={x=>{x.currentTarget.style.display="none"}}/>:<em>No image</em>}</div>
            <button type="button" className="secondary" onClick={addImage}>+ Add Image</button>
          </div>

          <div className="product-image-edit-list">
            {images.map((img,i)=><div key={img.id||"new-"+i} className="product-image-edit-row">
              <div className="product-image-thumb">{img.image_url?<img src={imageUrl(img.image_url,96)} alt={img.alt_text||p.name} onError={x=>{x.currentTarget.style.display="none"}}/>:<span>—</span>}</div>
              <input aria-label={"Image URL "+(i+1)} value={img.image_url||""} onChange={x=>updateImage(i,{image_url:x.target.value})} placeholder="Image link"/>
              <input aria-label={"Image colour "+(i+1)} value={img.color||""} onChange={x=>updateImage(i,{color:x.target.value})} placeholder="Colour"/>
              <button type="button" className="danger product-image-remove" title="Remove image" aria-label={"Remove image "+(i+1)} onClick={()=>setImages(prev=>prev.filter((_,j)=>j!==i))}>×</button>
            </div>)}
          </div>
        </div>
      </div>
    </AdminModal>
  </div>
}
