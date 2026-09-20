(function(){
 const client=window.supabase.createClient(window.SURU_SUPABASE_URL,window.SURU_SUPABASE_KEY);
 const code=new URLSearchParams(location.search).get('code'); const root=document.querySelector('#productRoot');
 const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));
 const money=n=>'NPR '+Number(n||0).toLocaleString('en-IN');
 async function load(){
  if(!code){root.innerHTML='<p class="message error">Product code is missing.</p>';return;}
  const {data:p,error}=await client.from('products').select('*,product_images(image_url,alt_text,sort_order,is_main),product_sizes(size,bust,waist,hip,shoulder,top_length,bottom_length,dupatta_length,unit,stock,is_active)').eq('product_code',code).eq('is_active',true).single();
  if(error||!p){root.innerHTML='<p class="message error">Product not found.</p>';return;}
  document.title=`${p.product_code} | ${p.name} — Suru Collection`; document.querySelector('#crumbCode').textContent=p.product_code;
  const imgs=(p.product_images||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)); const main=imgs.find(x=>x.is_main)||imgs[0];
  const sizes=(p.product_sizes||[]).filter(x=>x.is_active);
  root.innerHTML=`<div class="gallery"><div class="main-photo"><img id="mainProductImage" src="${esc(main?.image_url||'assets/hero.jpg')}" alt="${esc(p.name)}"></div><div class="thumbs">${imgs.map((x,i)=>`<button class="thumb" data-src="${esc(x.image_url)}" aria-label="View image ${i+1}"><img src="${esc(x.image_url)}" alt="${esc(x.alt_text||p.name)}"></button>`).join('')}</div></div><div class="product-info"><p class="eyebrow">${esc((p.category||'').toUpperCase())}</p><h1>${esc(p.name)}</h1><div class="price">${money(p.price)}</div><p class="intro">${esc(p.description||'A thoughtfully selected piece from Suru Collection, designed for elegant occasions and effortless traditional style.')}</p><ul class="detail-list">${p.fabric?`<li><span>Fabric</span><strong>${esc(p.fabric)}</strong></li>`:''}${p.color?`<li><span>Color</span><strong>${esc(p.color)}</strong></li>`:''}${p.pattern?`<li><span>Pattern</span><strong>${esc(p.pattern)}</strong></li>`:''}<li><span>MOQ</span><strong>${Number(p.moq||1)}</strong></li></ul>${sizes.length?`<label class="size-label">Size<select id="size"><option value="">Select size</option>${sizes.map(s=>`<option value="${esc(s.size)}" ${s.stock<=0?'disabled':''}>${esc(s.size)}${s.stock<=0?' — Out of stock':''}</option>`).join('')}</select></label>`:''}<label class="qty-label">Quantity<input id="qty" type="number" min="1" value="1"></label><div class="product-actions"><button class="hero-btn buy-button" data-code="${esc(p.product_code)}" data-name="${esc(p.name)}" data-price="${Number(p.price||0)}" data-image="${esc(main?.image_url||'assets/hero.jpg')}">Add to Cart</button><a class="hero-btn" target="_blank" rel="noopener" href="https://wa.me/9779740381427?text=${encodeURIComponent('Hello Suru Collection, I am interested in '+p.product_code+' - '+p.name+'. Please share availability and ordering details.')}">Enquire on WhatsApp</a></div></div>`;
  document.querySelectorAll('.thumb').forEach(b=>b.addEventListener('click',()=>document.querySelector('#mainProductImage').src=b.dataset.src));
 }
 load();
})();
