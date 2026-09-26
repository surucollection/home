import React,{useState} from "react";

export default function StockRow({s,productId,save}){
  const[v,setV]=useState(s.stock);
  return <div className="stock-row"><span><b>{s.size||"—"}</b>{s.color&&<small className="stock-color">{s.color}</small>}</span><input type="number" min="0" value={v} onChange={e=>setV(e.target.value)}/><button className="primary" onClick={()=>save(s.id,productId,v,s.stock)}>Save</button></div>
}
