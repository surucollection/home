export const CART="suruCart";

export const readCart=()=>{try{const x=JSON.parse(localStorage.getItem(CART)||"[]");return Array.isArray(x)?x:[]}catch{return[]}};
export const cartKey=x=>[x.product_id||x.code||"",x.size||"",x.color||""].join("::");
export const saveCart=c=>{localStorage.setItem(CART,JSON.stringify(c));window.dispatchEvent(new Event("suruCartChanged"))};
export function addCart(item){
  const c=readCart();
  const i=c.findIndex(x=>cartKey(x)===cartKey(item));
  if(i>=0)c[i]={...c[i],...item,quantity:(Number(c[i].quantity)||0)+(Number(item.quantity)||1)};
  else c.push({...item,quantity:Number(item.quantity)||1});
  c.forEach(x=>x.qty=x.quantity);
  saveCart(c);
  return c;
}
export function removeCart(item){
  const c=readCart().filter(x=>cartKey(x)!==cartKey(item));
  saveCart(c);
  return c;
}
export function clearCart(){saveCart([]);return []}
