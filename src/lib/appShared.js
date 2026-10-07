import { supabase } from "./api.js";

const SIZE_ORDER=["XXS","XS","S","M","L","XL","XXL","XXXL"];
const sizeRank=v=>{const n=String(v||"").trim().toUpperCase();const i=SIZE_ORDER.indexOf(n);return i<0?SIZE_ORDER.length:i};
const NCM_BRANCH_CACHE={items:null,promise:null,expires:0};
const NCM_BRANCH_STORAGE_KEY="suru:ncm-branches:v1";
const NCM_BRANCH_CACHE_MS=15*60*1000;
async function getNcmBranches(){
  if(NCM_BRANCH_CACHE.items?.length&&Date.now()<NCM_BRANCH_CACHE.expires)return NCM_BRANCH_CACHE.items;
  if(NCM_BRANCH_CACHE.promise)return NCM_BRANCH_CACHE.promise;
  try{
    const raw=localStorage.getItem(NCM_BRANCH_STORAGE_KEY);
    if(raw){
      const cached=JSON.parse(raw);
      if(Array.isArray(cached?.items)&&cached.items.length){
        NCM_BRANCH_CACHE.items=cached.items;
        NCM_BRANCH_CACHE.expires=Number(cached.expires||0);
        if(Date.now()<NCM_BRANCH_CACHE.expires)return NCM_BRANCH_CACHE.items;
      }
    }
  }catch{}
  NCM_BRANCH_CACHE.promise=supabase.functions.invoke("ncm-branches").then(({data,error})=>{
    if(error)throw error;
    const branches=Array.isArray(data)?data:(data?.branches||[]);
    NCM_BRANCH_CACHE.items=branches;
    NCM_BRANCH_CACHE.expires=Date.now()+NCM_BRANCH_CACHE_MS;
    try{localStorage.setItem(NCM_BRANCH_STORAGE_KEY,JSON.stringify({expires:NCM_BRANCH_CACHE.expires,items:branches}))}catch{}
    return branches;
  }).finally(()=>{NCM_BRANCH_CACHE.promise=null});
  return NCM_BRANCH_CACHE.promise;
}
const ncmNorm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
function ncmCoords(v){
  const s=String(v||"").trim();
  const m=s.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if(!m)return null;
  const lat=Number(m[1]),lon=Number(m[2]);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon}:null;
}
function ncmDistanceKm(a,b){
  if(!a||!b)return Infinity;
  const r=6371,rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return 2*r*Math.asin(Math.sqrt(x));
}
function ncmFieldTokens(v){
  return String(v||"").split(/[,;|/]+/).map(ncmNorm).filter(Boolean);
}
function ncmWordMatch(value,target){
  const v=ncmNorm(value),t=ncmNorm(target);
  if(!v||!t)return false;
  if(v===t)return true;
  const vt=v.split(" "),tt=t.split(" ");
  return tt.every(w=>vt.includes(w))||v.startsWith(t+" ")||t.startsWith(v+" ");
}
function matchNcmBranch(branches,city,district,location=null,province=""){
  const primaryCity=String(city||"").split(",")[0].trim();
  const primaryDistrict=String(district||"").split(",")[0].trim();
  const c=ncmNorm(primaryCity),d=ncmNorm(primaryDistrict),p=ncmNorm(province);
  if(!c&&!d&&!p&&!location)return "";
  const rows=branches.map(b=>{
    const name=ncmNorm(b.name),mun=ncmNorm(b.municipality),bd=ncmNorm(b.district_name),bp=ncmNorm(b.province_name);
    const address=ncmNorm(b.address),areas=ncmFieldTokens(b.areas_covered);
    const searchText=ncmNorm([b.name,b.code,b.municipality,b.address,b.areas_covered,b.district_name,b.province_name].filter(Boolean).join(" "));
    const distance=ncmDistanceKm(location,ncmCoords(b.geocode));
    const areaExact=v=>areas.some(a=>a===v);
    const areaWord=v=>areas.some(a=>ncmWordMatch(a,v));
    const cityCompatible=!c||areaExact(c)||areaWord(c)||mun===c||ncmWordMatch(mun,c)||name===c||ncmWordMatch(name,c);
    const districtCompatible=!d||bd===d||ncmWordMatch(bd,d)||areaExact(d)||areaWord(d)||ncmWordMatch(address,d)||ncmWordMatch(searchText,d);
    const provinceCompatible=!p||bp===p||ncmWordMatch(bp,p)||ncmWordMatch(searchText,p);
    return {b,name,mun,bd,bp,address,areas,searchText,distance,cityCompatible,districtCompatible,provinceCompatible,areaExact,areaWord};
  });

  // Lookup 1: customer's city/municipality inside NCM's Areas Covered.
  // This is decisive: when a city exists in Areas Covered, stop here.
  if(c){
    const cityMatches=rows.filter(r=>r.areas.length&&(r.areaExact(c)||r.areaWord(c)));
    if(cityMatches.length){
      cityMatches.sort((a,b)=>{
        const as=(a.areaExact(c)?1000:0)
          +(a.mun===c?100:0)
          +(a.name===c?50:0)
          +(a.districtCompatible?10:0)
          +(a.provinceCompatible?5:0)
          +(a.distance<Infinity?1:0);
        const bs=(b.areaExact(c)?1000:0)
          +(b.mun===c?100:0)
          +(b.name===c?50:0)
          +(b.districtCompatible?10:0)
          +(b.provinceCompatible?5:0)
          +(b.distance<Infinity?1:0);
        return bs-as||a.distance-b.distance;
      });
      return cityMatches[0].b.name||"";
    }
  }

  // Lookup 2: municipality / branch name, still respecting address geography.
  if(c){
    const cityMatches=rows.filter(r=>(r.mun===c||ncmWordMatch(r.mun,c)||r.name===c||ncmWordMatch(r.name,c)))
      .filter(r=>!d||!r.bd||r.districtCompatible)
      .filter(r=>!p||!r.bp||r.provinceCompatible);
    if(cityMatches.length){
      cityMatches.sort((a,b)=>(a.mun===c?0:1)-(b.mun===c?0:1)||a.distance-b.distance);
      return cityMatches[0].b.name||"";
    }
  }

  // Lookup 3: district inside Areas Covered.
  if(d){
    const districtMatches=rows.filter(r=>r.areas.length&&(r.areaExact(d)||r.areaWord(d)))
      .filter(r=>!r.bd||r.districtCompatible)
      .filter(r=>!r.bp||r.provinceCompatible);
    if(districtMatches.length){
      districtMatches.sort((a,b)=>(a.areaExact(d)?0:1)-(b.areaExact(d)?0:1)||a.distance-b.distance);
      return districtMatches[0].b.name||"";
    }
  }

  // Lookup 4: explicit district metadata/name/address, never cross a known province.
  if(d){
    const districtMatches=rows.filter(r=>r.bd===d||ncmWordMatch(r.bd,d)||ncmWordMatch(r.name,d)||ncmWordMatch(r.address,d))
      .filter(r=>!r.bp||!p||r.provinceCompatible);
    if(districtMatches.length){
      districtMatches.sort((a,b)=>(a.bd===d?0:1)-(b.bd===d?0:1)||a.distance-b.distance);
      return districtMatches[0].b.name||"";
    }
  }

  // No safe textual match: never guess from geocode alone.
  return "";
}
const cats=[["cat-sarees.jpg","Sarees","Elegant drapes for every occasion."],["cat-lehengas.jpg","Lehengas","Festive looks with timeless charm."],["cat-suits.jpg","Suits","Classic ethnic styles for every day."],["cat-gowns.jpg","Gowns","Graceful styles for special moments."],["cat-kurtis.jpg","Kurtis","Beautiful comfort for everyday elegance."],["cat-dupatta.jpg","Dupattas","Finishing touches that complete the look."],["cat-kids-wear.jpg","Kids Wear","Charming traditional styles for little ones."],["cat-accessories.jpg","Accessories","Details that add a little more sparkle."]];
const NEPAL_PROVINCES=[
 {name:"Koshi Province",districts:["Taplejung","Sankhuwasabha","Solukhumbu","Okhaldhunga","Khotang","Bhojpur","Dhankuta","Tehrathum","Panchthar","Ilam","Jhapa","Morang","Sunsari","Udayapur"]},
 {name:"Madhesh Province",districts:["Saptari","Siraha","Dhanusha","Mahottari","Sarlahi","Rautahat","Bara","Parsa"]},
 {name:"Bagmati Province",districts:["Dolakha","Ramechhap","Sindhuli","Rasuwa","Sindhupalchok","Kavrepalanchok","Nuwakot","Kathmandu","Bhaktapur","Lalitpur","Makwanpur","Chitwan","Dhading"]},
 {name:"Gandaki Province",districts:["Gorkha","Manang","Mustang","Myagdi","Kaski","Lamjung","Tanahun","Nawalpur","Syangja","Parbat","Baglung"]},
 {name:"Lumbini Province",districts:["Rukum East","Rolpa","Pyuthan","Gulmi","Arghakhanchi","Palpa","Nawalparasi West","Rupandehi","Kapilvastu","Dang","Banke","Bardiya"]},
 {name:"Karnali Province",districts:["Dolpa","Mugu","Humla","Jumla","Kalikot","Dailekh","Jajarkot","Rukum West","Salyan","Surkhet"]},
 {name:"Sudurpashchim Province",districts:["Bajura","Bajhang","Darchula","Baitadi","Dadeldhura","Doti","Achham","Kailali","Kanchanpur"]}
];
const provinceDistricts=name=>NEPAL_PROVINCES.find(p=>p.name===name)?.districts||[];
const canonicalProvince=v=>{
 const s=String(v||"").trim().toLowerCase();
 if(!s)return "";
 const legacy={"province 1":"Koshi Province","province no. 1":"Koshi Province","province 2":"Madhesh Province","province no. 2":"Madhesh Province","province 3":"Bagmati Province","province no. 3":"Bagmati Province","province 4":"Gandaki Province","province no. 4":"Gandaki Province","province 5":"Lumbini Province","province no. 5":"Lumbini Province","province 6":"Karnali Province","province no. 6":"Karnali Province","province 7":"Sudurpashchim Province","province no. 7":"Sudurpashchim Province"};
 return legacy[s]||NEPAL_PROVINCES.find(p=>p.name.toLowerCase()===s)?.name||String(v||"");
};

