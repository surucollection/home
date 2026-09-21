(function(){
  const KEY='suruCart';
  function getCart(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){return []}}
  function saveCart(c){localStorage.setItem(KEY,JSON.stringify(c));updateCount();}
  function add(item){
    const c=getCart();
    const size=item.size||'';
    const existing=c.find(x=>x.code===item.code && x.size===size);
    if(existing) existing.qty+=item.qty||1; else c.push({...item,qty:item.qty||1});
    saveCart(c); alert('Added to your cart.');
  }
  function updateCount(){
    const n=getCart().reduce((a,x)=>a+(x.qty||0),0);
    document.querySelectorAll('#cartCount').forEach(x=>x.textContent=n);
  }
  document.addEventListener('click',function(e){
    const b=e.target.closest('.add-cart,.buy-button'); if(!b)return;
    e.preventDefault(); e.stopPropagation();
    const page=b.classList.contains('buy-button');
    const size=page?(document.querySelector('#size')?.value||''):'';
    const qty=Math.max(1,parseInt(page?(document.querySelector('#qty')?.value||1):1,10)||1);
    if(page && document.querySelector('#size') && !size){alert('Please select a size first.');return;}
    add({code:b.dataset.code,name:b.dataset.name,price:Number(b.dataset.price),image:b.dataset.image,size,qty});
  });
  updateCount();
})();
