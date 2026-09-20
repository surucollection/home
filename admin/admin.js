
const client=window.supabase.createClient(window.SURU_SUPABASE_URL,window.SURU_SUPABASE_KEY);
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));
const money=n=>'NPR '+Number(n||0).toLocaleString('en-IN');
function msg(el,text,type=''){el.textContent=text;el.className='message '+type}

async function isAdmin(){
 const {data:{session}}=await client.auth.getSession(); if(!session?.user)return{ok:false,error:'No active session.'};
 const {data,error}=await client.rpc('is_admin'); if(error)return{ok:false,error:error.message};
 return{ok:data===true,error:data===true?'':'This account is not authorized for the admin panel.'};
}
async function start(){
 try{const{data:{session}}=await client.auth.getSession();
 if(!session){$('#loginView').classList.remove('hidden');$('#appView').classList.add('hidden');return}
 const admin=await isAdmin(); if(!admin.ok){await client.auth.signOut();$('#loginView').classList.remove('hidden');$('#appView').classList.add('hidden');msg($('#loginMessage'),admin.error,'error');return}
 $('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');$('#userEmail').textContent=session.user.email||'';loadDashboard();
 }catch(e){msg($('#loginMessage'),'Connection error: '+(e?.message||e),'error')}
}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();msg($('#loginMessage'),'Signing in…');const{error}=await client.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});if(error){msg($('#loginMessage'),error.message,'error');return}start()});
$('#logoutBtn').onclick=async()=>{await client.auth.signOut();location.reload()};

$$('.sidebar button[data-view]').forEach(b=>b.onclick=()=>{
 $$('.sidebar button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
 $$('.view').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.view).classList.add('active');
 $('#viewTitle').textContent=b.textContent.trim();
 ({dashboard:loadDashboard,orders:loadOrders,products:loadProducts,inventory:loadInventory,subscribers:loadSubscribers}[b.dataset.view])();
});

async function loadDashboard(){
 const[{count:orders},{count:products},{count:subs},{data:pending}]=await Promise.all([
 client.from('orders').select('*',{count:'exact',head:true}),
 client.from('products').select('*',{count:'exact',head:true}).eq('is_active',true),
 client.from('newsletter_subscribers').select('*',{count:'exact',head:true}).eq('is_active',true),
 client.from('orders').select('id,order_number,customer_name,customer_phone,total,order_status,created_at').order('created_at',{ascending:false}).limit(5)
 ]);
 $('#statOrders').textContent=orders??0;$('#statProducts').textContent=products??0;$('#statSubscribers').textContent=subs??0;
 $('#statPending').textContent=(pending||[]).filter(x=>x.order_status==='pending').length;renderOrderTable($('#recentOrders'),pending||[],false);
}
function renderOrderTable(el,rows,full=true){
 if(!rows.length){el.innerHTML='<p>No orders found.</p>';return}
 el.innerHTML='<div style="overflow:auto"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th>'+(full?'<th>Update</th>':'')+'</tr></thead><tbody>'+
 rows.map(o=>`<tr><td><b>${esc(o.order_number)}</b>${full?`<div class="order-items" data-items="${esc(o.id)}"></div>`:''}</td><td>${esc(o.customer_name)}<br><small>${esc(o.customer_phone||'')}</small></td><td>${money(o.total)}</td><td><span class="badge">${esc(o.order_status)}</span></td><td>${new Date(o.created_at).toLocaleString()}</td>${full?`<td><select class="status-select" data-id="${o.id}">${['pending','confirmed','processing','shipped','delivered','cancelled'].map(s=>`<option ${s===o.order_status?'selected':''}>${s}</option>`).join('')}</select></td>`:''}</tr>`).join('')+'</tbody></table></div>';
 if(full)loadOrderItems(rows);
}
async function loadOrderItems(rows){const ids=rows.map(x=>x.id),{data}=await client.from('order_items').select('order_id,product_name,size,quantity').in('order_id',ids);(data||[]).forEach(i=>{const el=document.querySelector(`[data-items="${i.order_id}"]`);if(el)el.textContent+=(el.textContent?', ':'')+`${i.product_name}${i.size?' ('+i.size+')':''} × ${i.quantity}`})}
async function loadOrders(){const search=$('#orderSearch').value.trim(),status=$('#orderStatusFilter').value;let q=client.from('orders').select('*').order('created_at',{ascending:false}).limit(100);if(status)q=q.eq('order_status',status);if(search)q=q.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);const{data,error}=await q;if(error){$('#ordersTable').innerHTML=`<p class="message error">${esc(error.message)}</p>`;return}renderOrderTable($('#ordersTable'),data||[],true)}
$('#orderSearch').addEventListener('input',loadOrders);$('#orderStatusFilter').addEventListener('change',loadOrders);
document.addEventListener('change',async e=>{if(!e.target.matches('.status-select'))return;const{error}=await client.from('orders').update({order_status:e.target.value}).eq('id',e.target.dataset.id);if(error)alert(error.message)});