async function offerPasskeyPrompt(userId){
 if(!userId)return;
 const key="suru-passkey-prompt:"+userId;
 if(localStorage.getItem(key)==="dismissed"||localStorage.getItem(key)==="enabled")return;
 return new Promise(resolve=>{
  const overlay=document.createElement("div");
  overlay.className="passkey-prompt-overlay";
  overlay.innerHTML='<section class="passkey-prompt" role="dialog" aria-modal="true" aria-labelledby="passkey-prompt-title"><button class="passkey-prompt-close" type="button" aria-label="Close">×</button><div class="passkey-prompt-icon" aria-hidden="true"><i class="fa-solid fa-fingerprint"></i></div><h2 id="passkey-prompt-title">Set Up Your Passkey</h2><p>Make your next login faster and more secure with Face ID, Touch ID, your device PIN, or a password manager.</p><button class="btn passkey-prompt-setup" type="button">Set Up Passkey</button><button class="passkey-prompt-later" type="button">Maybe Later</button><p class="passkey-prompt-status" aria-live="polite"></p></section>';
  document.body.appendChild(overlay);
  const close=()=>{overlay.remove();resolve()};
  const later=()=>{localStorage.setItem(key,"dismissed");close()};
  overlay.querySelector(".passkey-prompt-close").addEventListener("click",later);
  overlay.querySelector(".passkey-prompt-later").addEventListener("click",later);
  overlay.addEventListener("click",e=>{if(e.target===overlay)later()});
  overlay.querySelector(".passkey-prompt-setup").addEventListener("click",async e=>{
   const button=e.currentTarget,status=overlay.querySelector(".passkey-prompt-status");
   button.disabled=true;status.textContent="Starting secure passkey setup…";
   try{const{error}=await supabase.auth.registerPasskey();if(error)throw error;localStorage.setItem(key,"enabled");status.textContent="Passkey added successfully.";button.textContent="Done";button.disabled=false;button.onclick=close;overlay.querySelector(".passkey-prompt-later").hidden=true}
   catch(err){status.textContent=err?.message||"Passkey setup was not completed. You can add one later from My Account.";button.disabled=false;status.classList.add("is-error")}
  });
 });
}

function normalizeNepalPhone(value){
 const raw=String(value||"").trim().replace(/[\s()-]/g,"");
 if(raw.startsWith("+977"))return raw;
 if(raw.startsWith("977"))return "+"+raw;
 if(raw.startsWith("0"))return "+977"+raw.slice(1);
 return "+977"+raw;
}

export { SIZE_ORDER,sizeRank,getNcmBranches,ncmNorm,ncmCoords,ncmDistanceKm,ncmFieldTokens,ncmWordMatch,matchNcmBranch,cats,NEPAL_PROVINCES,provinceDistricts,canonicalProvince,offerPasskeyPrompt,normalizeNepalPhone };