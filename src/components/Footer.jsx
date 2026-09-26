import React from "react";

const socialLinks = [
  ["https://www.instagram.com/surucollectionnepal/", "Instagram", "fab fa-instagram"],
  ["https://www.facebook.com/surucollectionnepal", "Facebook", "fab fa-facebook-f"],
  ["https://www.tiktok.com/@surucollectionnepal", "TikTok", "fab fa-tiktok"],
  ["https://wa.me/9779740381427", "WhatsApp", "fab fa-whatsapp"]
];

const quickLinks = [
  ["/", "Home"],
  ["/products.html", "Products"],
  ["/about.html", "About Us"],
  ["/contact.html", "Contact"]
];

const supportLinks = [
  ["/account.html", "My Account"],
  ["/order.html", "Track Order"],
  ["/contact.html", "Contact Support"]
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-grid">
          <div className="footer-brand">
            <img
              src="/assets/suru-logo-official.png"
              className="footer-logo"
              alt="Suru Collection"
            />
            <p className="footer-tagline">Traditional elegance for every occasion.</p>
            <p className="footer-description">
              Discover thoughtfully selected traditional and ethnic wear,
              made to bring timeless style to every occasion.
            </p>

            <div className="social-links" aria-label="Social media">
              {socialLinks.map(([href, label, icon]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                >
                  <i className={icon} />
                </a>
              ))}
            </div>
          </div>

          <div className="footer-column">
            <h3>Explore</h3>
            {quickLinks.map(([href, label]) => (
              <a key={label} href={href}>{label}</a>
            ))}
          </div>

          <div className="footer-column">
            <h3>Customer Care</h3>
            {supportLinks.map(([href, label]) => (
              <a key={label} href={href}>{label}</a>
            ))}
            <a href="/contact.html">Shipping Information</a>
          </div>

          <div className="footer-column footer-contact">
            <h3>Get In Touch</h3>
            <a href="https://wa.me/9779740381427" target="_blank" rel="noreferrer">
              <i className="fab fa-whatsapp" />
              <span>+977 9740381427</span>
            </a>
            <p>
              <i className="fas fa-location-dot" />
              <span>Gaur, Rautahat, Nepal</span>
            </p>
            <p>
              <i className="fas fa-clock" />
              <span>We're here to help</span>
            </p>
          </div>
        </div>

        <div className="footer-services" aria-label="Shopping benefits">
          <div className="footer-service">
            <span className="footer-service-icon"><i className="fas fa-truck-fast" /></span>
            <div>
              <strong>Nepal-wide Delivery</strong>
              <span>Reliable doorstep delivery</span>
            </div>
          </div>

          <div className="footer-service">
            <span className="footer-service-icon"><i className="fas fa-money-bill-wave" /></span>
            <div>
              <strong>Cash on Delivery</strong>
              <span>Pay when your order arrives</span>
            </div>
          </div>

          <div className="footer-service">
            <span className="footer-service-icon"><i className="fas fa-credit-card" /></span>
            <div>
              <strong>Online Payment</strong>
              <span>Convenient & secure checkout</span>
            </div>
          </div>

          <div className="footer-service">
            <span className="footer-service-icon"><i className="fas fa-headset" /></span>
            <div>
              <strong>Personal Support</strong>
              <span>We're happy to help</span>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Suru Collection. All rights reserved.</span>
        <span>Made with <i className="fas fa-heart" /> in Nepal</span>
      </div>
    </footer>
  );
}
