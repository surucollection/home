import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

function pageName(){
  const p=window.location.pathname.replace(/^\\/+|\\/+$/g,'');
  if(!p) return 'index.html';
  return p.split('/').pop() || 'index.html';
}

async function loadLegacy(name){
  const file=['index',''].includes(name)?'index.html':name.endsWith('.html')?name:'index.html';
  const res=await fetch('/legacy/'+file);
  if(!res.ok) throw new Error('Legacy page not found: '+file);
  return res.text();
}

function App(){
  const [html,setHtml]=useState('');
  const [error,setError]=useState('');
  const name=pageName();

  useEffect(()=>{
    let alive=true;
    loadLegacy(name).then(async doc=>{
      if(!alive)return;
      const parsed=new DOMParser().parseFromString(doc,'text/html');
      document.title=parsed.title||'Suru Collection';
      const meta=parsed.querySelector('meta[name="description"]');
      if(meta){
        let current=document.querySelector('meta[name="description"]');
        if(!current){current=document.createElement('meta');current.name='description';document.head.appendChild(current);}
        current.content=meta.content;
      }
      setHtml(parsed.body.innerHTML);
      setTimeout(()=>{
        if(!alive)return;
        const old=document.getElementById('suru-legacy-app');
        if(old)old.remove();
        const script=document.createElement('script');
        script.id='suru-legacy-app';
        script.src='/legacy/app.js';
        script.onload=()=>document.dispatchEvent(new Event('DOMContentLoaded',{bubbles:true}));
        document.body.appendChild(script);
      },0);
    }).catch(e=>alive&&setError(e.message));
    return()=>{alive=false};
  },[name]);

  useEffect(()=>{
    const onClick=e=>{
      const a=e.target.closest?.('a[href]');
      if(!a)return;
      const href=a.getAttribute('href');
      if(!href||href.startsWith('#')||/^(https?:|mailto:|tel:|javascript:)/i.test(href))return;
      const url=new URL(href,window.location.href);
      if(url.origin!==window.location.origin)return;
      if(url.pathname.endsWith('.html')||url.pathname==='/'){
        e.preventDefault();
        history.pushState({},'',url.pathname+url.search+url.hash);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    };
    const pop=()=>setHtml('');
    document.addEventListener('click',onClick);
    window.addEventListener('popstate',pop);
    return()=>{document.removeEventListener('click',onClick);window.removeEventListener('popstate',pop)};
  },[]);

  if(error)return <main style={{padding:'40px',fontFamily:'sans-serif'}}><h1>Suru Collection</h1><p>{error}</p></main>;
  return <div dangerouslySetInnerHTML={{__html:html}} />;
}

createRoot(document.getElementById('root')).render(<App/>);