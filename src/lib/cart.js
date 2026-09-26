export const CART="suruCart";

export const readCart=()=>{try{const x=JSON.parse(localStorage.getItem(CART)||"[]");return Array.isArray(x)?x:[]}catch{return[]}};
export const saveCart=c=>{localStorage.setItem(CART,JSON.stringify(c));window.dispatchEvent(new Event("suruCartChanged"))};
export function addCart(item){
  const c=readCart(), key=x=>[x.product_id||x.code||"",x.size||"",x.color||""].join("::");
  const i=c.findIndex(x=>key(x)===key(item));
  if(i>=0)c[i].quantity=(Number(c[i].quantity)||0)+(Number(item.quantity)||1);else c.push({...item,quantity:Number(item.quantity)||1});
  c.forEach(x=>x.qty=x.quantity);saveCart(c);
}
