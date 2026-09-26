import "../styles.css";
import React, { useState } from "react";

const socialLinks = [
  ["https://www.instagram.com/surucollectionnepal/", "Instagram", "fab fa-instagram"],
  ["https://www.facebook.com/surucollectionnepal", "Facebook", "fab fa-facebook-f"],
  ["https://www.tiktok.com/@surucollectionnepal", "TikTok", "fab fa-tiktok"],
  ["https://wa.me/9779740381427", "WhatsApp", "fab fa-whatsapp"]
];

const quickLinks = [
  ["/", "Home"],
  ["/products.html", "All Products"],
  ["/products.html", "New Arrivals"],
  ["/products.html", "Best Sellers"],
  ["/about.html", "About Us"],
  ["/contact.html", "Contact Us"]
];

const supportLinks = [
  ["/order.html", "Track Order"],
  ["/contact.html", "Shipping Policy"],
  ["/contact.html", "Return & Exchange"],
  ["/contact.html", "Size Guide"],
  ["/contact.html", "FAQs"],
  ["/contact.html", "Terms & Conditions"],
  ["/contact.html", "Privacy Policy"]
];

const services = [
  ["fas fa-truck-fast", "Fast & Reliable Delivery", "Across Nepal"],
  ["fas fa-shield-halved", "Secure Payments", "100% Safe & Secure"],
  ["fas fa-gift", "Premium Quality", "Handpicked Collections"],
  ["fas fa-headset", "Customer Support", "Always Here to Help"]
];

function FooterSection({ title, open, onToggle, children }) {
  return (
    <section className={`sc-footer-section ${open ? "is-open" : ""}`}>
      <button
        className="sc-footer-section-title"
        type="button"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{title}</span>
        <span className="sc-footer-plus" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      <div className="sc-footer-section-rule" />

      {children}
    </section>
  );
}

export default function Footer() {
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (section) => {
    setOpenSection((current) => current === section ? null : section);
  };

  return (
    <footer className="sc-footer">
      <div className="sc-footer-main">
        <div className="sc-footer-content">
          <section className="sc-footer-brand">
            <img
              src="/assets/suru-logo-official.png"
              className="sc-footer-logo"
              alt="Suru Collection"
            />

            <p className="sc-footer-tagline">Traditional &amp; Ethnic Wear</p>

            <p className="sc-footer-description">
              Bringing you beautiful traditional and ethnic wear with quality,
              comfort and timeless style.
            </p>

            <div className="sc-footer-socials" aria-label="Social media">
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
          </section>

          <div className="sc-footer-nav">
            <FooterSection
              title="Quick Links"
              open={openSection === "quick"}
              onToggle={() => toggleSection("quick")}
            >
              <div className="sc-footer-links">
                {quickLinks.map(([href, label]) => (
                  <a key={label} href={href}>{label}</a>
                ))}
              </div>
            </FooterSection>

            <FooterSection
              title="Customer Support"
              open={openSection === "support"}
              onToggle={() => toggleSection("support")}
            >
              <div className="sc-footer-links">
                {supportLinks.map(([href, label]) => (
                  <a key={label} href={href}>{label}</a>
                ))}
              </div>
            </FooterSection>
          </div>

          <FooterSection
            title="Contact Us"
            open={openSection === "contact"}
            onToggle={() => toggleSection("contact")}
          >
            <div className="sc-footer-contact-details">
              <a href="https://wa.me/9779740381427" target="_blank" rel="noreferrer">
                <i className="fas fa-location-dot" />
                <span>Gaur, Rautahat, Nepal</span>
              </a>
              <a href="https://wa.me/9779740381427" target="_blank" rel="noreferrer">
                <i className="fab fa-whatsapp" />
                <span>+977 9740381427</span>
              </a>
              <a href="mailto:surucollectionnepal@gmail.com">
                <i className="fas fa-envelope" />
                <span>surucollectionnepal@gmail.com</span>
              </a>
              <p>
                <i className="fas fa-clock" />
                <span>Sun - Fri: 9:00 AM - 7:00 PM</span>
              </p>
            </div>
          </FooterSection>
        </div>

        <div className="sc-footer-services">
          {services.map(([icon, title, subtitle]) => (
            <div className="sc-footer-service" key={title}>
              <span className="sc-footer-service-icon">
                <i className={icon} />
              </span>
              <div>
                <strong>{title}</strong>
                <span>{subtitle}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sc-footer-bottom">
        <span>© {new Date().getFullYear()} Suru Collection. All Rights Reserved.</span>
        <span>Made with <i className="fas fa-heart" /> in Nepal</span>
      </div>
    </footer>
  );
}
