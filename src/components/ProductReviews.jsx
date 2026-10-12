import React,{useEffect,useMemo,useState} from "react";
import { supabase } from "../lib/api.js";

const starsFor = value => "★".repeat(value)+"☆".repeat(5-value);

export default function ProductReviews({product}){
  const [reviews,setReviews]=useState([]);
  const [myReview,setMyReview]=useState(null);
  const [user,setUser]=useState(null);
  const [displayName,setDisplayName]=useState("");
  const [rating,setRating]=useState(5);
  const [title,setTitle]=useState("");
  const [reviewText,setReviewText]=useState("");
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [selectedPhotos,setSelectedPhotos]=useState([]);
  const [ownPhotos,setOwnPhotos]=useState([]);
  const [publicPhotos,setPublicPhotos]=useState({});

  useEffect(()=>{
    let active=true;
    (async()=>{
      setLoading(true);
      setError("");
      const [reviewResult,authResult]=await Promise.all([
        supabase.from("product_reviews").select("id,product_id,user_id,display_name,rating,title,review_text,created_at,updated_at,is_approved").eq("product_id",product.id).order("created_at",{ascending:false}),
        supabase.auth.getUser()
      ]);
      if(reviewResult.error)throw reviewResult.error;
      if(!active)return;
      const rows=reviewResult.data||[];
      setReviews(rows.filter(review=>review.is_approved));
      const signedInUser=authResult.data?.user||null;
      setUser(signedInUser);
      if(signedInUser){
        let name="";
        try{
          const {data:profile}=await supabase.rpc("my_customer_profile");
          name=profile?.name||[profile?.first_name,profile?.last_name].filter(Boolean).join(" ");
        }catch{}
        if(!active)return;
        const ownReview=rows.find(review=>review.user_id===signedInUser.id)||null;
        setMyReview(ownReview);
        setDisplayName(ownReview?.display_name||name||signedInUser.email?.split("@")[0]||"Customer");
        if(ownReview){
          setRating(Number(ownReview.rating)||5);
          setTitle(ownReview.title||"");
          setReviewText(ownReview.review_text||"");
        }
      }
    })().catch(e=>{if(active)setError(e?.message||"Unable to load customer reviews.")}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[product.id]);

  useEffect(()=>{
    let active=true;
    const loadPhotos=async()=>{
      const ids=[...new Set([...reviews.map(r=>r.id),...(myReview?[myReview.id]:[])])];
      const results=await Promise.all(ids.map(async id=>{
        try{const session=(await supabase.auth.getSession()).data.session;const response=await fetch("https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/review-photo?action=list&review_id="+encodeURIComponent(id),{headers:{apikey:"sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC",...(session?.access_token?{Authorization:"Bearer "+session.access_token}:{})}});const data=await response.json();return [id,data.photos||[]];}catch{return [id,[]]}
      }));
      if(!active)return;const mapped=Object.fromEntries(results);setPublicPhotos(mapped);setOwnPhotos(myReview?(mapped[myReview.id]||[]):[]);
    };
    if(reviews.length||myReview)void loadPhotos();return()=>{active=false};
  },[reviews,myReview,user]);

  const ownReview=myReview;
  const average=useMemo(()=>reviews.length?reviews.reduce((total,review)=>total+Number(review.rating||0),0)/reviews.length:0,[reviews]);
  const returnUrl=encodeURIComponent(location.pathname+location.search);

  const submitReview=async event=>{
    event.preventDefault();
    setError("");
    setNotice("");
    if(!user){
      location.href="/login.html?return="+returnUrl;
      return;
    }
    const cleanText=reviewText.trim();
    if(cleanText.length<5){setError("Please write at least 5 characters about your experience.");return;}
    setSubmitting(true);
    try{
      const payload={
        product_id:product.id,
        user_id:user.id,
        display_name:displayName.trim().slice(0,80)||user.email?.split("@")[0]||"Customer",
        rating:Number(rating),
        title:title.trim().slice(0,120)||null,
        review_text:cleanText,
        updated_at:new Date().toISOString(),
        is_approved:false
      };
      const {data,error:saveError}=await supabase.from("product_reviews").upsert(payload,{onConflict:"product_id,user_id"}).select("id,product_id,user_id,display_name,rating,title,review_text,created_at,updated_at,is_approved").single();
      if(saveError)throw saveError;
      setMyReview(data);
      setReviews(previous=>previous.filter(item=>item.user_id!==user.id));
      const session=(await supabase.auth.getSession()).data.session;
      for(const file of selectedPhotos){const form=new FormData();form.append("review_id",data.id);form.append("file",file);const response=await fetch("https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/review-photo?action=upload",{method:"POST",headers:{apikey:"sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC",Authorization:"Bearer "+session?.access_token},body:form});const result=await response.json();if(!response.ok)throw new Error(result.message||"Review saved, but a photo could not be uploaded.");}
      setSelectedPhotos([]);
      const photoResponse=await fetch("https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/review-photo?action=list&review_id="+encodeURIComponent(data.id),{headers:{apikey:"sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC",Authorization:"Bearer "+session?.access_token}});
      const photoData=await photoResponse.json();setOwnPhotos(photoData.photos||[]);
      setNotice(ownReview?"Your review was updated and sent for approval again. New photos need approval too.":"Thank you! Your review has been submitted and will appear after approval.");
    }catch(e){
      setError(e?.message||"Unable to save your review. Please try again.");
    }finally{
      setSubmitting(false);
    }
  };

  return <section className="product-reviews-section" aria-labelledby="product-reviews-title">
    <div className="product-section-heading">
      <div>
        <p className="product-section-eyebrow">CUSTOMER FEEDBACK</p>
        <h2 id="product-reviews-title">Customer Reviews</h2>
      </div>
      {reviews.length>0&&<div className="product-review-summary"><span className="product-review-summary-stars" aria-label={average.toFixed(1)+" out of 5 stars"}>{starsFor(Math.round(average))}</span><strong>{average.toFixed(1)}</strong><span>{reviews.length} {reviews.length===1?"review":"reviews"}</span></div>}
    </div>

    <div className="product-reviews-layout">
      <div className="product-review-list">
        {loading?<p className="product-review-empty">Loading reviews…</p>:reviews.length===0?<div className="product-review-empty"><span className="product-review-empty-star" aria-hidden="true">☆</span><h3>Be the first to review this product</h3><p>Your feedback helps other customers choose with confidence.</p></div>:reviews.map(review=><article className="product-review-card" key={review.id}>
          <div className="product-review-card-top"><div className="product-review-avatar" aria-hidden="true">{String(review.display_name||"C").trim().charAt(0).toUpperCase()}</div><div className="product-review-author"><strong>{review.display_name}</strong><span>{review.created_at?new Date(review.created_at).toLocaleDateString("en-NP",{year:"numeric",month:"short",day:"numeric"}):""}</span></div><span className="product-review-stars" aria-label={review.rating+" out of 5 stars"}>{starsFor(Number(review.rating)||0)}</span></div>
          {review.title&&<h3 className="product-review-title">{review.title}</h3>}
          <p className="product-review-body">{review.review_text}</p>
          {(publicPhotos[review.id]||[]).some(photo=>photo.approval_status==="approved")&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>{(publicPhotos[review.id]||[]).filter(photo=>photo.approval_status==="approved").map(photo=><a key={photo.id} href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt="Customer review photo" loading="lazy" style={{width:92,height:92,objectFit:"cover",borderRadius:8}}/></a>)}</div>}
          {review.user_id===user?.id&&<span className="product-review-own-label">Your review</span>}
        </article>)}
      </div>

      <aside className="product-review-form-card">
        <h3>{ownReview?"Edit your review":"Write a review"}</h3>
        <p className="product-review-form-intro">{ownReview?(ownReview.is_approved?"Editing your review will send it for approval again.":"Your review is awaiting approval. You can still edit it."):"Tried this product? Share your thoughts with other shoppers."}</p>
        {!user?<div className="product-review-signin"><p>Sign in to leave a review.</p><a className="buy-button" href={"/login.html?return="+returnUrl}>Sign in to review</a></div>:<form onSubmit={submitReview}>
          <label className="product-review-field-label">Your rating</label>
          <div className="product-review-rating-picker" role="group" aria-label="Choose a rating from one to five stars">
            {[1,2,3,4,5].map(value=><button key={value} type="button" className={value<=rating?"selected":""} aria-label={value+" star"+(value===1?"":"s")} aria-pressed={rating===value} onClick={()=>setRating(value)}>★</button>)}
            <span>{rating} of 5</span>
          </div>
          <label className="product-review-field-label" htmlFor={"review-title-"+product.id}>Title <span>(optional)</span></label>
          <input id={"review-title-"+product.id} value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="Sum up your experience"/>
          <label className="product-review-field-label" htmlFor={"review-text-"+product.id}>Your review</label>
          <textarea id={"review-text-"+product.id} value={reviewText} onChange={e=>setReviewText(e.target.value)} rows={5} minLength={5} maxLength={2000} required placeholder="What did you like or notice about this product?"/>
          <label className="product-review-field-label" htmlFor={"review-photos-"+product.id}>Customer photos <span>(optional, up to 4 photos, 5 MB each)</span></label>
          <input id={"review-photos-"+product.id} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={e=>{const files=Array.from(e.target.files||[]);if(selectedPhotos.length+files.length>4){setError("You can add up to 4 photos per review.");e.target.value="";return;}if(files.some(file=>file.size>5*1024*1024)){setError("Each photo must be 5 MB or smaller.");e.target.value="";return;}setSelectedPhotos(items=>[...items,...files]);e.target.value="";}}/>
          {selectedPhotos.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"8px 0"}}>{selectedPhotos.map((file,index)=><div key={file.name+file.lastModified+index} style={{width:90}}><img src={URL.createObjectURL(file)} alt={file.name} style={{width:80,height:80,objectFit:"cover",borderRadius:8}}/><button type="button" className="secondary" onClick={()=>setSelectedPhotos(items=>items.filter((_,i)=>i!==index))}>Remove</button></div>)}</div>}
          {ownPhotos.filter(photo=>photo.approval_status!=="rejected").map(photo=><div key={photo.id} style={{display:"inline-flex",alignItems:"center",gap:6,margin:"6px 8px 6px 0"}}><span>{photo.approval_status==="approved"?"Approved photo":"Photo pending approval"}</span><button type="button" className="secondary" onClick={async()=>{try{const session=(await supabase.auth.getSession()).data.session;const response=await fetch("https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/review-photo?action=remove",{method:"POST",headers:{apikey:"sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC",Authorization:"Bearer "+session?.access_token,"Content-Type":"application/json"},body:JSON.stringify({photo_id:photo.id})});const result=await response.json();if(!response.ok)throw new Error(result.message);setOwnPhotos(items=>items.filter(item=>item.id!==photo.id));setNotice("Photo removed.");}catch(e){setError(e.message||"Unable to remove photo.");}}}>Remove</button></div>)}
          <label className="product-review-field-label" htmlFor={"review-name-"+product.id}>Display name</label>
          <input id={"review-name-"+product.id} value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={80} required/>
          <button type="submit" className="buy-button product-review-submit" disabled={submitting}>{submitting?"Saving…":ownReview?"Update Review":"Submit Review"}</button>
        </form>}
        {user&&error&&<p className="product-review-message error" role="alert">{error}</p>}
        {user&&notice&&<p className="product-review-message success" role="status">{notice}</p>}
        <p className="product-review-note">One review per account for each product. New reviews and edits must be approved by Suru Collection before they appear publicly.</p>
      </aside>
    </div>
  </section>;
}
