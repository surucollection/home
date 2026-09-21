/* Suru Collection — dynamic product page */
(function () {
  'use strict';

  const root = document.getElementById('productRoot');
  if (!root) return;

  const esc = (value) => String(value ?? '').replace(/[&<>\'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char] || char));

  const money = (value) => `NPR ${Number(value || 0).toLocaleString('en-IN')}`;

  function showError(title, message) {
    root.innerHTML = `<div class="product-not-found"><h1>${esc(title)}</h1><p>${esc(message)}</p><a class="hero-btn" href="/index.html#products">Back to Products →</a></div>`;
  }

  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || '').trim();

  if (!code) {
    showError('Product not found', 'Please return to the collection and choose a product.');
    return;
  }

  if (!window.supabase || !window.SURU_SUPABASE_URL || !window.SURU_SUPABASE_KEY) {
    showError('Product unavailable', 'The product service could not be loaded. Please refresh the page and try again.');
    return;
  }

  const client = window.supabase.createClient(window.SURU_SUPABASE_URL, window.SURU_SUPABASE_KEY);

  async function loadProduct() {
    try {
      const { data: product, error } = await client
        .from('products')
        .select('id,product_code,name,slug,category,description,price,moq,fabric,color,pattern,is_active,product_images(image_url,alt_text,sort_order,is_main)')
        .eq('product_code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (!product) {
        showError('Product not found', 'This product is no longer available.');
        return;
      }

      const { data: sizeRows, error: sizeError } = await client
        .from('product_sizes')
        .select('size,bust,waist,hip,shoulder,top_length,bottom_length,dupatta_length,unit,stock,is_active')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('created_at');

      if (sizeError) throw sizeError;

      const imgs = (product.product_images || [])
        .filter((image) => image && image.image_url)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const mainImage = imgs.find((image) => image.is_main)?.image_url || imgs[0]?.image_url || '';
      const mainAlt = imgs.find((image) => image.is_main)?.alt_text || product.name;
      const sizes = sizeRows || [];

      document.title = `${product.name} | Suru Collection`;
      const meta = document.getElementById('metaDescription');
      if (meta) meta.content = product.description || `${product.name} from Suru Collection.`;

      const sizeOptions = sizes.length
        ? `<option value="">Choose size</option>${sizes.map((size) => `<option value="${esc(size.size)}" ${Number(size.stock) <= 0 ? 'disabled' : ''}>${esc(size.size)}${Number(size.stock) <= 0 ? ' — Out of stock' : ''}</option>`).join('')}`
        : '';

      const details = [
        ['Fabric', product.fabric],
        ['Color', product.color],
        ['Pattern', product.pattern],
        ['MOQ', product.moq]
      ].filter((item) => item[1] !== null && item[1] !== undefined && item[1] !== '');

      const imageHtml = mainImage
        ? `<img id="mainProductImage" src="${esc(mainImage)}" alt="${esc(mainAlt)}" onerror="this.style.display='none';this.parentElement.classList.add('image-error')">`
        : '<div class="image-unavailable">Product image unavailable</div>';

      const thumbs = imgs.map((image, index) => `<button type="button" class="thumb ${index === 0 ? 'selected' : ''}" data-src="${esc(image.image_url)}" aria-label="View image ${index + 1}"><img src="${esc(image.image_url)}" alt="${esc(image.alt_text || `${product.name} image ${index + 1}`)}" loading="lazy" onerror="this.style.visibility='hidden'"></button>`).join('');

      const waText = encodeURIComponent(`Hello Suru Collection, I am interested in ${product.product_code} - ${product.name}. Please share availability and ordering details.`);

      root.innerHTML = `
        <div class="breadcrumbs">
          <a href="/index.html">Home</a><span>›</span>
          <a href="/index.html#products">${esc(product.category || 'Products')}</a><span>›</span>
          <b>${esc(product.product_code)}</b>
        </div>
        <section class="product-layout">
          <div class="gallery">
            <div class="main-photo">${imageHtml}</div>
            ${imgs.length ? `<div class="thumbs">${thumbs}</div>` : ''}
          </div>
          <div class="product-info">
            <p class="eyebrow">${esc(product.category || 'SURU COLLECTION')}</p>
            <h1>${esc(product.name)}</h1>
            <div class="price">${money(product.price)}</div>
            <p class="intro">${esc(product.description || 'A thoughtfully selected piece from Suru Collection, designed for elegant occasions and effortless traditional style.')}</p>
            ${details.length ? `<ul class="detail-list">${details.map((item) => `<li><span>${esc(item[0])}</span><strong>${esc(item[1])}</strong></li>`).join('')}</ul>` : ''}
            <div class="buy-box">
              ${sizes.length ? `<label for="size">Select Size</label><select id="size" class="size-select">${sizeOptions}</select>` : ''}
              <div class="qty-row"><label for="qty">Quantity</label><input id="qty" class="qty-input" type="number" min="1" value="1"></div>
              <button type="button" class="buy-button" data-code="${esc(product.product_code)}" data-name="${esc(product.name)}" data-price="${Number(product.price || 0)}" data-image="${esc(mainImage)}">Add to Cart</button>
            </div>
            <a class="wa-button" href="https://wa.me/9779740381427?text=${waText}" target="_blank" rel="noopener">Enquire on WhatsApp <span>→</span></a>
            <p class="small-note">Prices are in Nepalese Rupees. Availability is subject to stock.</p>
          </div>
        </section>
        ${sizes.length ? `
          <section class="size-section">
            <p class="eyebrow">SIZE GUIDE</p><h2>Measurements</h2>
            <div class="table-wrap"><table><thead><tr><th>Size</th><th>Bust</th><th>Waist</th><th>Hip</th><th>Shoulder</th><th>Top Length</th><th>Bottom Length</th><th>Dupatta</th><th>Stock</th></tr></thead>
            <tbody>${sizes.map((size) => `<tr><th>${esc(size.size)}</th><td>${size.bust ?? '—'} ${esc(size.unit || '')}</td><td>${size.waist ?? '—'} ${esc(size.unit || '')}</td><td>${size.hip ?? '—'} ${esc(size.unit || '')}</td><td>${size.shoulder ?? '—'} ${esc(size.unit || '')}</td><td>${size.top_length ?? '—'} ${esc(size.unit || '')}</td><td>${size.bottom_length ?? '—'} ${esc(size.unit || '')}</td><td>${size.dupatta_length ?? '—'} ${esc(size.unit || '')}</td><td>${Number(size.stock) > 0 ? 'Available' : 'Out of stock'}</td></tr>`).join('')}</tbody></table></div>
          </section>` : ''}
      `;

      root.querySelectorAll('.thumb').forEach((button) => {
        button.addEventListener('click', () => {
          const image = root.querySelector('#mainProductImage');
          if (image) {
            image.src = button.dataset.src;
            image.style.display = 'block';
            image.parentElement.classList.remove('image-error');
          }
          root.querySelectorAll('.thumb').forEach((item) => item.classList.remove('selected'));
          button.classList.add('selected');
        });
      });
    } catch (error) {
      console.error('Product load failed:', error);
      showError('Product unavailable', 'We could not load this product right now. Please refresh the page and try again.');
    }
  }

  loadProduct();
})();
