import React,{useState} from "react";

export default function AdminSettingsTab({
  products,preorderBulkBusy,enablePreordersForAll,disablePreordersForAll,
  setCouponManagerOpen,loadCoupons,
  preorderAdvancePercent,setPreorderAdvancePercent,savePreorderAdvancePercent,preorderSettingsBusy,
  pricingSettings,setPricingSettings,savePricingSettings,pricingSettingsBusy,message=""
}){
  const [preorderPopupOpen,setPreorderPopupOpen]=useState(false);
  const [pricingPopupOpen,setPricingPopupOpen]=useState(false);
  const allPreordersEnabled=!!products?.length&&products.every(p=>!!p.preorder_enabled);
  const noPreordersEnabled=!!products?.length&&products.every(p=>!p.preorder_enabled);
  const preorderAvailability=!products?.length?"No products loaded":allPreordersEnabled?"Enabled for all products":noPreordersEnabled?"Disabled for all products":"Mixed product availability";
  const openCouponManager=()=>{setCouponManagerOpen(true);loadCoupons()};
  const pricingMessage=String(message||"").startsWith("Pricing settings saved.")||String(message||"").startsWith("Unable to save pricing settings:")?message:"";

  return <>
    {pricingPopupOpen&&<style>{'.main:has(#product-pricing-title) > .message { display: none; }'}</style>}
    <div className="page-title">
      <div><h2>Settings</h2><p>Manage discount coupons, universal pre-order rules, and product pricing.</p></div>
    </div>

    <div className="card admin-settings-card">
      <div className="page-title">
        <div><h3>Discount Coupons</h3><p>Create and manage promotional coupon codes that apply to eligible customer orders.</p></div>
        <button className="primary" type="button" onClick={openCouponManager}>Manage Discount Coupons</button>
      </div>
    </div>

    <div className="card admin-settings-card">
      <div className="page-title">
        <div>
          <h3>Pre-order Settings</h3>
          <p>Set the universal advance percentage and manage pre-order availability for all products.</p>
          <small className="form-note">Current availability: <b>{preorderAvailability}</b></small>
        </div>
        <button className="primary" type="button" onClick={()=>setPreorderPopupOpen(true)}>Manage Pre-order Settings</button>
      </div>
    </div>

    <div className="card admin-settings-card">
      <div className="page-title">
        <div><h3>Product Pricing & Delivery</h3><p>Manage the global markup, packaging charge and default delivery estimate in one place.</p></div>
        <button className="primary" type="button" onClick={()=>setPricingPopupOpen(true)}>Manage Product Pricing</button>
      </div>
    </div>

    {preorderPopupOpen&&<div className="modal-backdrop" onClick={()=>{if(!preorderSettingsBusy&&!preorderBulkBusy)setPreorderPopupOpen(false)}}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="preorder-settings-title" onClick={e=>e.stopPropagation()} style={{maxWidth:"760px",width:"min(760px, calc(100vw - 28px))",maxHeight:"min(88vh, 900px)",overflowY:"auto"}}>
        <div className="page-title">
          <div><h3 id="preorder-settings-title">Pre-order Settings</h3><p>These controls affect new pre-orders and product availability site-wide.</p></div>
          <button className="secondary" type="button" onClick={()=>setPreorderPopupOpen(false)} disabled={preorderSettingsBusy||preorderBulkBusy}>Close</button>
        </div>
        <div className="card">
          <form className="admin-universal-preorder-form" onSubmit={savePreorderAdvancePercent}>
            <label className="admin-universal-preorder-percent">Advance payment <span>(Universal)</span>
              <div className="admin-percent-input">
                <input type="number" min="1" max="100" step="1" value={preorderAdvancePercent??30} onChange={e=>setPreorderAdvancePercent(e.target.value)} disabled={preorderSettingsBusy}/>
                <b>%</b>
              </div>
              <small className="form-note">Applies to new pre-orders across all products. Existing orders keep their recorded amounts.</small>
            </label>
            <button className="primary" type="submit" disabled={preorderSettingsBusy}>{preorderSettingsBusy?"Saving…":"Save Advance %"}</button>
          </form>
        </div>
        <div className="card">
          <div className="page-title"><div><h4>Pre-order Availability</h4><p>Enable or disable pre-orders for every product at once.</p><small className="form-note">Current availability: <b>{preorderAvailability}</b></small></div></div>
          <div className="admin-settings-actions">
            <button className="primary" type="button" onClick={enablePreordersForAll} disabled={preorderBulkBusy||!products.length}>{preorderBulkBusy?"Working…":"Enable Pre-orders for All"}</button>
            <button className="danger" type="button" onClick={disablePreordersForAll} disabled={preorderBulkBusy||!products.length}>{preorderBulkBusy?"Working…":"Disable Pre-orders for All"}</button>
          </div>
        </div>
      </div>
    </div>}

    {pricingPopupOpen&&<div className="modal-backdrop" onClick={()=>{if(!pricingSettingsBusy)setPricingPopupOpen(false)}}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="product-pricing-title" onClick={e=>e.stopPropagation()} style={{maxWidth:"800px",width:"min(800px, calc(100vw - 28px))",maxHeight:"min(88vh, 900px)",overflowY:"auto"}}>
        <div className="page-title">
          <div><h3 id="product-pricing-title">Product Pricing & Delivery Settings</h3><p>Centralized settings used to calculate selling prices for products with a saved base cost.</p></div>
          <button className="secondary" type="button" onClick={()=>setPricingPopupOpen(false)} disabled={pricingSettingsBusy}>Close</button>
        </div>
        {pricingMessage&&<div className={pricingMessage.startsWith("Pricing settings saved.")?"message success":"message error"} role="status" aria-live="polite" style={{marginBottom:16}}>{pricingMessage}</div>}
        <div className="card">
          <form className="admin-form" onSubmit={savePricingSettings}>
            <div className="form-grid">
              <label>Global markup (%)<input type="number" min="0" max="500" step="0.01" value={pricingSettings?.product_markup_percent??0} onChange={e=>setPricingSettings(x=>({...x,product_markup_percent:e.target.value}))} disabled={pricingSettingsBusy}/><small className="form-note">Applied to base cost before packaging.</small></label>
              <label>Packaging charge (NPR per item)<input type="number" min="0" max="100000" step="0.01" value={pricingSettings?.packaging_charge_per_item??0} onChange={e=>setPricingSettings(x=>({...x,packaging_charge_per_item:e.target.value}))} disabled={pricingSettingsBusy}/><small className="form-note">Added once to each product's unit selling price.</small></label>
              <label>Default delivery estimate (NPR)<input type="number" min="0" max="100000" step="1" value={pricingSettings?.default_delivery_charge??0} onChange={e=>setPricingSettings(x=>({...x,default_delivery_charge:e.target.value}))} disabled={pricingSettingsBusy}/><small className="form-note">Estimate only; the selected NCM branch's quote replaces it at checkout.</small></label>
            </div>
            <p className="form-note">Formula: base cost + markup + packaging. Existing products keep their current website price until a base cost is entered in Product Admin.</p>
            <button className="primary" type="submit" disabled={pricingSettingsBusy}>{pricingSettingsBusy?"Saving…":"Save Pricing & Delivery Settings"}</button>
          </form>
        </div>
      </div>
    </div>}
  </>;
}
