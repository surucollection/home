import React from "react";

export default function AdminSettingsTab({
  products,preorderBulkBusy,enablePreordersForAll,disablePreordersForAll,
  setCouponManagerOpen,loadCoupons,
  preorderAdvancePercent,setPreorderAdvancePercent,savePreorderAdvancePercent,preorderSettingsBusy,
  pricingSettings,savePricingSettings,pricingSettingsBusy
}){
 return <><div className="page-title"><div><h2>Settings</h2><p>Manage universal pre-order rules and discount coupons.</p></div></div>

   <div className="card admin-settings-card">
     <div className="page-title"><div><h3>Pre-order Settings</h3><p>The advance percentage applies to every new pre-order, regardless of product.</p></div></div>
     <form className="admin-universal-preorder-form" onSubmit={savePreorderAdvancePercent}>
       <label className="admin-universal-preorder-percent">Advance payment <span>(Universal)</span><div className="admin-percent-input"><input type="number" min="1" max="100" step="1" value={preorderAdvancePercent??30} onChange={e=>setPreorderAdvancePercent(e.target.value)} disabled={preorderSettingsBusy}/><b>%</b></div></label>
       <button className="primary" type="submit" disabled={preorderSettingsBusy}>{preorderSettingsBusy?"Saving…":"Save Advance %"}</button>
     </form>
     <div className="admin-settings-divider"/>
     <div className="page-title"><div><h3>Product Pricing & Delivery Settings</h3><p>Base cost × global markup, plus packaging per item. Existing products keep their current price until you enter a base cost in Product Admin.</p></div></div>
     <form className="admin-form" onSubmit={savePricingSettings}>
       <div className="form-grid">
         <label>Global markup (%)<input type="number" min="0" max="500" step="0.01" value={pricingSettings?.product_markup_percent??0} onChange={e=>setPricingSettings(x=>({...x,product_markup_percent:e.target.value}))} disabled={pricingSettingsBusy}/><small className="form-note">Applied to base cost before packaging.</small></label>
         <label>Packaging charge (NPR per item)<input type="number" min="0" max="100000" step="0.01" value={pricingSettings?.packaging_charge_per_item??0} onChange={e=>setPricingSettings(x=>({...x,packaging_charge_per_item:e.target.value}))} disabled={pricingSettingsBusy}/><small className="form-note">Added once to each product's unit selling price.</small></label>
         <label>Default delivery estimate (NPR)<input type="number" min="0" max="100000" step="1" value={pricingSettings?.default_delivery_charge??0} onChange={e=>setPricingSettings(x=>({...x,default_delivery_charge:e.target.value}))} disabled={pricingSettingsBusy}/><small className="form-note">Estimate only. At checkout, the selected NCM branch's quote replaces this amount.</small></label>
       </div>
       <button className="primary" type="submit" disabled={pricingSettingsBusy}>{pricingSettingsBusy?"Saving…":"Save Pricing & Delivery Settings"}</button>
     </form>
     <div className="admin-settings-divider"/>
     <div className="page-title"><div><h3>Pre-order Availability</h3><p>Enable or disable pre-orders for every product at once.</p></div></div>
     <div className="admin-settings-actions"><button className="primary" type="button" onClick={enablePreordersForAll} disabled={preorderBulkBusy||!products.length}>{preorderBulkBusy?"Working…":"Enable Pre-orders for All"}</button><button className="danger" type="button" onClick={disablePreordersForAll} disabled={preorderBulkBusy||!products.length}>{preorderBulkBusy?"Working…":"Disable Pre-orders for All"}</button></div>
   </div>

   <div className="card admin-settings-card"><div className="page-title"><div><h3>Discount Coupons</h3><p>Create and manage promotional coupon codes.</p></div><button className="secondary" type="button" onClick={()=>{setCouponManagerOpen(true);loadCoupons()}}>Manage Discount Coupons</button></div></div>
 </>;
}
