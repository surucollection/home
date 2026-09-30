import React,{useEffect,useState} from "react";
import { money, supabase, imageUrl } from "../../lib/api.js";

export default function ProductAdminCard({p,editing,setEditing,saveProduct}){
  const[e,setE]=useState({...p});
  const[images,setImages]=useState([]);
  const[imagesLoading,setImagesLoading]=useState(false);
  const[imageText,setImageText]=useState("");
  const[driveFolderUrl,setDriveFolderUrl]=useState("");
  const[driveBusy,setDriveBusy]=useState(false);
  const[driveMessage,setDriveMessage]=useState("");
  useEffect(()=>setE({...p}),[p]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setImagesLoading(true);
      const{data,error}=await supabase.from("product_images").select("id,image_url,alt_text,is_main,sort_order").eq("product_id",p.id).order("sort_order",{ascending:true});
      const nextRaw=error?[]:(data||[]);
      const next=nextRaw.filter(x=>String(x.image_url||"").trim()).filter((x,i,a)=>a.findIndex(y=>String(y.image_url||"").trim()===String(x.image_url||"").trim())===i);
      const hasDrive=next.some(x=>/drive\\.google\\.com\\//i.test(String(x.image_url||"")));
      if(hasDrive){
        try{
          await supabase.functions.invoke("google-drive-folder",{body:{product_id:p.id}});
          const refreshed=await supabase.from("product_images").select("id,image_url,alt_text,is_main,sort_order").eq("product_id",p.id).order("sort_order",{ascending:true});
          const hosted=(refreshed.data||[]).filter(x=>String(x.image_url||"").trim()).filter((x,i,a)=>a.findIndex(y=>String(y.image_url||"").trim()===String(x.image_url||"").trim())===i);
          if(!cancelled){setImages(hosted);setImageText(hosted.map(x=>String(x.image_url||"").trim()).filter(Boolean).join("\n"));}
        }catch(_){}
      }else if(!cancelled){
        setImages(next);setImageText(next.map(x=>String(x.image_url||"").trim()).filter(Boolean).join("\n"));
      }
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
      <div style={{marginBottom:"12px",padding:"12px",border:"1px solid #e3e3e3",borderRadius:"10px"}}>
        <div><b>Google Drive Folder — Fetch Images</b> <small>(Folder must be shared as “Anyone with the link”.)</small></div>
        <div style={{display:"flex",gap:"8px",marginTop:"8px",flexWrap:"wrap"}}>
          <input value={driveFolderUrl} onChange={x=>{setDriveFolderUrl(x.target.value);setDriveMessage("");}} placeholder="https://drive.google.com/drive/folders/..." style={{flex:"1 1 360px"}} disabled={driveBusy||imagesLoading}/>
          <button type="button" className="secondary" disabled={driveBusy||imagesLoading||!driveFolderUrl.trim()} onClick={async()=>{
            setDriveBusy(true);setDriveMessage("Fetching images…");
            const{data,error}=await supabase.functions.invoke("google-drive-folder",{body:{folder_url:driveFolderUrl.trim()}});
            if(error){setDriveMessage(error.message||"Unable to fetch the Drive folder.");setDriveBusy(false);return}
            const files=Array.isArray(data?.files)?data.files:[];
            if(!files.length){setDriveMessage(data?.message||"No image files were found in this folder.");setDriveBusy(false);return}
            const rows=files.map((file,i)=>({id:null,image_url:file.url,alt_text:file.name||null,is_main:i===0,sort_order:i}));
            setImages(rows);setImageText(rows.map(x=>x.image_url).join("\n"));setDriveMessage(`${rows.length} image${rows.length===1?"":"s"} imported. Save Product to apply them.`);setDriveBusy(false);
          }}>{driveBusy?"Fetching…":"Fetch Images"}</button>
        </div>
        {driveMessage&&<small style={{display:"block",marginTop:"7px"}}>{driveMessage}</small>}
      </div>
      <div className="image-links-field">
        <div><b>Image Links</b> <small>(One image link per line. The first link is the main image.)</small></div>
        <textarea rows="6" placeholder={"https://example.com/image-1.jpg\nhttps://example.com/image-2.jpg\nhttps://example.com/image-3.jpg"} value={imagesLoading?"":imageText} onChange={x=>{
          const value=x.target.value;
          setImageText(value);
          const lines=value.split(/\r?\n/).map(v=>v.trim());
          setImages(lines.map((url,i)=>({id:i<images.length?images[i].id:null,image_url:url,alt_text:i<images.length?images[i].alt_text||null:null,is_main:i===0,sort_order:i})));
        }} disabled={imagesLoading}/>
        {imageText.split(/\r?\n/).map(v=>v.trim()).filter(Boolean)[0]&&
          <div style={{marginTop:"10px"}}>
            <small style={{display:"block",marginBottom:"6px"}}>Main image preview</small>
            <img src={imageUrl(imageText.split(/\r?\n/).map(v=>v.trim()).filter(Boolean)[0],400)}
              alt="Main product preview"
              style={{width:"140px",height:"140px",objectFit:"cover",borderRadius:"8px",border:"1px solid #ddd",display:"block"}}
              onError={e=>{e.currentTarget.style.display="none"}}/>
          </div>}
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
