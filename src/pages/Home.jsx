import React,{useEffect,useMemo,useRef,useState} from "react";
import QRCode from "qrcode";
import { supabase, get, money, norm, imageUrl } from "../lib/api.js";
import { readCart, addCart, removeCart, clearCart, cartKey } from "../lib/cart.js";
import { openInvoice, openCustomerInvoice } from "../lib/invoice.js";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import Hero from "../components/Hero.jsx";
import CollectionCard from "../components/CollectionCard.jsx";
import ProductsGrid from "../components/ProductsGrid.jsx";
import AuthLayout from "../components/AuthLayout.jsx";
import OrderTable from "../components/admin/OrderTable.jsx";
import ProductAdminCard from "../components/admin/ProductAdminCard.jsx";
import StockRow from "../components/admin/StockRow.jsx";
import PreorderAdminQueue from "../components/admin/PreorderAdminQueue.jsx";
import CustomerAddressesPanel from "../components/customer/CustomerAddressesPanel.jsx";
import { SIZE_ORDER,sizeRank,getNcmBranches,ncmNorm,ncmCoords,ncmDistanceKm,ncmFieldTokens,ncmWordMatch,matchNcmBranch,cats,NEPAL_PROVINCES,provinceDistricts,canonicalProvince,offerPasskeyPrompt,normalizeNepalPhone } from "../lib/appShared.js";

function Home(){return <><Header/><main><section className="hero"><div className="hero-content"><p className="eyebrow">SURU COLLECTION</p><h1>More Than Fashion.<br/><em>It's a Feeling.</em></h1><p>Discover thoughtfully selected traditional and ethnic wear designed to make every occasion feel special.</p><a className="hero-button" href="products.html">Explore Products</a></div></section><section id="collection" className="section"><div className="section-heading"><p className="eyebrow">OUR COLLECTION</p><h2>Made for Every Celebration</h2><p>Explore timeless silhouettes, festive favourites and elegant everyday styles.</p></div><div className="collection-grid">{cats.map(([image,name,description])=><CollectionCard key={name} image={image} name={name} description={description}/>)}</div></section><section className="section home-products-section featured-products-section"><div className="section-heading"><p className="eyebrow">HANDPICKED FOR YOU</p><h2>Featured Products</h2><p>Explore the pieces selected as our featured favourites.</p></div><ProductsGrid featured limit={12}/><div className="featured-view-all"><a className="secondary-button" href="products.html?featured=true">View All Featured Products</a></div></section><section className="section home-products-section recent-products-section"><div className="section-heading"><p className="eyebrow">JUST ARRIVED</p><h2>Recently Added</h2><p>Discover the latest additions to Suru Collection.</p></div><ProductsGrid limit={12}/></section></main><Footer/></>}