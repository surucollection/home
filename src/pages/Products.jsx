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

function Products(){const params=new URLSearchParams(location.search);const category=params.get("category")||"";const featured=params.get("featured")==="true";return <><Header/><main><Hero eyebrow={featured?"HANDPICKED FOR YOU":"SHOP SURU"} title={featured?"Featured Products":category||"Our Products"} text={featured?"Explore all products selected as featured favourites.":category?"Explore our "+category+" collection.":"Explore our complete collection of traditional and ethnic wear."}/><section className="section shop-section products-page-section"><ProductsGrid category={category} featured={featured}/></section></main><Footer/></>}