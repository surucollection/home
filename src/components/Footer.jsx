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
  ["/contact.html", "Contact Support"],
  ["/contact.html", "Shipping Information"]
];

const services = [
  ["fas fa-truck-fast", "Nepal-wide Delivery"],
  ["fas fa-money-bill-wave", "Cash on Delivery"],
  ["fas fa-credit-card", "Online Payment"],
  ["fas fa-headset", "Personal Support"]
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-grid">
          <section className="footer-brand">
            <div className="footer-brand-content">
              <img
                src="/assets/suru-logo-official.png"
                className="footer-logo"
                alt="Suru Collection"
              />
              <p className="footer-tagline">Traditional elegance for every occasion.</p>
              <p className="footer-description">
                Discover thoughtfully selected traditional and ethnic wear for
                every special occasion.
              </p>

              <div className="social-links" aria-label="Social media">
                {socialLinks.map(([href, label, icon]) => (
                  <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}>
                    <i className={icon} />
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="footer-column">
            <h3>Explore</h3>
            <div className="footer-link-list">
              {quickLinks.map(([href, label]) => (
                <a key={label} href={href}>{label}</a>
              ))}
            </div>
          </section>

          <section className="footer-column">
            <h3>Customer Care</h3>
            <div className="footer-link-list">
              {supportLinks.map(([href, label]) => (
                <a key={label} href={href}>{label}</a>
              ))}
            </div>
          </section>

          <section className="footer-column footer-contact">
            <h3>Get In Touch</h3>
            <a href="https://wa.me/9779740381427" target="_blank" rel="noreferrer">
              <i className="fab fa-whatsapp" />
              <span>+977 9740381427</span>
            </a>
            <p>
              <i className="fas fa-location-dot" />
              <span>Gaur, Rautahat, Nepal</span>
            </p>
          </section>
        </div>

        <div className="footer-services" aria-label="Shopping benefits">
          {services.map(([icon, title]) => (
            <div className="footer-service" key={title}>
              <span className="footer-service-icon">
                <i className={icon} />
              </span>
              <strong>{title}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Suru Collection. All rights reserved.</span>
        <span>Made with <i className="fas fa-heart" /> in Nepal</span>
      </div>
    </footer>
  );
}
