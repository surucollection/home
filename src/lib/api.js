import { createClient } from "@supabase/supabase-js";

export const API="https://vkycraymxhkqxgpcpdzw.supabase.co/rest/v1/";
export const KEY="sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC";
export const supabase=createClient("https://vkycraymxhkqxgpcpdzw.supabase.co",KEY);

export async function get(table,params={}){
  const u=new URL(API+table);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  const r=await fetch(u,{headers:{apikey:KEY,Authorization:"Bearer "+KEY,Accept:"application/json"}});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message||"Request failed");
  return r.json();
}

// Cloudinary automatically delivers AVIF/WebP when supported, compresses the image,
// and caps the width for product-card usage. Non-Cloudinary URLs are unchanged.
export const imageUrl=(url,width=600)=>{
  const value=String(url||"").trim();
  const isDrive=/^https?:\/\/(?:www\.)?drive\.google\.com\//i.test(value);
  const driveFile=value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i)||(isDrive&&value.match(/[?&]id=([^&#]+)/i));
  if(driveFile?.[1])return "https://drive.google.com/thumbnail?id="+encodeURIComponent(driveFile[1])+"&sz=w"+Math.max(240,Math.round(width));
  const marker="/upload/";
  const i=value.indexOf(marker);
  if(!value.includes("res.cloudinary.com")||i<0)return value;
  const rest=value.slice(i+marker.length);
  if(/^f_auto,q_auto,w_\d+/.test(rest))return value;
  return value.slice(0,i+marker.length)+"f_auto,q_auto,w_"+Math.max(120,Math.round(width))+",c_limit/"+rest;
};

export const money=v=>"NPR "+Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
export const norm=v=>String(v??"").trim().toLowerCase();
