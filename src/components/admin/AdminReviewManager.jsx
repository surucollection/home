import React,{useCallback,useEffect,useMemo,useState} from "react";
import { supabase } from "../../lib/api.js";

const starsFor=value=>"★".repeat(Number(value)||0)+"☆".repeat(5-(Number(value)||0));

export default function AdminReviewManager({open,onClose}){
  const [reviews,setReviews]=useState([]);
  const [filter,setFilter]=useState("pending");
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [busyId,setBusyId]=useState("");
  const [message,setMessage]=useState("");
  const [photos,setPhotos]=useState([]);
  const [photoBusy,setPhotoBusy]=useState("");

  const loadReviews=useCallback(async()=>{
    setLoading(true);setMessage("");
    try{
      const [{data:rows,error},{data:products,error:productError}]=await Promise.all([
        supabase.from("product_reviews").select("id,product_id,user_id,display_name,rating,title,review_text,created_at,updated_at,is_approved").order("created_at",{ascending:false}).limit(500),
        supabase.from("products").select("id,product_code,name")
      ]);
      if(error)throw error;
      if(productError)throw productError;
      const byId=Object.fromEntries((products||[]).map(p=>[p.id,p]));
      setReviews((rows||[]).map(r=>({...r,product:byId[r.product_id]||null})));
      const {data:photoRows,error:photoError}=await supabase.from("product_review_photos").select("id,review_id,approval_status,sort_order,created_at").order("created_at",{ascending:false}).limit(1000);
      if(photoError)throw photoError;
      setPhotos(photoRows||[]);
    }catch(e){setMessage("Unable to load reviews: "+(e?.message||"Please try again."))}
    finally{setLoading(false)}
  },[]);

  useEffect(()=>{if(open)void loadReviews()},[open,loadReviews]);

  const visible=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return reviews.filter(r=>(filter==="all"||(filter==="pending"?!r.is_approved:!!r.is_approved))&&(!q||[r.display_name,r.title,r.review_text,r.product?.name,r.product?.product_code].some(v=>String(v||"").toLowerCase().includes(q))));
  },[reviews,filter,search]);

  const setApproval=async(review,approved)=>{
    setBusyId(review.id);setMessage("");
    try{
      const {data,error}=await supabase.from("product_reviews").update({is_approved:approved}).eq("id",review.id).select("id,is_approved").single();
      if(error)throw error;
      setReviews(prev=>prev.map(r=>r.id===review.id?{...r,is_approved:data.is_approved}:r));
      setMessage(approved?"Review approved and published.":"Review hidden from product pages.");
    }catch(e){setMessage("Unable to update review: "+(e?.message||"Please try again."))}
    finally{setBusyId("")}
  };

  const deleteReview=async review=>{
    if(!window.confirm("Delete this review permanently?"))return;
    setBusyId(review.id);setMessage("");
    try{
      const {error}=await supabase.from("product_reviews").delete().eq("id",review.id);
      if(error)throw error;
      setReviews(prev=>prev.filter(r=>r.id!==review.id));
      setMessage("Review deleted.");
    }catch(e){setMessage("Unable to delete review: "+(e?.message||"Please try again."))}
    finally{setBusyId("")}
  };

  if(!open)return null;
  return <div className="modal-backdrop" onClick={()=>{if(!busyId)onClose()}}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="review-manager-title" onClick={e=>e.stopPropagation()} style={{maxWidth:"1000px",width:"min(1000px, calc(100vw - 24px))",maxHeight:"90vh",overflowY:"auto"}}>
      <div className="page-title">
        <div><h3 id="review-manager-title">Manage Customer Reviews</h3><p>Only approved reviews are visible on product pages. Editing a customer review automatically sends it back for approval.</p></div>
        <button type="button" className="secondary" onClick={onClose} disabled={!!busyId}>Close</button>
      </div>
      <div className="admin-settings-actions" style={{marginBottom:14,flexWrap:"wrap"}}>
        <button type="button" className={filter==="pending"?"primary":"secondary"} onClick={()=>setFilter("pending")}>Pending ({reviews.filter(r=>!r.is_approved).length})</button>
        <button type="button" className={filter==="approved"?"primary":"secondary"} onClick={()=>setFilter("approved")}>Approved ({reviews.filter(r=>r.is_approved).length})</button>
        <button type="button" className={filter==="all"?"primary":"secondary"} onClick={()=>setFilter("all")}>All Reviews ({reviews.length})</button>
        <button type="button" className="secondary" onClick={()=>void loadReviews()} disabled={loading||!!busyId}>Refresh</button>
      </div>
      <input aria-label="Search reviews" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product, customer or review…" style={{width:"100%",marginBottom:14}}/>
      {message&&<div className={message.startsWith("Review approved")||message.startsWith("Review hidden")||message==="Review deleted."?"message success":"message error"} role="status" style={{marginBottom:12}}>{message}</div>}
      {loading?<p>Loading reviews…</p>:visible.length===0?<div className="card"><p>No reviews in this view.</p></div>:visible.map(review=><article key={review.id} className="card" style={{marginBottom:12}}>
        <div className="page-title" style={{alignItems:"flex-start",gap:12}}>
          <div style={{minWidth:0,flex:1}}>
            <strong>{review.product?.name||"Unknown product"} {review.product?.product_code?"("+review.product.product_code+")":""}</strong>
            <p style={{margin:"5px 0"}}><b>{review.display_name}</b> · <span aria-label={review.rating+" out of 5 stars"}>{starsFor(review.rating)}</span> · {review.created_at?new Date(review.created_at).toLocaleDateString("en-NP"):""}</p>
            {review.title&&<h4 style={{margin:"8px 0"}}>{review.title}</h4>}
            <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{review.review_text}</p>
            <small className="form-note">{review.is_approved?"Approved and public":"Pending approval"}</small>
            {photos.some(photo=>photo.review_id===review.id)&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}><strong style={{width:"100%"}}>Customer photos</strong>{photos.filter(photo=>photo.review_id===review.id).map(photo=><div key={photo.id} style={{border:"1px solid var(--border,#ddd)",borderRadius:8,padding:8,minWidth:130}}>
              <img src={"https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/review-photo?action=image&id="+photo.id} alt="Customer review" style={{width:100,height:100,objectFit:"cover",borderRadius:6}}/>
              <div><small>{photo.approval_status==="approved"?"Approved":photo.approval_status==="rejected"?"Rejected":"Pending"}</small></div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
                {photo.approval_status!=="approved"&&<button type="button" className="primary" disabled={!!photoBusy} onClick={async()=>{setPhotoBusy(photo.id);try{const {data:{session}}=await supabase.auth.getSession();const response=await fetch("https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/review-photo?action=moderate",{method:"POST",headers:{apikey:"sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC",Authorization:"Bearer "+session?.access_token,"Content-Type":"application/json"},body:JSON.stringify({photo_id:photo.id,approval_status:"approved"})});const result=await response.json();if(!response.ok)throw new Error(result.message);setPhotos(prev=>prev.map(p=>p.id===photo.id?{...p,approval_status:"approved"}:p));}catch(e){setMessage("Unable to approve photo: "+(e.message||"Try again."));}finally{setPhotoBusy("");}}}>Approve photo</button>}
                {photo.approval_status!=="rejected"&&<button type="button" className="secondary" disabled={!!photoBusy} onClick={async()=>{setPhotoBusy(photo.id);try{const {data:{session}}=await supabase.auth.getSession();const response=await fetch("https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/review-photo?action=moderate",{method:"POST",headers:{apikey:"sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC",Authorization:"Bearer "+session?.access_token,"Content-Type":"application/json"},body:JSON.stringify({photo_id:photo.id,approval_status:"rejected"})});const result=await response.json();if(!response.ok)throw new Error(result.message);setPhotos(prev=>prev.map(p=>p.id===photo.id?{...p,approval_status:"rejected"}:p));}catch(e){setMessage("Unable to reject photo: "+(e.message||"Try again."));}finally{setPhotoBusy("");}}}>Reject photo</button>}
              </div>
            </div>)}</div>}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {!review.is_approved?<button type="button" className="primary" disabled={busyId===review.id} onClick={()=>void setApproval(review,true)}>{busyId===review.id?"Saving…":"Approve"}</button>:<button type="button" className="secondary" disabled={busyId===review.id} onClick={()=>void setApproval(review,false)}>{busyId===review.id?"Saving…":"Unapprove"}</button>}
            <button type="button" className="danger" disabled={busyId===review.id} onClick={()=>void deleteReview(review)}>Delete</button>
          </div>
        </div>
      </article>)}
    </div>
  </div>;
}
