import React,{useCallback,useEffect,useState} from "react";
import { supabase, imageUrl, money } from "../lib/api.js";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";

const GUEST_WISHLIST_KEY="suruGuestWishlist";

function readGuestIds(){
  try{
    const value=JSON.parse(localStorage.getItem(GUEST_WISHLIST_KEY)||"[]");
    return Array.isArray(value)?[...new Set(value.filter(id=>typeof id==="string"))]:[];
  }catch{return []}
}

export default function Wishlist(){
  const[session,setSession]=useState(null);
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[busyId,setBusyId]=useState("");
  const[error,setError]=useState("");
  const[notice,setNotice]=useState("");

  const load=useCallback(async(suppliedSession)=>{
    setLoading(true);
    setError("");
    setNotice("");
    try{
      let activeSession=suppliedSession;
      if(activeSession===undefined){
        const{data,error:sessionError}=await supabase.auth.getSession();
        if(sessionError)throw sessionError;
        activeSession=data?.session||null;
      }
      setSession(activeSession||null);
      let ids=[];
      let customerId="";
      if(activeSession?.user?.id){
        const{data:customer,error:customerError}=await supabase.from("customers")
          .select("id").eq("auth_user_id",activeSession.user.id).maybeSingle();
        if(customerError)throw customerError;
        customerId=customer?.id||"";
        if(customerId){
          const guestIds=readGuestIds();
          if(guestIds.length){
            const rows=guestIds.map(product_id=>({customer_id:customerId,product_id}));
            const{error:mergeError}=await supabase.from("customer_wishlist")
              .upsert(rows,{onConflict:"customer_id,product_id",ignoreDuplicates:true});
            if(mergeError)throw mergeError;
            localStorage.removeItem(GUEST_WISHLIST_KEY);
          }
          const{data:saved,error:savedError}=await supabase.from("customer_wishlist")
            .select("product_id,created_at").eq("customer_id",customerId).order("created_at",{ascending:false});
          if(savedError)throw savedError;
          ids=(saved||[]).map(row=>row.product_id).filter(Boolean);
        }else{
          ids=readGuestIds();
          setNotice("Your signed-in customer profile is still being prepared. Guest-saved items remain available on this device.");
        }
      }else{
        ids=readGuestIds();
        setNotice("Guest wishlist is saved on this device. Sign in to sync your saved styles across devices.");
      }

      if(!ids.length){setItems([]);return;}
      const[productResult,imageResult]=await Promise.all([
        supabase.from("products").select("id,product_code,name,price,compare_at_price,category,is_active")
          .in("id",ids).eq("is_active",true),
        supabase.from("product_images").select("id,product_id,image_url,alt_text,is_main,sort_order,media_type")
          .in("product_id",ids).order("sort_order",{ascending:true})
      ]);
      if(productResult.error)throw productResult.error;
      if(imageResult.error)throw imageResult.error;
      const imageMap=new Map();
      (imageResult.data||[]).forEach(image=>{
        if(image.media_type==="video")return;
        const rows=imageMap.get(image.product_id)||[];
        rows.push(image);
        imageMap.set(image.product_id,rows);
      });
      const byId=new Map((productResult.data||[]).map(product=>{
        const images=imageMap.get(product.id)||[];
        const main=images.find(image=>image.is_main)||images[0];
        return [product.id,{...product,image:main?.image_url||"",imageAlt:main?.alt_text||product.name||""}];
      }));
      setItems(ids.map(id=>byId.get(id)).filter(Boolean));
    }catch(e){
      setError(e?.message||"Unable to load your wishlist.");
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{
    void load();
    const{data:listener}=supabase.auth.onAuthStateChange((_event,nextSession)=>{void load(nextSession||null)});
    return()=>listener.subscription.unsubscribe();
  },[load]);

  async function removeItem(productId){
    if(busyId)return;
    setBusyId(productId);
    setError("");
    try{
      if(session?.user?.id){
        const{data:customer,error:customerError}=await supabase.from("customers")
          .select("id").eq("auth_user_id",session.user.id).maybeSingle();
        if(customerError)throw customerError;
        if(customer?.id){
          const{error:removeError}=await supabase.from("customer_wishlist").delete()
            .eq("customer_id",customer.id).eq("product_id",productId);
          if(removeError)throw removeError;
        }else{
          localStorage.setItem(GUEST_WISHLIST_KEY,JSON.stringify(readGuestIds().filter(id=>id!==productId)));
        }
      }else{
        localStorage.setItem(GUEST_WISHLIST_KEY,JSON.stringify(readGuestIds().filter(id=>id!==productId)));
      }
      setItems(previous=>previous.filter(item=>item.id!==productId));
      setNotice("Product removed from your wishlist.");
    }catch(e){
      setError(e?.message||"Could not remove this product.");
    }finally{
      setBusyId("");
    }
  }

  const returnUrl=encodeURIComponent("/wishlist/");
  return <>
    <Header/>
    <main className="page wishlist-page">
      <section className="account-card">
        <div className="account-section-heading">
          <div>
            <p className="account-section-kicker">SAVED FOR LATER</p>
            <h1>My Wishlist</h1>
            <p>{session?"Your saved styles are shared with your Suru Collection app account.":"Save styles on this device and sign in later to sync them across devices."}</p>
          </div>
          <a className="btn secondary" href="/products.html">Explore Products</a>
        </div>

        {loading?<p className="account-security-muted">Loading your wishlist…</p>:
          error?<div className="message error" role="alert">{error}</div>:
          !items.length?<div className="account-security-muted">
            <p>Your wishlist is empty. Tap the heart on a product to save it here.</p>
            {!session&&<p><a href={"/login.html?return="+returnUrl}>Sign in</a> to sync your saved styles across devices.</p>}
          </div>:
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:14}}>
            {items.map(item=><article key={item.id} style={{border:"1px solid var(--border,#e9dfd8)",borderRadius:12,overflow:"hidden",background:"#fff"}}>
              <a href={"/product.html?code="+encodeURIComponent(item.product_code)} style={{display:"block",color:"inherit",textDecoration:"none"}}>
                {item.image?<img src={imageUrl(item.image,540)} alt={item.imageAlt||item.name} loading="lazy" style={{width:"100%",height:190,objectFit:"cover",display:"block"}}/>:<div style={{height:190,display:"grid",placeItems:"center",background:"#f8f2ee"}}>Suru Collection</div>}
                <div style={{padding:"10px 11px"}}>
                  <strong style={{display:"block",fontSize:13,lineHeight:1.4}}>{item.name}</strong>
                  <span style={{display:"block",marginTop:6,fontWeight:800,color:"var(--primary,#65413c)"}}>{money(item.price)}</span>
                </div>
              </a>
              <button className="btn secondary" type="button" disabled={!!busyId} onClick={()=>removeItem(item.id)} style={{margin:"0 10px 10px",width:"calc(100% - 20px)"}}>{busyId===item.id?"Removing…":"♥ Remove"}</button>
            </article>)}
          </div>}

        {!loading&&notice&&<div className="message">{notice}</div>}
        <div className="account-profile-actions" style={{marginTop:20}}>
          {!session&&<a className="btn" href={"/login.html?return="+returnUrl}>Sign in or create account</a>}
          <a className="btn secondary" href="/account/">My Account</a>
          <a className="btn secondary" href="/products.html">Continue shopping</a>
        </div>
      </section>
    </main>
    <Footer/>
  </>;
}
