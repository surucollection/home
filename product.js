(function(){
  const c=window.supabase.createClient(window.SURU_SUPABASE_URL,window.SURU_SUPABASE_KEY);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[x]));
  const money=n=>'NPR '+Number(n||0).toLocaleString('en-IN');
  const imgUrl=u=>u||'assets/hero.jpg';
  function addCart(item){
    let cart=[];try{cart=JSON.parse(localStorage.getItem('suruCart')||'[]')}catch(e){}
    const found=cart.find(x=>x.code===item.code&&x.size===item.size);
    if(found)found.qty+=item.qty;else cart.push(item);
    localStorage.setItem('suruCart',JSON.stringify(cart));
    document.querySelectorAll('#cartCount').forEach(x=>x.textContent=cart.reduce((a,v)=>a+(v.qty||0),0));
    alert('Added to your cart.');
  }
  async function load(){
    const root=document.getElementById('dynamicProduct'); if(!root)return;
    const code=new URLSearchParams(location.search).get('code');
    if(!code){root.innerHTML='<p>Product not found.</p>';return}
    const {data:p,error}=await c.from('products').select('*,product_images(*),product_sizes(*)').eq('product_code',code).eq('is_active',true).maybeSingle();
    if(error||!p){root.innerHTML='<p>Product not found.</p>';return}
    const imgs=(p.product_images||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    const main=imgs.find(x=>x.is_main)||imgs[0];
    const sizes=(p.product_sizes||[]).filter(x=>x.is_active!==false).sort((a,b)=>String(a.size).localeCompare(String(b.size),undefined,{numeric:true}));
    root.innerHTML=`<div class="breadcrumbs"><a href="index.html">Home</a><span>›</span><b>${esc(p.product_code)}</b></div>
      <section class="product-layout"><div class="gallery">
      <div class="main-photo"><img id="mainProductImage" src="${esc(imgUrl(main?.image_url))}" alt="${esc(p.name)}"></div>
      <div class="thumbs">${imgs.map(x=>`<button class="thumb" type="button" data-src="${esc(x.image_url)}"><img src="${esc(x.image_url)}" alt="${esc(x.alt_text||p.name)}"></button>`).join('')}</div>
      </div><div class="product-info"><p class="eyebrow">${esc(p.category||'')}</p><h1>${esc(p.name)}</h1><div class="price">${money(p.price)}</div>
      <p class="intro">${esc(p.description||'A thoughtfully selected piece from Suru Collection, designed for elegant occasions and effortless traditional style.')}</p>
      <ul class="detail-list">${[['Fabric',p.fabric],['Color',p.color],['Pattern',p.pattern],['MOQ',p.moq]].filter(x=>x[1]!==null&&x[1]!==undefined&&x[1]!=='').map(x=>`<li><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong></li>`).join('')}</ul>
      <div class="dispatch"><span>Dispatch</span><strong>${esc(p.dispatch||'As per product')}</strong></div>
      <div class="buy-box">${sizes.length?`<label for="size">Select Size</label><select id="size" class="size-select"><option value="">Choose size</option>${sizes.map(s=>`<option value="${esc(s.size)}" ${Number(s.stock||0)<=0?'disabled':''}>${esc(s.size)}${Number(s.stock||0)<=0?' — Out of stock':''}</option>`).join('')}</select>`:''}
      <div class="qty-row"><label for="qty">Quantity</label><input id="qty" class="qty-input" type="number" min="1" value="1"></div>
      <button type="button" class="buy-button" id="dynamicAdd">Add to Cart</button></div>
      <a class="wa-button" target="_blank" rel="noopener" href="https://wa.me/9779740381427?text=${encodeURIComponent('Hello Suru Collection, I am interested in '+p.product_code+' - '+p.name+'. Please share availability and ordering details.')}">Enquire Now <span>→</span></a>
      <p class="small-note">Prices are in Nepalese Rupees. Availability is subject to stock.</p></div></section>
      ${sizes.length?`<section class="size-section"><p class="eyebrow">SIZE GUIDE</p><h2>Measurements</h2><div class="table-wrap"><table><thead><tr><th>Size</th><th>Bust</th><th>Length</th><th>Waist</th><th>Hip</th><th>Shoulder</th><th>Stock</th></tr></thead><tbody>${sizes.map(s=>`<tr><th>${esc(s.size)}</th><td>${s.bust??'—'} in</td><td>${s.top_length??'—'} in</td><td>${s.waist??'—'} in</td><td>${s.hip??'—'} in</td><td>${s.shoulder??'—'} in</td><td>${Number(s.stock||0)}</td></tr>`).join('')}</tbody></table></div></section>`:''}`;
    document.querySelectorAll('.thumb').forEach(b=>b.onclick=()=>document.getElementById('mainProductImage').src=b.dataset.src);
    document.getElementById('dynamicAdd').onclick=()=>{
      const size=document.getElementById('size')?.value||'',qty=Math.max(1,parseInt(document.getElementById('qty').value||1,10)||1);
      if(sizes.length&&!size){alert('Please select a size first.');return}
      const s=sizes.find(x=>x.size===size);if(s&&qty>Number(s.stock||0)){alert('Not enough stock for this size.');return}
      addCart({code:p.product_code,name:p.name,price:Number(p.price),image:imgUrl(main?.image_url),size,qty});
    };
  }
  document.addEventListener('DOMContentLoaded',load);
})();