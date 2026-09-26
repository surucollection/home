import React from "react";

export default function CollectionCard({image,name,description}){
  return <a className="collection-card" href="/products.html"><div className="collection-image"><img src={"/assets/"+image} alt={name} loading="lazy"/></div><div className="collection-content"><h3>{name}</h3><p>{description}</p></div></a>
}
