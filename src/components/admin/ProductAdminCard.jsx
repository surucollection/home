import React,{useEffect,useState} from "react";
import { money, supabase, imageUrl } from "../../lib/api.js";

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
  return <div className="product-admin-card">
    <small>{p.product_code} · {p.category}</small><h3>{p.name}</h3>
    {editing?<div className="admin-form">
      <div className="form-grid">{[["product_code","Product Code"],["name","Product Name"],["price","Price"],["compare_at_price","Compare-at Price"],["moq","MOQ"],["fabric","Fabric"],["color","Colour"],["pattern","Pattern"]].map(([k,l])=><label key={k}>{l}<input value={e[k]??""} onChange={x=>setE({...e,[k]:x.target.value})}/></label>)}<label>Category<select value={e.category||""} onChange={x=>setE({...e,category:x.target.value})} required><option value="" disabled>Select Category</option>{["Sarees","Lehengas","Suits","Gowns","Kurtis","Dupattas","Kids Wear","Accessories"].map(x=><option key={x} value={x}>{x}</option>)}</select></label></div>
      <label>Description<textarea value={e.description||""} onChange={x=>setE({...e,description:x.target.value})}/></label>
      <div style={{marginBottom:12,padding:12,border:"1px solid #e3e3e3",borderRadius:10}}>
        <div><b>Google Drive Folder — Fetch Images</b> <small>(Folder must be shared as “Anyone with the link”.)</small></div>
        <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
          <input value={driveFolderUrl} onChange={x=>{setDriveFolderUrl(x.target.value);setDriveMessage("");}} placeholder="https://drive.google.com/drive/folders/..." style={{flex:"1 1 360px"}} disabled={driveBusy}/>
          <button type="button" className="secondary" disabled={driveBusy||!driveFolderUrl.trim()} onClick={async()=>{
            setDriveBusy(true);setDriveMessage("Fetching images…");
            const{data,error}=await supabase.functions.invoke("google-drive-folder",{body:{folder_url:driveFolderUrl.trim()}});
            if(error){setDriveMessage(error.message||"Unable to fetch the Drive folder.");setDriveBusy(false);return}
            const files=Array.isArray(data?.files)?data.files:[];
            if(!files.length){setDriveMessage(data?.message||"No image files were found in this folder.");setDriveBusy(false);return}
            setImages(prev=>[...prev,...files.map(file=>({id:null,image_url:file.url,alt_text:file.name||p.name,color:""}))]);
            setDriveMessage(files.length+" images imported. Assign a colour to each image, then save.");setDriveBusy(false);
          }}>{driveBusy?"Fetching…":"Fetch Images"}</button>
        </div>{driveMessage&&<small style={{display:"block",marginTop:7}}>{driveMessage}</small>}
      </div>
      <div className="image-links-field">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}><div><b>Product Images</b><small style={{display:"block"}}>Assign a colour to each photo. Leave colour as “All colours” for shared/default images.</small></div><button type="button" className="secondary" onClick={addImage}>+ Add Image</button></div>
        {images.map((img,i)=><div key={img.id||"new-"+i} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(120px,180px) auto",gap:8,alignItems:"center",marginTop:10}}>
          <input aria-label={"Image URL "+(i+1)} value={img.image_url||""} onChange={x=>updateImage(i,{image_url:x.target.value})} placeholder="Image URL"/>
          <input aria-label={"Image colour "+(i+1)} value={img.color||""} onChange={x=>updateImage(i,{color:x.target.value})} placeholder="Colour (optional)"/>
          <button type="button" className="danger" onClick={()=>setImages(prev=>prev.filter((_,j)=>j!==i))}>Remove</button>
        </div>)}
        {imageLinks[0]&&<div style={{marginTop:10}}><small style={{display:"block",marginBottom:6}}>Image preview</small><img src={imageUrl(imageLinks[0],400)} alt="Product preview" style={{width:140,height:140,objectFit:"cover",borderRadius:8,border:"1px solid #ddd"}} onError={x=>{x.currentTarget.style.display="none"}}/></div>}
      </div>
      <div className="check-row"><label><input type="checkbox" checked={!!e.is_active} onChange={x=>setE({...e,is_active:x.target.checked})}/> Active</label><label><input type="checkbox" checked={!!e.is_featured} onChange={x=>setE({...e,is_featured:x.target.checked})}/> Featured</label></div>
      <button className="primary" onClick={()=>saveProduct(e,images)} disabled={imagesLoading||driveBusy}>Save Product</button> <button className="secondary" onClick={()=>setEditing(null)}>Cancel</button>
    </div>:<>
      <div><b>{money(p.price)}</b> · MOQ: {p.moq}</div><p><span className={p.is_active?"badge active":"badge inactive"}>{p.is_active?"Active":"Inactive"}</span> {p.is_featured&&<span className="badge">Featured</span>}</p>
      <div style={{display:"flex",alignItems:"center",gap:14}}><button className="primary" onClick={()=>setEditing(p)}>Edit Product</button>{imageLinks[0]&&<img src={imageUrl(imageLinks[0],192)} alt={p.name||"Product"} style={{width:96,height:96,objectFit:"cover",borderRadius:8,border:"1px solid #ddd",display:"block"}} onError={e=>{e.currentTarget.style.visibility="hidden"}}/>}</div>
    </>}
  </div>
}