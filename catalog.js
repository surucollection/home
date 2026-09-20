(function(){
  const client=window.supabase.createClient(window.SURU_SUPABASE_URL,window.SURU_SUPABASE_KEY);
  const money=n=>'NPR '+Number(n||0).toLocaleString('en-IN');
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));
  async function load(){
    const grid=document.querySelector('#products .product-grid'); if(!grid)return;
    const {data:products,error}=await client.from('products').select('id,product_code,name,slug,category,description,price,is_active,is_featured,product_images(image_url,alt_text,sort_order,is_main)').eq('is_active',true).order('is_featured',{ascending:false}).order('created_at',{ascending:false});
    if(error){console.error('Catalog:',error);return;}
    if(!products?.length){grid.innerHTML='<p>No products available right now. Please check back soon.</p>';return;}
    grid.innerHTML=products.map(p=>{
      const imgs=(p.product_images||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
      const img=(imgs.find(x=>x.is_main)||imgs[0])?.image_url||'assets/hero.jpg';
      const path='product.html?code='+encodeURIComponent(p.product_code);
      return `<a class="product-card" href="${path}"><div class="product-img"><img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" onerror="this.src='assets/hero.jpg'"><span>${esc(p.product_code)}</span></div><div><small>${esc((p.category||'').toUpperCase())}</small><h3>${esc(p.name)}</h3><strong>${money(p.price)}</strong><em>View Product →</em><button type="button" class="add-cart" data-code="${esc(p.product_code)}" data-name="${esc(p.name)}" data-price="${Number(p.price||0)}" data-image="${esc(img)}">Add to Cart</button></div></a>`;
    }).join('');
  }
  load();
})();
