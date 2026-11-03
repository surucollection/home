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
  const isDrive=/^https?:\/\/(?:www\.)?drive\.google\.com\//i.test(value);
  const driveFile=value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i)||(isDrive&&value.match(/[?&]id=([^&#]+)/i));
  if(driveFile?.[1])return "https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/google-drive-image?id="+encodeURIComponent(driveFile[1])+"&w="+Math.max(240,Math.round(width))+"&v=6";
  if(/\/functions\/v1\/google-drive-image(?:\?|$)/i.test(value)){
    try{
      const u=new URL(value),id=u.searchParams.get("id");
      if(id){
        u.searchParams.set("w",String(Math.max(240,Math.round(width))));
        u.searchParams.set("v","6");
        return u.toString();
      }
    }catch{}
  }
  return value;
};

export const productThumbnailUrl=(url,width=480)=>{
  const value=String(url||"").trim();
  if(!value)return value;
  try{
    const parsed=new URL(value);
    if(parsed.hostname.toLowerCase()==="images.suru.com.np"&&/^https?:$/.test(parsed.protocol)){
      const path=parsed.pathname.startsWith("/")?parsed.pathname.slice(1):parsed.pathname;
      if(!path||path.startsWith("cdn-cgi/image/"))return value;
      const targetWidth=Math.min(1200,Math.max(120,Math.round(Number(width)||480)));
      return parsed.origin+"/cdn-cgi/image/width="+targetWidth+",quality=60,format=auto,fit=contain/"+path+parsed.search;
    }
  }catch{}
  return imageUrl(value,width);
};

export const money=v=>"NPR "+Math.round(Number(v||0)).toLocaleString("en-IN",{maximumFractionDigits:0});
export const norm=v=>String(v??"").trim().toLowerCase();
