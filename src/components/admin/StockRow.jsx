import React from "react";

export default function StockRow({s,value,onChange}){
  return <div className="stock-row"><span><b>{s.size||"—"}</b>{s.color&&<small className="stock-color">{s.color}</small>}</span><input type="number" min="0" value={value??s.stock??0} onChange={e=>onChange(e.target.value)}/></div>
}
