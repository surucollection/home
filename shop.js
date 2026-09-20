(function(){
  const KEY='suruCart';
  const SUPABASE_CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  let supabasePromise;

  async function getSupabase(){
    if(!supabasePromise){
      supabasePromise=import(SUPABASE_CDN).then(({createClient})=>
        createClient(window.SURU_SUPABASE_URL,window.SURU_SUPABASE_PUBLISHABLE_KEY)
      );
    }
    return supabasePromise;
  }
  window.suruSupabase=getSupabase;

  function getCart(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){return []}}
  function saveCart(c){localStorage.setItem(KEY,JSON.stringify(c));updateCount();}
  function add(item){
    const c=getCart();
    const size=item.size||'';
    const existing=c.find(x=>x.code===item.code && x.size===size);
    if(existing) existing.qty+=item.qty||1; else c.push({...item,qty:item.qty||1});
    saveCart(c); alert('Added to your cart.');
  }
  function updateCount(){
    const n=getCart().reduce((a,x)=>a+(x.qty||0),0);
    document.querySelectorAll('#cartCount').forEach(x=>x.textContent=n);
  }
  document.addEventListener('click',function(e){
    const b=e.target.closest('.add-cart,.buy-button'); if(!b)return;
    e.preventDefault(); e.stopPropagation();
    const page=b.classList.contains('buy-button');
    const size=page?(document.querySelector('#size')?.value||''):'';
    const qty=Math.max(1,parseInt(page?(document.querySelector('#qty')?.value||1):1,10)||1);
    if(page && !size){alert('Please select a size first.');return;}
    add({code:b.dataset.code,name:b.dataset.name,price:Number(b.dataset.price),image:b.dataset.image,size,qty});
  });
  updateCount();
})();
