import React from "react";

export default function Hero({eyebrow,title,text}){
  return <section className="page-hero"><div className="section-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div></section>
}