function productForm(){
 return `<h2>Add New Product</h2><form id="productCreateForm">
 <div class="form-grid">
 <label>Product Code*<input name="product_code" required placeholder="SC004"></label>
 <label>Product Name*<input name="name" required></label>
 <label>Category*<input name="category" required placeholder="Sarees / Kurtis / Gowns"></label>
 <label>Price (NPR)*<input name="price" type="number" min="0" step="0.01" required></label>
 <label>Compare-at Price<input name="compare_at_price" type="number" min="0" step="0.01"></label>
 <label>MOQ*<input name="moq" type="number" min="0" value="1" required></label>
 <label>Fabric<input name="fabric"></label><label>Color<input name="color"></label><label>Pattern<input name="pattern"></label>
 <label>Dispatch / notes<input name="dispatch"></label>
 <label class="full">Description<textarea name="description"></textarea></label>
 <label><input name="is_featured" type="checkbox"> Featured product</label>
 <label><input name="is_active" type="checkbox" checked> Active / visible</label>
 <label class="full">Product Images* <input id="productImages" type="file" accept="image/*" multiple required><small>Select multiple images. First image becomes main image.</small><div id="imagePreview" class="preview-list"></div></label>
 <div class="full"><b>Sizes & Stock</b><div id="sizeRows"></div><button type="button" id="addSize" class="secondary">＋ Add Size</button></div>
 </div><div class="form-actions"><button class="primary">Create Product</button><button type="button" id="cancelProduct" class="secondary">Cancel</button></div><div id="createMessage" class="message"></div></form>`;
}
$('#newProductBtn').onclick=()=>{$('#productFormWrap').innerHTML=productForm();$('#productFormWrap').classList.remove('hidden');bindProductForm()};
function bindProductForm(){
 let sizes=[];
 const renderSizes=()=>$('#sizeRows').innerHTML=sizes.map((s,i)=>`<div class="size-box"><b>${esc(s.size)}</b><div class="size-grid">
 <input placeholder="Bust" data-k="bust" data-i="${i}" value="${s.bust??''}"><input placeholder="Waist" data-k="waist" data-i="${i}" value="${s.waist??''}">
 <input placeholder="Hip" data-k="hip" data-i="${i}" value="${s.hip??''}"><input placeholder="Shoulder" data-k="shoulder" data-i="${i}" value="${s.shoulder??''}">
 <input placeholder="Top length" data-k="top_length" data-i="${i}" value="${s.top_length??''}"><input placeholder="Bottom length" data-k="bottom_length" data-i="${i}" value="${s.bottom_length??''}">
 <input placeholder="Dupatta length" data-k="dupatta_length" data-i="${i}" value="${s.dupatta_length??''}"><input placeholder="Stock" type="number" min="0" data-k="stock" data-i="${i}" value="${s.stock??0}">
 </div><button type="button" class="danger remove-size" data-i="${i}" style="margin-top:7px">Remove</button></div>`).join('');
 $('#addSize').onclick=()=>{const size=prompt('Size name (e.g. S, M, L, XL, XXL):');if(size){sizes.push({size:size.trim(),stock:0});renderSizes()}};
 document.addEventListener('input',e=>{if(!e.target.dataset.i)return;const i=Number(e.target.dataset.i),k=e.target.dataset.k;if(sizes[i])sizes[i][k]=e.target.value});
 document.addEventListener('click',e=>{if(e.target.matches('.remove-size')){sizes.splice(Number(e.target.dataset.i),1);renderSizes()}});
 $('#productImages').onchange=()=>{$('#imagePreview').innerHTML=[...$('#productImages').files].map(f=>`<img src="${URL.createObjectURL(f)}" alt="">`).join('')};
 $('#cancelProduct').onclick=()=>{$('#productFormWrap').classList.add('hidden')};
 $('#productCreateForm').onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.target);msg($('#createMessage'),'Creating product…');
  try{
   const code=f.get('product_code').trim().toUpperCase(), slug=code.toLowerCase()+'-'+f.get('name').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
   const payload={product_code:code,name:f.get('name').trim(),slug,category:f.get('category').trim(),description:f.get('description')||null,price:Number(f.get('price')),compare_at_price:f.get('compare_at_price')?Number(f.get('compare_at_price')):null,moq:Number(f.get('moq')),fabric:f.get('fabric')||null,color:f.get('color')||null,pattern:f.get('pattern')||null,is_active:f.has('is_active'),is_featured:f.has('is_featured')};
   const {data:p,error}=await client.from('products').insert(payload).select('id,product_code,name').single();if(error)throw error;
   const files=[...$('#productImages').files];if(!files.length)throw new Error('Select at least one image.');
   for(let i=0;i<files.length;i++){const file=files[i],ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${code}/${crypto.randomUUID()}.${ext}`;
    const up=await client.storage.from('product-images').upload(path,file,{upsert:false});if(up.error)throw up.error;
    const url=client.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    const ins=await client.from('product_images').insert({product_id:p.id,image_url:url,alt_text:p.name,sort_order:i,is_main:i===0});if(ins.error)throw ins.error;
   }
   if(sizes.length){const rows=sizes.map(s=>({product_id:p.id,size:String(s.size).trim(),bust:s.bust?Number(s.bust):null,waist:s.waist?Number(s.waist):null,hip:s.hip?Number(s.hip):null,shoulder:s.shoulder?Number(s.shoulder):null,top_length:s.top_length?Number(s.top_length):null,bottom_length:s.bottom_length?Number(s.bottom_length):null,dupatta_length:s.dupatta_length?Number(s.dupatta_length):null,unit:'inch',stock:Math.max(0,Number(s.stock||0)),is_active:true}));const ins=await client.from('product_sizes').insert(rows);if(ins.error)throw ins.error;}
   msg($('#createMessage'),'Product created successfully.','success');e.target.reset();sizes=[];renderSizes();loadProducts();
  }catch(err){msg($('#createMessage'),'Create failed: '+(err?.message||err),'error')}
 };
 renderSizes();
}
async function loadProducts(){
 const{data,error}=await client.from('products').select('*,product_images(image_url,is_main,sort_order)').order('created_at',{ascending:false});
 if(error){$('#productsGrid').innerHTML=`<p class="message error">${esc(error.message)}</p>`;return}
 $('#productsGrid').innerHTML='<div class="product-grid-admin">'+(data||[]).map(p=>{
  const im=(p.product_images||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0];
  return `<div class="product-card-admin">${im?`<img src="${esc(im.image_url)}" style="width:100%;height:180px;object-fit:cover;border-radius:7px">`:''}<small>${esc(p.product_code)} · ${esc(p.category)}</small><h3>${esc(p.name)}</h3>
  <label>Price<input type="number" step="0.01" value="${p.price}" data-price="${p.id}"></label>
  <label>MOQ<input type="number" value="${p.moq}" data-moq="${p.id}"></label>
  <label><input type="checkbox" ${p.is_active?'checked':''} data-active="${p.id}"> Active</label>
  <label><input type="checkbox" ${p.is_featured?'checked':''} data-featured="${p.id}"> Featured</label>
  <button class="primary save-product" data-id="${p.id}">Save Changes</button><span class="message" id="pm-${p.id}"></span></div>`;
 }).join('')+'</div>';
}
document.addEventListener('click',async e=>{const b=e.target.closest('.save-product');if(!b)return;const id=b.dataset.id,get=a=>document.querySelector(`[data-${a}="${id}"]`),payload={price:Number(get('price').value),moq:Math.max(0,Number(get('moq').value)),is_active:get('active').checked,is_featured:get('featured').checked)},r=await client.from('products').update(payload).eq('id',id);msg($('#pm-'+id),r.error?'Save failed: '+r.error.message:'Saved',r.error?'error':'success')});
async function loadInventory(){const{data,error}=await client.from('products').select('id,product_code,name,product_sizes(id,size,stock,is_active)').order('product_code');if(error){$('#inventoryGrid').innerHTML=`<div class="card"><p class="message error">${esc(error.message)}</p></div>`;return}$('#inventoryGrid').innerHTML=(data||[]).map(p=>`<div class="card"><h3>${esc(p.product_code)} — ${esc(p.name)}</h3><div class="stock-list">${(p.product_sizes||[]).map(s=>`<div class="stock-row"><span><b>${esc(s.size)}</b></span><input type="number" min="0" value="${s.stock}" data-stock="${s.id}" data-old="${s.stock}"><button class="primary save-stock" data-id="${s.id}" data-product="${p.id}">Save</button></div>`).join('')||'<p>No sizes configured.</p>'}</div></div>`).join('')}
document.addEventListener('click',async e=>{const b=e.target.closest('.save-stock');if(!b)return;const input=document.querySelector(`[data-stock="${b.dataset.id}"]`),old=Number(input.dataset.old),stock=Math.max(0,parseInt(input.value||0,10)),r=await client.from('product_sizes').update({stock}).eq('id',b.dataset.id);if(r.error){alert(r.error.message);return}const diff=stock-old;if(diff)await client.from('inventory_movements').insert({product_id:b.dataset.product,size_id:b.dataset.id,quantity_change:diff,reason:'admin_stock_adjustment'});input.dataset.old=stock;b.textContent='Saved';setTimeout(()=>b.textContent='Save',1000)});
async function loadSubscribers(){const{data,error}=await client.from('newsletter_subscribers').select('*').order('subscribed_at',{ascending:false});if(error){$('#subscribersTable').innerHTML=`<p class="message error">${esc(error.message)}</p>`;return}$('#subscriberCount').textContent=`${data?.length||0} subscriber${(data?.length||0)===1?'':'s'}`;$('#subscribersTable').innerHTML='<div style="overflow:auto"><table class="table"><thead><tr><th>Email</th><th>Subscribed</th><th>Status</th><th>Action</th></tr></thead><tbody>'+((data||[]).map(s=>`<tr><td>${esc(s.email)}</td><td>${new Date(s.subscribed_at).toLocaleString()}</td><td>${s.is_active?'Active':'Inactive'}</td><td><button class="${s.is_active?'danger':'secondary'} toggle-sub" data-id="${s.id}" data-active="${s.is_active}">${s.is_active?'Deactivate':'Activate'}</button></td></tr>`).join(''))+'</tbody></table></div>'}
document.addEventListener('click',async e=>{const b=e.target.closest('.toggle-sub');if(!b)return;const active=b.dataset.active!=='true',r=await client.from('newsletter_subscribers').update({is_active:active}).eq('id',b.dataset.id);if(r.error)alert(r.error.message);else loadSubscribers()});
start();
