import React,{useEffect,useRef,useState} from "react";
import { money, supabase, imageUrl } from "../../lib/api.js";
import AdminModal from "./AdminModal.jsx";

const colorGroupKey = value => String(value || "").trim().toLocaleLowerCase() || "__default__";

export default function ProductAdminCard({p,editing,setEditing,saveProduct,uploadProductImage}){
  const[e,setE]=useState({...p});
  const[images,setImages]=useState([]);
  const[imagesLoading,setImagesLoading]=useState(false);
  const[saveMessage,setSaveMessage]=useState("");
  const[dragIndex,setDragIndex]=useState(null);
  const[dragOverIndex,setDragOverIndex]=useState(null);
  const[uploading,setUploading]=useState(false);
  const dragStateRef=useRef({source:null,target:null,pointerId:null});

  useEffect(()=>setE({...p}),[p]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      setImagesLoading(true);
      try{
        const{data,error}=await supabase.from("product_images")
          .select("id,image_url,alt_text,is_main,sort_order,color,media_type")
          .eq("product_id",p.id).order("sort_order",{ascending:true});
        const rows=error?[]:(data||[])
          .filter(x=>String(x.image_url||"").trim())
          .filter((x,i,a)=>a.findIndex(y=>String(y.image_url||"").trim()===String(x.image_url||"").trim()&&String(y.color||"")===String(x.color||""))===i);
        if(!cancelled)setImages(rows.map(x=>({...x,color:x.color||"",clientKey:String(x.id)})));
      }catch{
        if(!cancelled)setImages([]);
      }finally{
        if(!cancelled)setImagesLoading(false);
      }
    })();
    return()=>{cancelled=true};
  },[p.id]);

  const updateImage=(index,patch)=>setImages(prev=>prev.map((x,i)=>i===index?{...x,...patch}:x));
  const addImage=()=>setImages(prev=>[...prev,{id:null,clientKey:"new-"+crypto.randomUUID(),image_url:"",alt_text:p.name||"",color:"",media_type:"image",is_main:false}]);
  const moveImage=(from,to)=>setImages(prev=>{
    if(from<0||to<0||from>=prev.length||to>=prev.length||from===to)return prev;
    const next=[...prev];const[item]=next.splice(from,1);next.splice(to,0,item);return next;
  });
  const beginDrag=(event,index)=>{
    if(event.button!==undefined&&event.button!==0)return;
    event.preventDefault();
    dragStateRef.current={source:index,target:index,pointerId:event.pointerId};
    setDragIndex(index);setDragOverIndex(index);
  };
  useEffect(()=>{
    if(dragIndex===null)return;
    const previousUserSelect=document.body.style.userSelect;
    document.body.style.userSelect="none";
    const onMove=event=>{
      const drag=dragStateRef.current;
      if(drag.source===null||drag.pointerId!==event.pointerId)return;
      event.preventDefault();
      const element=document.elementFromPoint(event.clientX,event.clientY);
      const row=element?.closest?.("[data-image-index]");
      if(!row)return;
      const target=Number(row.getAttribute("data-image-index"));
      if(Number.isInteger(target)&&target>=0){
        dragStateRef.current={...dragStateRef.current,target};
        setDragOverIndex(target);
      }
    };
    const finish=event=>{
      const drag=dragStateRef.current;
      if(drag.source===null||drag.pointerId!==event.pointerId)return;
      if(drag.target!==null&&drag.target!==drag.source)moveImage(drag.source,drag.target);
      dragStateRef.current={source:null,target:null,pointerId:null};
      setDragIndex(null);setDragOverIndex(null);
      document.body.style.userSelect=previousUserSelect;
    };
    const cancel=event=>{
      const drag=dragStateRef.current;
      if(drag.source===null||drag.pointerId!==event.pointerId)return;
      dragStateRef.current={source:null,target:null,pointerId:null};
      setDragIndex(null);setDragOverIndex(null);
      document.body.style.userSelect=previousUserSelect;
    };
    window.addEventListener("pointermove",onMove,{passive:false});
    window.addEventListener("pointerup",finish);
    window.addEventListener("pointercancel",cancel);
    return()=>{
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerup",finish);
      window.removeEventListener("pointercancel",cancel);
      document.body.style.userSelect=previousUserSelect;
    };
  },[dragIndex]);

  const uploadAndSave=async()=>{
    setUploading(true);setSaveMessage("Uploading images…");
    try{
      const prepared=images.map(x=>({...x}));
      for(let i=0;i<prepared.length;i++){
        const img=prepared[i];
        if(img.file){
          const url=await uploadProductImage(p.id,img.file);
          prepared[i]={...img,image_url:url,media_type:img.file.type.startsWith("video/")?"video":"image",file:null};
        }
      }
      setSaveMessage("Saving gallery order and colour main images…");
      await saveProduct(e,prepared,setSaveMessage);
      const{data:rows,error}=await supabase.from("product_images")
        .select("id,image_url,alt_text,is_main,sort_order,color,media_type")
        .eq("product_id",p.id).order("sort_order",{ascending:true});
      if(!error)setImages((rows||[]).map(x=>({...x,color:x.color||"",media_type:x.media_type||"image",clientKey:String(x.id)})));
    }catch(err){
      setSaveMessage(err?.message||"Image upload failed. Please retry.");
    }finally{
      setUploading(false);
    }
  };

  const imageLinks=images.filter(x=>String(x.image_url||"").trim());
  const isMainForColor=(img,index)=>img.media_type!=="video"&&!images.slice(0,index).some(other=>other.media_type!=="video"&&colorGroupKey(other.color)===colorGroupKey(img.color));
  const close=()=>{setSaveMessage("");setEditing(null)};

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
      footer={<div className="admin-product-modal-footer-content"><button className="secondary" type="button" onClick={close}>Cancel</button><button className="primary" type="button" onClick={()=>{setSaveMessage("");uploadAndSave()}} disabled={imagesLoading||uploading}>{imagesLoading?"Loading images…":uploading?"Uploading…":"Save Product"}</button></div>}
    >
      <div className="admin-form admin-product-compact-form">
        {saveMessage&&<div className="message" role="status" style={{marginBottom:12,whiteSpace:"normal"}}>{saveMessage}</div>}
        <div className="admin-product-row admin-product-row-code-name">
          <label className="product-code-field">Product Code<input maxLength="8" value={e.product_code??""} onChange={x=>setE({...e,product_code:x.target.value})}/></label>
          <label>Product Name<input value={e.name??""} onChange={x=>setE({...e,name:x.target.value})}/></label>
        </div>

        <p className="form-note">Current website selling price: <b>{money(p.price)}</b>. After you save a base cost, the website price is calculated from the global markup and packaging settings. Existing prices stay unchanged until a base cost is entered.</p>
        <div className="admin-product-row admin-product-row-price">
          <label>Base Cost (NPR)<input type="number" min="0" step="0.01" value={e.base_cost??""} onChange={x=>setE({...e,base_cost:x.target.value})}/></label>
          <label>Compare-at Price<input type="number" min="0" value={e.compare_at_price??""} onChange={x=>setE({...e,compare_at_price:x.target.value})}/></label>
          <label>MOQ<input type="number" min="1" value={e.moq??1} onChange={x=>setE({...e,moq:x.target.value})}/></label>
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
          <label className="admin-product-category-inline">Category<select value={e.category||""} onChange={x=>setE({...e,category:x.target.value})} required><option value="" disabled>Select Category</option>{["Sarees","Lehengas","Suits","Gowns","Kurtis","Dupattas","Kids Wear","Accessories"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        </div>

        <label className="admin-product-description-field">Description<textarea rows="2" value={e.description??""} onChange={x=>setE({...e,description:x.target.value})}/></label>

        <div className="admin-product-section admin-product-images-section">
          <div className="product-images-toolbar">
            <div className="admin-product-inline-title"><b>Product Images</b><small>Drag or use the arrows to reorder. The first image for each colour becomes its main image.</small></div>
            <button type="button" className="secondary product-image-add-button" onClick={addImage} disabled={uploading}>+ Add Image</button>
          </div>
          <label className="admin-product-upload-label">Upload image files
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" multiple disabled={uploading} onChange={event=>{
              const files=Array.from(event.target.files||[]);
              setImages(prev=>[...prev,...files.map(file=>({id:null,clientKey:"file-"+crypto.randomUUID(),file,previewUrl:URL.createObjectURL(file),image_url:"",alt_text:file.name,color:"",media_type:file.type.startsWith("video/")?"video":"image",is_main:false}))]);
              event.target.value="";
            }}/>
            <small>Select photos and videos together · JPG, PNG, WebP, AVIF, MP4 or WebM. Photos up to 15 MB; videos up to 100 MB.</small>
          </label>
          {imagesLoading?<p className="form-note">Loading existing images…</p>:null}
          <div className={"product-image-edit-list"+(dragIndex!==null?" is-dragging":"")}>
            {images.map((img,i)=>{
              const isColorMain=isMainForColor(img,i);
              const rowLabel="Image "+(i+1)+(isColorMain?" — main image for "+(String(img.color||"").trim()||"unspecified colour"):"");
              return <div key={img.clientKey||img.id||"new-"+i} data-image-index={i} className={"product-image-edit-row"+(dragOverIndex===i?" is-drag-over":"")+(dragIndex===i?" is-drag-source":"")}>
                <div className="product-image-order-controls">
                  <button type="button" className="product-image-drag-handle" title="Hold and drag to reorder" aria-label={"Drag "+rowLabel+" to reorder"} onPointerDown={event=>beginDrag(event,i)} disabled={uploading}>⠿</button>
                </div>
                {(img.previewUrl||img.image_url)
                  ? <div className={"product-image-thumb"+(img.media_type==="video"?" is-video-thumb":"")}>{img.media_type==="video"?<><video src={img.previewUrl||img.image_url} muted playsInline preload="metadata"/><span className="product-video-play" aria-label="Video">▶</span></>:<img src={img.previewUrl||imageUrl(img.image_url,96)} alt={img.alt_text||p.name} onError={event=>{event.currentTarget.style.display="none"}}/>}</div>
                  : <label className="product-image-thumb product-image-single-upload" title="Choose one image or video for this row">
                      <span>＋<small>Choose</small></span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" disabled={uploading} aria-label={"Choose one image or video for row "+(i+1)} onChange={event=>{
                        const file=event.target.files?.[0];
                        if(file)updateImage(i,{file,previewUrl:URL.createObjectURL(file),alt_text:file.name,image_url:"",media_type:file.type.startsWith("video/")?"video":"image"});
                        event.target.value="";
                      }}/>
                    </label>}
                <div className="product-image-edit-fields">
                  <input aria-label={"Colour group for image "+(i+1)} value={img.color||""} onChange={event=>updateImage(i,{color:event.target.value})} placeholder="Colour group" disabled={uploading}/>
                </div>
                <button type="button" className="danger product-image-remove" title="Remove image" aria-label={"Remove image "+(i+1)} onClick={()=>setImages(prev=>prev.filter((_,j)=>j!==i))} disabled={uploading}>×</button>
              </div>;
            })}
            {!imagesLoading&&images.length===0&&<p className="form-note">No images yet. Upload multiple files above or choose Add Image to add one file.</p>}
          </div>
        </div>
      </div>
    </AdminModal>
  </div>
}
