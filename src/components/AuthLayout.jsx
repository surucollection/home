import React from "react";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";

export default function AuthLayout({children,title}){
  return <><Header/><main className="page"><section className="auth-card"><img src="/assets/suru-logo-official.png" alt="Suru Collection"/>{title&&<h1>{title}</h1>}{children}</section></main><Footer/></>
}
