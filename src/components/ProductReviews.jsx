import React,{useEffect,useMemo,useState} from "react";
import { supabase } from "../lib/api.js";

const starsFor = value => "★".repeat(value)+"☆".repeat(5-value);

export default function ProductReviews({product}){
  const [reviews,setReviews]=useState([]);
  const [user,setUser]=useState(null);
  const [displayName,setDisplayName]=useState("");
  const [rating,setRating]=useState(5);
  const [title,setTitle]=useState("");
  const [reviewText,setReviewText]=useState("");
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    let active=true;
    (async()=>{
      setLoading(true);
      setError("");
      const [reviewResult,authResult]=await Promise.all([
        supabase.from("product_reviews").select("id,product_id,user_id,display_name,rating,title,review_text,created_at,updated_at").eq("product_id",product.id).order("created_at",{ascending:false}),
        supabase.auth.getUser()
      ]);
      if(reviewResult.error)throw reviewResult.error;
      if(!active)return;
      const rows=reviewResult.data||[];
      setReviews(rows);
      const signedInUser=authResult.data?.user||null;
      setUser(signedInUser);
      if(signedInUser){
        let name="";
        try{
          const {data:profile}=await supabase.rpc("my_customer_profile");
          name=profile?.name||[profile?.first_name,profile?.last_name].filter(Boolean).join(" ");
        }catch{}
        if(!active)return;
        const ownReview=rows.find(review=>review.user_id===signedInUser.id);
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

  const ownReview=useMemo(()=>reviews.find(review=>review.user_id===user?.id)||null,[reviews,user?.id]);
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
        updated_at:new Date().toISOString()
      };
      const {data,error:saveError}=await supabase.from("product_reviews").upsert(payload,{onConflict:"product_id,user_id"}).select("id,product_id,user_id,display_name,rating,title,review_text,created_at,updated_at").single();
      if(saveError)throw saveError;
      setReviews(previous=>[data,...previous.filter(item=>item.user_id!==user.id)].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
      setNotice(ownReview?"Your review has been updated.":"Thank you for sharing your review!");
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
          {review.user_id===user?.id&&<span className="product-review-own-label">Your review</span>}
        </article>)}
      </div>

      <aside className="product-review-form-card">
        <h3>{ownReview?"Edit your review":"Write a review"}</h3>
        <p className="product-review-form-intro">{ownReview?"Update your rating or tell us more about your experience.":"Tried this product? Share your thoughts with other shoppers."}</p>
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
          <label className="product-review-field-label" htmlFor={"review-name-"+product.id}>Display name</label>
          <input id={"review-name-"+product.id} value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={80} required/>
          <button type="submit" className="buy-button product-review-submit" disabled={submitting}>{submitting?"Saving…":ownReview?"Update Review":"Submit Review"}</button>
        </form>}
        {user&&error&&<p className="product-review-message error" role="alert">{error}</p>}
        {user&&notice&&<p className="product-review-message success" role="status">{notice}</p>}
        <p className="product-review-note">One review per account for each product. You can edit your review later.</p>
      </aside>
    </div>
  </section>;
}
