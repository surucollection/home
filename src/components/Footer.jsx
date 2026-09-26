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

function FooterSection({ title, sectionKey, open, onToggle, links = [], contactDetails = null }) {
  return (
    <section className={`sc-footer-section ${contactDetails ? "sc-footer-contact" : ""} ${open ? "is-open" : ""}`}>
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

      {contactDetails ? (
        <div className="sc-footer-contact-details">
          {contactDetails.map(({ type = "link", href, icon, text }) =>
            type === "text" ? (
              <p key={text}>
                <i className={icon} />
                <span>{text}</span>
              </p>
            ) : (
              <a
                key={text}
                href={href}
                target={href?.startsWith("http") ? "_blank" : undefined}
                rel={href?.startsWith("http") ? "noreferrer" : undefined}
              >
                <i className={icon} />
                <span>{text}</span>
              </a>
            )
          )}
        </div>
      ) : (
        <div className="sc-footer-links">
          {links.map(([href, label]) => (
            <a key={label} href={href}>{label}</a>
          ))}
        </div>
      )}
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
              sectionKey="quick"
              links={quickLinks}
              open={openSection === "quick"}
              onToggle={() => toggleSection("quick")}
            />
            <FooterSection
              title="Customer Support"
              sectionKey="support"
              links={supportLinks}
              open={openSection === "support"}
              onToggle={() => toggleSection("support")}
            />
          </div>

          <FooterSection
            title="Contact Us"
            sectionKey="contact"
            open={openSection === "contact"}
            onToggle={() => toggleSection("contact")}
            contactDetails={[
              { href: "https://wa.me/9779740381427", icon: "fas fa-location-dot", text: "Gaur, Rautahat, Nepal" },
              { href: "https://wa.me/9779740381427", icon: "fab fa-whatsapp", text: "+977 9740381427" },
              { href: "mailto:surucollectionnepal@gmail.com", icon: "fas fa-envelope", text: "surucollectionnepal@gmail.com" },
              { type: "text", icon: "fas fa-clock", text: "Sun - Fri: 9:00 AM - 7:00 PM" }
            ]}
          />
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
