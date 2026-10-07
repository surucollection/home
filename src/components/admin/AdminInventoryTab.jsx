import React from "react";
import { imageUrl } from "../../lib/api.js";
import AdminModal from "./AdminModal.jsx";

export default function AdminInventoryTab({inventory,inventoryEditing,setInventoryEditing,inventoryDrafts,setInventoryDrafts,saveInventoryProduct,addVariant,deleteVariant}){
 return <><div className="page-title"><div><h2>Inventory</h2><p>Update stock by size.</p></div></div>
   <div className="card"><div id="inventoryGrid" className="admin-inventory-list">
   {inventory.map(p=><div className="inventory-admin-card" key={p.id}>
     <div className="inventory-admin-summary">
       <div className="inventory-admin-thumb">{p.main_image?<img src={imageUrl(p.main_image,160)} alt={p.name||"Product"} loading="lazy" onError={e=>{e.currentTarget.style.visibility="hidden"}}/>:<span>No image</span>}</div>
       <div className="inventory-admin-info" style={{minWidth:0,width:"100%",maxWidth:"100%",overflow:"hidden"}}>
         <div className="inventory-admin-title" style={{minWidth:0,width:"100%",maxWidth:"100%",overflow:"hidden"}}><b>{p.name}</b><small>{p.product_code} · {(p.product_sizes||[]).length} variant{(p.product_sizes||[]).length===1?"":"s"}</small></div>
         <div className="inventory-admin-meta"><span>Stock <b>{(p.product_sizes||[]).reduce((sum,s)=>sum+Number(s.stock||0),0)}</b></span>{(p.product_sizes||[]).slice(0,3).map(s=><span key={s.id}>{s.size||"—"}{s.color?" · "+s.color:""}: {Number(s.stock||0)}</span>)}{(p.product_sizes||[]).length>3&&<span>+{(p.product_sizes||[]).length-3} more</span>}</div>
       </div>
       <button type="button" className="primary inventory-admin-edit" onClick={()=>setInventoryEditing(p.id)}>Edit Inventory</button>
     </div>

     <AdminModal
       open={inventoryEditing===p.id}
       onClose={()=>setInventoryEditing(null)}
       title="Edit Inventory"
       subtitle={p.product_code+" · "+p.name}
       bodyClassName="admin-inventory-modal-body"
       maxWidth="760px"
       footer={<div className="admin-inventory-modal-footer-content"><button type="button" className="secondary" onClick={()=>setInventoryEditing(null)}>Cancel</button><button type="button" className="primary" onClick={()=>saveInventoryProduct(p)}>Save Inventory</button></div>}
     >
       <div className="inventory-modal-product">
         {p.main_image&&<img src={imageUrl(p.main_image,112)} alt={p.name||"Product"}/>}
         <div><b>{p.name}</b><small>{p.product_code} · {(p.product_sizes||[]).length} variants</small></div>
       </div>

       <div className="inventory-variants-compact">
         <div className="inventory-variant-head"><span>Size</span><span>Colour</span><span>Stock</span><span></span></div>
         {(p.product_sizes||[]).map(s=><div className="inventory-variant-compact-row" key={s.id}>
           <div className="inventory-variant-value" title={s.size||"—"}>{s.size||"—"}</div>
           <div className="inventory-variant-value" title={s.color||"—"}>{s.color||"—"}</div>
           <input type="number" min="0" value={inventoryDrafts[p.id]?.[s.id]??s.stock??0} onChange={e=>setInventoryDrafts(d=>({...d,[p.id]:{...(d[p.id]||{}),[s.id]:e.target.value}}))}/>
           <button type="button" className="danger inventory-variant-remove" title="Delete variant" aria-label={"Delete "+(s.size||"")+" "+(s.color||"")+" variant"} onClick={()=>deleteVariant(p.id,s)}>×</button>
         </div>)}
       </div>

       {!(p.product_sizes||[]).length&&<p className="small-note">No variants yet. Add a variant below.</p>}
       <button type="button" className="secondary inventory-add-variant" onClick={()=>addVariant(p.id)}>+ Add Variant</button>
     </AdminModal>
   </div>)}
   </div></div></>;
}
