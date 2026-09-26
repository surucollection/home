import React from "react";

const socialLinks=[
  ["https://www.instagram.com/surucollectionnepal/","Instagram","fab fa-instagram"],
  ["https://www.facebook.com/surucollectionnepal","Facebook","fab fa-facebook-f"],
  ["https://www.tiktok.com/@surucollectionnepal","TikTok","fab fa-tiktok"],
  ["https://wa.me/9779740381427","WhatsApp","fab fa-whatsapp"]
];

export default function Footer(){
  return <footer className="footer"><div className="footer-grid"><div className="footer-brand-social"><img src="assets/suru-logo-official.png" className="footer-logo" alt="Suru Collection"/><div className="social-links">{socialLinks.map(([href,label,icon])=><a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}><i className={icon}/></a>)}</div></div><div><h3>Quick Links</h3><a href="?page=home">Home</a><a href="?page=about">About Us</a><a href="?page=products">Products</a><a href="?page=contact">Contact</a></div><div><h3>Our Location</h3><p>Gaur, Rautahat<br/>Nepal</p></div><div><h3>Suru Collection</h3><p>Traditional elegance for every occasion.</p><p>Inspired by Suruchi Sahani</p></div></div><div className="footer-bottom">© {new Date().getFullYear()} Suru Collection. All rights reserved.</div></footer>
}
