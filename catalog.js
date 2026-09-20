
const scClient = window.supabase.createClient(window.SURU_SUPABASE_URL, window.SURU_SUPABASE_KEY);
const escSC = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const moneySC = n => 'NPR ' + Number(n || 0).toLocaleString('en-IN');

async function loadPublicProducts(){
  const grid = document.querySelector('#products .product-grid');
  if (!grid) return;
  const {data, error} = await scClient.from('products')
    .select('id,product_code,name,slug,category,price,compare_at_price,is_featured,product_images(image_url,alt_text,sort_order,is_main)')
    .eq('is_active', true)
    .order('is_featured', {ascending:false})
    .order('created_at', {ascending:false});

  if(error) {
    console.warn('Could not load products from Supabase:', error.message);
    return;
  }

  grid.innerHTML = (data || []).map(p => {
    const imgs = (p.product_images || []).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    const main = imgs.find(x => x.is_main) || imgs[0];
    const image = main?.image_url || 'assets/hero.jpg';
    const href = 'product.html?code=' + encodeURIComponent(p.product_code);
    return `<a class="product-card" href="${href}">
      <div class="product-img"><img src="${escSC(image)}" alt="${escSC(p.product_code+' '+p.name)}"><span>${escSC(p.product_code)}</span></div>
      <div><small>${escSC(p.category || '')}</small><h3>${escSC(p.name)}</h3>
      <strong>${moneySC(p.price)}</strong><em>View Product →</em></div>
    </a>`;
  }).join('') || '<p>No products available yet.</p>';
}
document.addEventListener('DOMContentLoaded', loadPublicProducts);
