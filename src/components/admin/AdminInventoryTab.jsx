import React from "react";
import { imageUrl } from "../../lib/api.js";
import StockRow from "./StockRow.jsx";
import AdminModal from "./AdminModal.jsx";

export default function AdminInventoryTab({inventory,inventoryEditing,setInventoryEditing,inventoryDrafts,setInventoryDrafts,saveInventoryProduct,addVariant,deleteVariant}){
 return <><div className="page-title"><div><h2>Inventory</h2><p>Update stock by size.</p></div></div><div className="card"><div id="inventoryGrid" className="admin-inventory-list">{inventory.map(p=><div className="inventory-admin-card" key={p.id}>
   <div className="inventory-admin-summary"><div className="inventory-admin-thumb">{p.main_image?<img src={imageUrl(p.main_image,160)} alt={p.name||"Product"} loading="lazy" onError={e=>{e.currentTarget.style.visibility="hidden"}}/>:<span>No image</span>}</div><div className="inventory-admin-info" style={{minWidth:0,width:"100%",maxWidth:"100%",overflow:"hidden"}}><div className="inventory-admin-title" style={{minWidth:0,width:"100%",maxWidth:"100%",overflow:"hidden"}}><b style={{display:"block",maxWidth:"100%",whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"break-word",lineHeight:1.25}}>{p.name}</b><small>{p.product_code} · {(p.product_sizes||[]).length} variant{(p.product_sizes||[]).length===1?"":"s"}</small></div><div className="inventory-admin-meta"><span>Stock <b>{(p.product_sizes||[]).reduce((sum,s)=>sum+Number(s.stock||0),0)}</b></span>{(p.product_sizes||[]).slice(0,3).map(s=><span key={s.id}>{s.size||"—"}{s.color?" · "+s.color:""}: {Number(s.stock||0)}</span>)}{(p.product_sizes||[]).length>3&&<span>+{(p.product_sizes||[]).length-3} more</span>}</div></div><button type="button" className="primary inventory-admin-edit" onClick={()=>setInventoryEditing(p.id)}>Edit Inventory</button></div>
   <AdminModal
     open={inventoryEditing===p.id}
     onClose={()=>setInventoryEditing(null)}
     title="Edit Inventory"
     subtitle={p.product_code+" · "+p.name}
     bodyClassName="admin-inventory-modal-body"
     maxWidth="700px"
     footer={<div className="admin-inventory-modal-footer-content"><button type="button" className="secondary" onClick={()=>setInventoryEditing(null)}>Cancel</button><button type="button" className="primary" onClick={()=>saveInventoryProduct(p)}>Save Inventory</button></div>}
   >
     <div className="inventory-modal-product">{p.main_image&&<img src={imageUrl(p.main_image,192)} alt={p.name||"Product"}/>}<div><b>{p.name}</b><small>{(p.product_sizes||[]).length} variant{(p.product_sizes||[]).length===1?"":"s"}</small></div></div><div className="stock-list">{(p.product_sizes||[]).map(s=><div className="inventory-variant-item" key={s.id}><StockRow s={s} value={inventoryDrafts[p.id]?.[s.id]??s.stock} onChange={value=>setInventoryDrafts(d=>({...d,[p.id]:{...(d[p.id]||{}),[s.id]:value}}))}/><button className="danger" type="button" onClick={()=>deleteVariant(p.id,s)}>Delete Variant</button></div>)}</div>{!(p.product_sizes||[]).length&&<p className="small-note">No variants yet. Add a variant below.</p>}<button type="button" className="secondary" style={{marginTop:12}} onClick={()=>addVariant(p.id)}>+ Add Variant</button>
   </AdminModal>
 </div>)}</div></div></>;
}
