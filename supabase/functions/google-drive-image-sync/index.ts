import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROOT="1zeVIdGtmBCianwPQsGxwOkXnqclLapNh";
const DRIVE="https://www.googleapis.com/drive/v3/files";
const TOKEN="https://oauth2.googleapis.com/token";
const SCOPE="https://www.googleapis.com/auth/drive";

const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const ub64=(s:string)=>b64(new TextEncoder().encode(s));

function der(pem:string){
  const normalized=pem.replace(/\\n/g,"\n").replace(/\\r/g,"\r");
  const clean=normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g,"").replace(/\s+/g,"");
  return Uint8Array.from(atob(clean),c=>c.charCodeAt(0));
}

async function token(){
  const email=Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL")?.trim();
  const pk=Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY")?.trim();
  if(!email||!pk)throw new Error("Google Drive service-account secrets are not configured.");
  const now=Math.floor(Date.now()/1000);
  const unsigned=ub64(JSON.stringify({alg:"RS256",typ:"JWT"}))+"."+ub64(JSON.stringify({iss:email,scope:SCOPE,aud:TOKEN,iat:now,exp:now+3600}));
  const key=await crypto.subtle.importKey("pkcs8",der(pk),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
  const r=await fetch(TOKEN,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:unsigned+"."+b64(new Uint8Array(sig))})});
  const raw=await r.text();
  let p:any={};try{p=JSON.parse(raw||"{}")}catch{}
  if(!r.ok||!p.access_token){
    console.error("DRIVE_DIAG auth",JSON.stringify({status:r.status,error:p?.error||null,description:String(p?.error_description||"").slice(0,250)}));
    throw new Error("Google authorization failed ("+r.status+"): "+String(p?.error_description||p?.error||"unknown authorization error").slice(0,300));
  }
  console.log("DRIVE_DIAG auth_ok",email);
  return p.access_token as string;
}

async function list(t:string,q:string){
  const out:any[]=[];let page="";
  do{
    const p=new URLSearchParams({q,fields:"files(id,name,mimeType,createdTime,modifiedTime),nextPageToken",pageSize:"1000",supportsAllDrives:"true",includeItemsFromAllDrives:"true"});
    if(page)p.set("pageToken",page);
    const r=await fetch(DRIVE+"?"+p,{headers:{Authorization:"Bearer "+t}});
    const raw=await r.text();let x:any={};try{x=JSON.parse(raw||"{}")}catch{}
    if(!r.ok){
      console.error("DRIVE_DIAG api",JSON.stringify({status:r.status,error:x?.error?.status||null,reason:x?.error?.errors?.[0]?.reason||null,message:String(x?.error?.message||raw||"").slice(0,350)}));
      throw new Error("Google Drive API "+r.status+": "+String(x?.error?.message||raw||"empty response").slice(0,400));
    }
    out.push(...(x.files||[]));page=x.nextPageToken||"";
  }while(page);
  return out;
}

const driveIdFromUrl=(url:string)=>{
  const value=String(url||"").trim();
  const proxy=value.match(/[?&]id=([^&#]+)/i);if(proxy?.[1])return proxy[1];
  const direct=value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);if(direct?.[1])return direct[1];
  const storage=value.match(/\/storage\/v1\/object\/public\/product-images\/drive\/([^./?]+)(?:\.[^/?]+)?$/i);
  return storage?.[1]||"";
};

const filenameCompare=new Intl.Collator("en",{numeric:true,sensitivity:"base"});
const ok=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});

Deno.serve(async req=>{
  if(req.method!=="POST")return ok({message:"POST required."},405);
  const sb=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
  const secret=req.headers.get("x-cron-secret")||"";
  const auth=await sb.rpc("verify_drive_sync_cron_secret",{p_secret:secret});
  if(auth.error||auth.data!==true)return ok({message:"Unauthorized."},401);

  try{
    const t=await token();
    const p=await sb.from("products").select("id,product_code").not("product_code","is",null);
    if(p.error)throw p.error;
    const folders=await list(t,"'"+ROOT+"' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const fm=new Map<string,any>();
    for(const f of folders){
      const c=String(f.name||"").trim().toUpperCase();
      if(/^[A-Z0-9_-]{1,64}$/.test(c)&&!fm.has(c))fm.set(c,f);
    }

    let matched=0,images=0,updated=0,inserted=0;
    const errors:string[]=[];

    for(const product of p.data||[]){
      const code=String(product.product_code||"").trim().toUpperCase();
      const folder=fm.get(code);
      if(!folder)continue;
      matched++;

      try{
        const files=(await list(t,"'"+folder.id+"' in parents and mimeType contains 'image/' and trashed = false"))
          .sort((a,b)=>{
            const byName=filenameCompare.compare(String(a.name||""),String(b.name||""));
            return byName!==0?byName:String(a.id||"").localeCompare(String(b.id||""));
          });

        const existing=await sb.from("product_images").select("id,image_url,sort_order,is_main").eq("product_id",product.id);
        if(existing.error)throw existing.error;

        const rows=existing.data||[];
        const byDriveId=new Map<string,any[]>();
        for(const row of rows){
          const id=driveIdFromUrl(row.image_url);
          if(!id)continue;
          const arr=byDriveId.get(id)||[];
          arr.push(row);
          byDriveId.set(id,arr);
        }

        const desiredMainId=String(files[0]?.id||"");
        const desiredIds=new Set(files.map(f=>String(f.id)));

        const duplicateMainRows=rows.filter(r=>r.is_main&&(!desiredMainId||!desiredIds.has(driveIdFromUrl(r.image_url))));
        if(duplicateMainRows.length>0 || rows.filter(r=>r.is_main).length>1){
          const clear=await sb.from("product_images").update({is_main:false}).eq("product_id",product.id);
          if(clear.error)throw clear.error;
        }

        if(files.length>0){
          const stale=rows.filter(r=>{
            const id=driveIdFromUrl(r.image_url);
            return id && !desiredIds.has(id);
          });
          if(stale.length){
            const del=await sb.from("product_images").delete().in("id",stale.map(r=>r.id));
            if(del.error)throw del.error;
          }
        }

        for(const [i,f] of files.entries()){
          images++;
          const url=(Deno.env.get("SUPABASE_URL")||"")+"/functions/v1/google-drive-image?id="+encodeURIComponent(f.id);
          const matches=byDriveId.get(String(f.id))||[];
          const target=matches.find(r=>/supabase\.co\/functions\/v1\/google-drive-image/i.test(String(r.image_url||"")))||matches[0];

          if(target){
            const needsUpdate=String(target.image_url||"")!==url
              ||String(target.alt_text||"")!==code
              ||Number(target.sort_order)!==i
              ||Boolean(target.is_main)!==(i===0);
            if(needsUpdate){
              const up=await sb.from("product_images").update({image_url:url,alt_text:code,sort_order:i,is_main:i===0}).eq("id",target.id);
              if(up.error)throw up.error;
              updated++;
            }
          }else{
            const ins=await sb.from("product_images").insert({product_id:product.id,image_url:url,alt_text:code,sort_order:i,is_main:i===0});
            if(ins.error)throw ins.error;
            inserted++;
          }
        }
      }catch(e){
        errors.push(code+": "+(e instanceof Error?e.message:JSON.stringify(e)));
      }
    }

    return ok({success:true,products:p.data?.length||0,folders_matched:matched,images_discovered:images,images_updated:updated,images_inserted:inserted,errors});
  }catch(e){
    console.error("google-drive-image-sync",e);
    return ok({success:false,message:e instanceof Error?e.message:String(e).slice(0,500)||"Drive sync failed."},502);
  }
});
