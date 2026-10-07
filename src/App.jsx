import React from "react";
import Login from "./pages/Login.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Register from "./pages/Register.jsx";
import Account from "./pages/Account.jsx";
import AccountProfile from "./pages/AccountProfile.jsx";
import "./account-preorder.css";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Products from "./pages/Products.jsx";
import Product from "./pages/Product.jsx";
import Order from "./pages/Order.jsx";
import Admin from "./pages/Admin.jsx";
import Policy from "./pages/Policy.jsx";

function App(){const params=new URLSearchParams(location.search);const page=params.get("page");if(page==="about")return <About/>;if(page==="contact")return <Contact/>;if(page==="policy")return <Policy/>;if(page==="products")return <Products/>;if(page==="product")return <Product/>;if(page==="login")return <Login/>;if(page==="reset-password")return <ResetPassword/>;if(page==="register")return <Register/>;if(page==="account")return <AccountProfile/>;if(page==="addresses")return <Account/>;if(page==="order")return <Order/>;if(page==="admin")return <Admin/>;const p=location.pathname.replace(/\/+$/,"")||"/";if(p.endsWith("/about")||p.endsWith("/about.html"))return <About/>;if(p.endsWith("/contact")||p.endsWith("/contact.html"))return <Contact/>;if(p.endsWith("/policy")||p.endsWith("/policy.html"))return <Policy/>;if(p.endsWith("/products")||p.endsWith("/products.html"))return <Products/>;if(p.endsWith("/product")||p.endsWith("/product.html")||params.has("code")||params.has("product"))return <Product/>;if(p.endsWith("/login")||p.endsWith("/login.html"))return <Login/>;if(p.endsWith("/reset-password")||p.endsWith("/reset-password/"))return <ResetPassword/>;if(p.endsWith("/register")||p.endsWith("/register.html"))return <Register/>;if(p.endsWith("/account")||p.endsWith("/account/"))return <AccountProfile/>;if(p.endsWith("/addresses")||p.endsWith("/addresses/"))return <Account/>;if(p.endsWith("/orders")||p.endsWith("/orders/"))return <Account/>;if(p.endsWith("/order")||p.endsWith("/order.html"))return <Order/>;if(p.endsWith("/admin")||p.endsWith("/admin.html"))return <Admin/>;return <Home/>}


export default App;
