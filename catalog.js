(function(){
  function imageUrl(u){
    if(!u)return 'assets/hero.jpg';
    if(/^https?:\/\//i.test(u)||u.startsWith('/'))return u;
    return u;
  }
  function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c))}
  function money(n){return 'NPR '+Number(n||0).toLocaleString('en-IN')}
  async function load(){
    const grid=document.querySelector('#products .product-grid');
    if(!grid || !window.supabase || !window.SURU_SUPABASE_URL || !window.SURU_SUPABASE_KEY)return;
    try{
      const c=window.supabase.createClient(window.SURU_SUPABASE_URL,window.SURU_SUPABASE_KEY);
      const {data,error}=await c.from('products')
        .select('id,product_code,name,category,price,is_featured,created_at,product_images(image_url,alt_text,sort_order,is_main)')
        .eq('is_active',true).order('is_featured',{ascending:false}).order('created_at',{ascending:false});
      if(error){console.warn('Suru catalog:',error.message);return;}
      if(!data?.length)return;
      grid.innerHTML=data.map(p=>{
        const imgs=(p.product_images||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
        const main=imgs.find(x=>x.is_main)||imgs[0];
        const img=imageUrl(main?.image_url);
        return `<a class="product-card" href="product.html?code=${encodeURIComponent(p.product_code)}">
          <div class="product-img"><img src="${esc(img)}" alt="${esc(p.name)}"><span>${esc(p.product_code)}</span></div>
          <div><small>${esc(p.category||'')}</small><h3>${esc(p.name)}</h3><strong>${money(p.price)}</strong><em>View Product →</em></div>
        </a>`;
      }).join('');
    }catch(e){console.warn('Suru catalog:',e)}
  }
  document.addEventListener('DOMContentLoaded',load);
})();