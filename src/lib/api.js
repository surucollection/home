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
export const money=v=>"NPR "+Number(v||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
export const norm=v=>String(v??"").trim().toLowerCase();
