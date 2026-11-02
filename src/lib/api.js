import { createClient } from "@supabase/supabase-js";

export const API="https://vkycraymxhkqxgpcpdzw.supabase.co/rest/v1/";
const GET_CACHE=new Map();
const GET_CACHE_MS=5000;
export const KEY="sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC";
export const supabase=createClient("https://vkycraymxhkqxgpcpdzw.supabase.co",KEY,{auth:{experimental:{passkey:true}}});

export async function get(table,params={}){
  const u=new URL(API+table);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  const cacheable=table==="products"||table==="product_images";
  const key=cacheable?u.toString():"";
  if(cacheable){
    const hit=GET_CACHE.get(key);
    if(hit&&Date.now()-hit.time<GET_CACHE_MS)return hit.data;
  }
  const r=await fetch(u,{headers:{apikey:KEY,Authorization:"Bearer "+KEY,Accept:"application/json"}});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message||"Request failed");
  const data=await r.json();
  if(cacheable)GET_CACHE.set(key,{time:Date.now(),data});
  return data;
}

export const imageUrl=(url,width=600)=>{
  const value=String(url||"").trim();
  const targetWidth=Math.max(240,Math.round(width));
  const isDrive=/^https?:\/\/(?:www\.)?drive\.google\.com\//i.test(value);
  const driveFile=value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i)||(isDrive&&value.match(/[?&]id=([^&#]+)/i));
  if(driveFile?.[1])return "https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/google-drive-image?id="+encodeURIComponent(driveFile[1])+"&w="+targetWidth+"&v=7";
  if(/\/functions\/v1\/google-drive-image(?:\?|$)/i.test(value)){
    try{
      const u=new URL(value),id=u.searchParams.get("id");
      if(id){
        u.searchParams.set("w",String(targetWidth));
        u.searchParams.set("v","7");
        return u.toString();
      }
    }catch{}
  }

  // Cloudflare Image Resizing: serve lightweight, correctly sized catalogue thumbnails
  // from the existing R2 custom domain without changing the stored original URLs.
  try{
    const u=new URL(value);
    if(u.protocol.startsWith("http")&&u.hostname==="images.suru.com.np"&&!u.pathname.startsWith("/cdn-cgi/image/")){
      const path=u.pathname.replace(/^\//,"");
      const options=`width=${targetWidth},quality=76,format=auto,fit=scale-down`;
      return `${u.origin}/cdn-cgi/image/${options}/${path}${u.search}`;
    }
  }catch{}
  return value;
};

export const money=v=>"NPR "+Math.round(Number(v||0)).toLocaleString("en-IN",{maximumFractionDigits:0});
export const norm=v=>String(v??"").trim().toLowerCase();
