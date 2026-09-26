import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const supabaseUrl = "https://vkycraymxhkqxgpcpdzw.supabase.co";
const supabaseKey = "sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC";

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Unable to load " + src));
    document.head.appendChild(script);
  });
}

function Home() {
  useEffect(() => {
    window.SURU_SUPABASE_URL = supabaseUrl;
    window.SURU_SUPABASE_KEY = supabaseKey;

    loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", "suru-supabase")
      .then(() => loadScript("./app.js", "suru-app"))
      .catch(error => console.error("Suru Collection startup error:", error));
  }, []);

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" href="index.html" aria-label="Suru Collection home">
            <img src="assets/suru-logo-official.png" alt="Suru Collection" />
          </a>
          <button id="menuToggle" className="menu-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false">☰</button>
          <nav id="mainNav" aria-label="Main navigation">
            <a href="index.html">Home</a>
            <a href="about.html">About Us</a>
            <a href="#collection">Our Collection</a>
            <a href="products.html">Products</a>
            <a href="contact.html">Contact</a>
            <a href="login.html" className="account-link">My Account</a>
          </nav>
          <a href="order.html" className="cart-link" aria-label="Shopping cart">🛍️<span id="cartCount">0</span></a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">SURU COLLECTION</p>
            <h1>More Than Fashion.<br /><em>It's a Feeling.</em></h1>
            <p>Discover thoughtfully selected traditional and ethnic wear designed to make every occasion feel special.</p>
            <a className="hero-button" href="products.html">Explore Collection</a>
          </div>
        </section>

        <section id="collection" className="section">
          <div className="section-heading">
            <p className="eyebrow">OUR COLLECTION</p>
            <h2>Made for Every Celebration</h2>
            <p>Explore timeless silhouettes, festive favourites and elegant everyday styles.</p>
          </div>
          <div className="collection-grid">
            {[
              ["cat-sarees.jpg", "Sarees", "Elegant drapes for every occasion."],
              ["cat-lehengas.jpg", "Lehengas", "Festive looks with timeless charm."],
              ["cat-suits.jpg", "Suits", "Classic ethnic styles for every day."],
              ["cat-gowns.jpg", "Gowns", "Graceful styles for special moments."],
              ["cat-kurtis.jpg", "Kurtis", "Beautiful comfort for everyday elegance."],
              ["cat-dupatta.jpg", "Dupattas", "Finishing touches that complete the look."],
              ["cat-accessories.jpg", "Accessories", "Details that add a little more sparkle."]
            ].map(([image, name, description]) => (
              <a className="collection-card" href="products.html" key={name}>
                <div className="collection-image">
                  <img src={"assets/" + image} alt={name} loading="lazy" />
                </div>
                <div className="collection-content">
                  <h3>{name}</h3>
                  <p>{description}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="products" className="section shop-section">
          <div className="section-heading">
            <p className="eyebrow">SHOP SURU</p>
            <h2>Our Products</h2>
            <p>Choose a product to view its details, available options and stock.</p>
          </div>
          <div id="productGrid" className="product-grid">
            <div className="product-loading">Loading products…</div>
          </div>
        </section>
      </main>

      <dialog id="variantModal" className="variant-modal">
        <div className="variant-modal-inner">
          <div className="variant-modal-header">
            <div>
              <h2 id="variantProductName"></h2>
              <div id="variantProductCode" className="variant-modal-code"></div>
            </div>
            <button id="variantClose" className="variant-close" type="button" aria-label="Close">×</button>
          </div>
          <div className="variant-modal-product">
            <img id="variantProductImage" src="" alt="" />
            <div className="variant-modal-product-info">
              <div id="variantProductCategory" className="variant-modal-category"></div>
              <div id="variantProductPrice" className="variant-modal-price"></div>
            </div>
          </div>
          <div id="variantColourField" className="variant-field">
            <label htmlFor="variantColour">Colour</label>
            <select id="variantColour"><option value="">Select Colour</option></select>
          </div>
          <div id="variantFixedColourField" className="variant-field">
            <label>Colour</label>
            <div id="variantFixedColour" className="variant-fixed-value"></div>
          </div>
          <div id="variantSizeField" className="variant-field">
            <label htmlFor="variantSize">Size</label>
            <select id="variantSize"><option value="">Select Size</option></select>
          </div>
          <div id="variantFixedOptionField" className="variant-field">
            <label>Option</label>
            <div id="variantFixedOption" className="variant-fixed-value"></div>
          </div>
          <div className="variant-field">
            <label htmlFor="variantQuantity">Quantity</label>
            <input id="variantQuantity" type="number" min="1" defaultValue="1" inputMode="numeric" />
          </div>
          <div id="variantStock" className="variant-stock" aria-live="polite"></div>
          <div id="variantModalMessage" className="variant-modal-message" aria-live="polite"></div>
          <div className="variant-modal-actions">
            <button id="variantCancelButton" className="secondary-button" type="button">Cancel</button>
            <button id="variantAddButton" className="buy-button" type="button">Add to Cart</button>
          </div>
        </div>
      </dialog>

      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brand-social">
            <img src="assets/suru-logo-official.png" className="footer-logo" alt="Suru Collection" />
            <div className="social-links">
              <a href="https://www.instagram.com/surucollectionnepal/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i className="fab fa-instagram"></i></a>
              <a href="https://www.facebook.com/surucollectionnepal" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i className="fab fa-facebook-f"></i></a>
              <a href="https://www.tiktok.com/@surucollectionnepal" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><i className="fab fa-tiktok"></i></a>
              <a href="https://wa.me/9779740381427" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><i className="fab fa-whatsapp"></i></a>
            </div>
          </div>
          <div><h3>Quick Links</h3><a href="index.html">Home</a><a href="about.html">About Us</a><a href="products.html">Products</a><a href="contact.html">Contact</a></div>
          <div><h3>Our Location</h3><p>Gaur, Rautahat<br />Nepal</p></div>
          <div><h3>Suru Collection</h3><p>Traditional elegance for every occasion.</p><p>Inspired by Suruchi Sahani</p></div>
        </div>
        <div className="footer-bottom">© <span id="year"></span> Suru Collection. All rights reserved.</div>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")).render(<Home />);
