
const pc = window.supabase.createClient(window.SURU_SUPABASE_URL, window.SURU_SUPABASE_KEY);
const escP = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const moneyP = n => 'NPR ' + Number(n||0).toLocaleString('en-IN');

function addToCart(product, size, qty){
  const key = product.product_code + '|' + (size || '');
  const cart = JSON.parse(localStorage.getItem('suruCart') || '[]');
  const found = cart.find(x => x.key === key);
  if(found) found.quantity += qty;
  else cart.push({key, product_id:product.id, product_code:product.product_code, product_name:product.name, price:Number(product.price), size:size||'', quantity:qty, image:product.image});
  localStorage.setItem('suruCart', JSON.stringify(cart));
  alert('Added to cart.');
}

async function loadProduct(){
  const code = new URLSearchParams(location.search).get('code');
  const root = document.querySelector('#dynamicProduct');
  if(!root) return;
  if(!code){ root.innerHTML='<p>Product not found.</p>'; return; }

  const {data:p,error} = await pc.from('products')
    .select('*, product_images(*), product_sizes(*)')
    .eq('product_code', code).eq('is_active', true).maybeSingle();

  if(error || !p){ root.innerHTML='<p>Product not found.</p>'; return; }

  const imgs=(p.product_images||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const main=imgs.find(x=>x.is_main)||imgs[0];
  p.image=main?.image_url || 'assets/hero.jpg';
  const sizes=(p.product_sizes||[]).filter(s=>s.is_active!==false).sort((a,b)=>(a.size||'').localeCompare(b.size||'',undefined,{numeric:true}));

  root.innerHTML=`
    <div class="product-layout">
      <div>
        <div class="main-photo"><img id="mainProductImage" src="${escP(p.image)}" alt="${escP(p.name)}"></div>
        <div class="thumbs">${imgs.map((im,i)=>`<button class="thumb" data-img="${escP(im.image_url)}"><img src="${escP(im.image_url)}" alt="${escP(im.alt_text||p.name)}"></button>`).join('')}</div>
      </div>
      <div class="product-info">
        <p class="eyebrow">${escP(p.category)}</p>
        <h1>${escP(p.name)}</h1>
        <p class="small-note">Product Code: ${escP(p.product_code)}</p>
        <div class="price">${moneyP(p.price)} ${p.compare_at_price ? `<del class="small-note">${moneyP(p.compare_at_price)}</del>`:''}</div>
        <p class="intro">${escP(p.description||'')}</p>
        <ul class="detail-list">
          ${[['Fabric',p.fabric],['Color',p.color],['Pattern',p.pattern],['MOQ',p.moq]].filter(x=>x[1]!==null&&x[1]!==undefined&&x[1]!=='').map(x=>`<li><span>${escP(x[0])}</span><strong>${escP(x[1])}</strong></li>`).join('')}
        </ul>
        ${sizes.length ? `<div class="size-picker"><label><b>Size</b><select id="productSize"><option value="">Select size</option>${sizes.map(s=>`<option value="${escP(s.size)}" ${Number(s.stock||0)<=0?'disabled':''}>${escP(s.size)}${Number(s.stock||0)<=0?' — Out of stock':''}</option>`).join('')}</select></label></div>` : ''}
        <label class="qty-picker"><b>Quantity</b><input id="productQty" type="number" min="1" value="1"></label>
        <button id="addCartBtn" class="wa-button" type="button">Add to Cart</button>
        <a class="wa-button" style="margin-top:10px" target="_blank" rel="noopener" href="https://wa.me/9779740381427?text=${encodeURIComponent('Hello Suru Collection, I am interested in '+p.name+' ('+p.product_code+').')}">Enquire on WhatsApp</a>
      </div>
    </div>
    ${sizes.length ? `<section class="size-section"><h2>Size & Measurements</h2><div class="table-wrap"><table><thead><tr><th>Size</th><th>Bust</th><th>Waist</th><th>Hip</th><th>Shoulder</th><th>Top Length</th><th>Bottom Length</th><th>Dupatta</th><th>Stock</th></tr></thead><tbody>${sizes.map(s=>`<tr><th>${escP(s.size)}</th><td>${s.bust??'—'}</td><td>${s.waist??'—'}</td><td>${s.hip??'—'}</td><td>${s.shoulder??'—'}</td><td>${s.top_length??'—'}</td><td>${s.bottom_length??'—'}</td><td>${s.dupatta_length??'—'}</td><td>${Number(s.stock||0)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
  `;

  document.querySelectorAll('.thumb').forEach(b=>b.onclick=()=>document.querySelector('#mainProductImage').src=b.dataset.img);
  document.querySelector('#addCartBtn').onclick=()=>{
    const size=document.querySelector('#productSize')?.value || '';
    if(sizes.length && !size){alert('Please select a size.');return;}
    const qty=Math.max(1,parseInt(document.querySelector('#productQty').value||1,10));
    const selected=sizes.find(s=>s.size===size);
    if(selected && qty>Number(selected.stock||0)){alert('Not enough stock for this size.');return;}
    addToCart(p,size,qty);
  };
}
document.addEventListener('DOMContentLoaded',loadProduct);
