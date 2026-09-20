(function(){
const c=window.supabase.createClient(window.SURU_SUPABASE_URL,window.SURU_SUPABASE_KEY);
const esc=s=>String(s??'').replace(/[&<>'"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[x]));
function addStyles(){if(document.getElementById('productCreateStyles'))return;const s=document.createElement('style');s.id='productCreateStyles';s.textContent=`#addProductBtn{margin-left:auto}.pc-form{margin:16px 0}.pc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pc-grid label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600}.pc-grid input,.pc-grid textarea,.pc-grid select{padding:10px;border:1px solid #dfd2cc;border-radius:7px;background:#fff}.pc-grid textarea{min-height:90px}.pc-full{grid-column:1/-1}.pc-sizes{display:grid;gap:8px}.pc-size{display:grid;grid-template-columns:90px repeat(5,minmax(70px,1fr)) 34px;gap:6px;align-items:center}.pc-size input{min-width:0}.pc-actions{display:flex;gap:8px;margin-top:14px}.pc-msg{margin-top:8px;font-size:12px}.pc-ok{color:#2e6d46}.pc-err{color:#a33b3b}.pc-preview{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.pc-preview img{width:65px;height:75px;object-fit:cover;border-radius:5px;border:1px solid #ddd}@media(max-width:700px){.pc-grid{grid-template-columns:1fr}.pc-full{grid-column:auto}.pc-size{grid-template-columns:1fr 1fr; padding:8px;border:1px solid #eaded8;border-radius:7px}}`;document.head.appendChild(s)}
function formHTML(){return `<div class="card pc-form"><h3>Add New Product</h3><form id="pcForm"><div class="pc-grid">
<label>Product Code *<input name="product_code" placeholder="SC004" required></label>
<label>Product Name *<input name="name" required></label>
<label>Category *<input name="category" placeholder="Sarees / Kurtis / Gowns" required></label>
<label>Price (NPR) *<input name="price" type="number" min="0" step="0.01" required></label>
<label>MOQ *<input name="moq" type="number" min="0" value="1" required></label>
<label>Fabric<input name="fabric"></label><label>Color<input name="color"></label><label>Pattern<input name="pattern"></label>
<label>Dispatch<input name="dispatch" placeholder="5 Days"></label>
<label class="pc-full">Description<textarea name="description"></textarea></label>
<label class="pc-full">Product Images *<input id="pcImages" type="file" accept="image/*" multiple required><div id="pcPreview" class="pc-preview"></div></label>
<div class="pc-full"><b>Sizes & Stock</b><div id="pcSizes" class="pc-sizes"></div><button type="button" class="secondary" id="pcAddSize">＋ Add Size</button></div>
<label><span><input type="checkbox" name="is_featured"> Featured</span></label><label><span><input type="checkbox" name="is_active" checked> Active / visible</span></label>
</div><div class="pc-actions"><button class="primary" type="submit">Create Product</button><button class="secondary" type="button" id="pcCancel">Cancel</button></div><div id="pcMsg" class="pc-msg"></div></form></div>`}
function init(){
 addStyles();const products=document.getElementById('products'),title=products?.querySelector('.page-title');if(!products||!title||document.getElementById('addProductBtn'))return;
 const b=document.createElement('button');b.id='addProductBtn';b.className='primary';b.type='button';b.textContent='＋ Add Product';title.appendChild(b);
 b.onclick=()=>{if(!document.getElementById('pcForm')){products.insertAdjacentHTML('beforeend',formHTML());bind()}document.querySelector('.pc-form').scrollIntoView({behavior:'smooth',block:'start'})};
}
function bind(){
 const sizes=[],wrap=document.getElementById('pcSizes');
 function render(){wrap.innerHTML=sizes.map((s,i)=>`<div class="pc-size"><input value="${esc(s.size)}" placeholder="Size" data-i="${i}" data-k="size"><input value="${s.bust??''}" placeholder="Bust" data-i="${i}" data-k="bust"><input value="${s.waist??''}" placeholder="Waist" data-i="${i}" data-k="waist"><input value="${s.hip??''}" placeholder="Hip" data-i="${i}" data-k="hip"><input value="${s.shoulder??''}" placeholder="Shoulder" data-i="${i}" data-k="shoulder"><input value="${s.stock??0}" type="number" min="0" placeholder="Stock" data-i="${i}" data-k="stock"><button type="button" class="danger pc-remove" data-i="${i}">×</button></div>`).join('')}
 document.getElementById('pcAddSize').onclick=()=>{const v=prompt('Size name (e.g. S, M, L, XL, XXL):');if(v){sizes.push({size:v.trim(),stock:0});render()}};
 wrap.addEventListener('input',e=>{if(e.target.dataset.i===undefined)return;sizes[Number(e.target.dataset.i)][e.target.dataset.k]=e.target.value});
 wrap.addEventListener('click',e=>{if(e.target.classList.contains('pc-remove')){sizes.splice(Number(e.target.dataset.i),1);render()}});
 document.getElementById('pcImages').onchange=()=>document.getElementById('pcPreview').innerHTML=[...document.getElementById('pcImages').files].map(f=>`<img src="${URL.createObjectURL(f)}">`).join('');
 document.getElementById('pcCancel').onclick=()=>document.querySelector('.pc-form').remove();
 document.getElementById('pcForm').onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.target),m=document.getElementById('pcMsg');m.textContent='Creating product…';m.className='pc-msg';
  try{
   const code=f.get('product_code').trim().toUpperCase(),name=f.get('name').trim();
   const slug=code.toLowerCase()+'-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
   const payload={product_code:code,name,slug,category:f.get('category').trim(),description:f.get('description')||null,price:Number(f.get('price')),moq:Number(f.get('moq')),fabric:f.get('fabric')||null,color:f.get('color')||null,pattern:f.get('pattern')||null,dispatch:f.get('dispatch')||null,is_featured:f.has('is_featured'),is_active:f.has('is_active')};
   const {data:p,error}=await c.from('products').insert(payload).select('id').single();if(error)throw error;
   const files=[...document.getElementById('pcImages').files];if(!files.length)throw new Error('Select at least one image.');
   for(let i=0;i<files.length;i++){const file=files[i],ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=code+'/'+crypto.randomUUID()+'.'+ext;
    const up=await c.storage.from('product-images').upload(path,file,{upsert:false});if(up.error)throw up.error;
    const url=c.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    const ins=await c.from('product_images').insert({product_id:p.id,image_url:url,alt_text:name,sort_order:i,is_main:i===0});if(ins.error)throw ins.error;
   }
   if(sizes.length){const rows=sizes.map(s=>({product_id:p.id,size:String(s.size).trim(),bust:s.bust?Number(s.bust):null,waist:s.waist?Number(s.waist):null,hip:s.hip?Number(s.hip):null,shoulder:s.shoulder?Number(s.shoulder):null,stock:Math.max(0,Number(s.stock||0)),unit:'inch',is_active:true}));const ins=await c.from('product_sizes').insert(rows);if(ins.error)throw ins.error}
   m.textContent='Product created successfully. Refreshing product list…';m.className='pc-msg pc-ok';
   if(typeof loadProducts==='function')await loadProducts();setTimeout(()=>document.querySelector('.pc-form')?.remove(),800);
  }catch(err){m.textContent='Create failed: '+(err?.message||err);m.className='pc-msg pc-err'}
 };
 render();
}
document.addEventListener('DOMContentLoaded',()=>{init();setTimeout(init,1200)});
})();