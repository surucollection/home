import React,{useState} from "react";
import { createPortal } from "react-dom";
import { supabase, money } from "../lib/api.js";

function FonepayPaymentModal({
  payment,
  qrImage="",
  open=false,
  onToggleOpen,
  remainingOnDelivery=null,
  expiresText="",
  statusText="Payment status is checked automatically. Your order will be confirmed automatically after successful payment.",
  ariaLabelledBy="fonepay-modal-title",
  mobileNo="",
}) {
  const [appPickerOpen,setAppPickerOpen]=useState(false);
  const [banks,setBanks]=useState([]);
  const [banksBusy,setBanksBusy]=useState(false);
  const [banksError,setBanksError]=useState("");

  if(!payment)return null;

  const amount=Number(payment?.amount||0);
  const balance=Number(remainingOnDelivery ?? payment?.balanceDue ?? 0);
  const reference=payment?.reference||"—";

  const loadBanks=async()=>{
    setBanksBusy(true);
    setBanksError("");
    try{
      const {data,error}=await supabase.functions.invoke("fonepay-payment",{
        body:{action:"banks",mobileNo:String(mobileNo||"").trim()}
      });
      if(error)throw error;
      if(data?.error)throw new Error(data.error);
      const list=Array.isArray(data?.banks)?data.banks:[];
      const usable=list.filter(b=>b&&b.bankName&&b.intentScheme);
      if(!usable.length)throw new Error("No supported Fonepay payment apps are available.");
      setBanks(usable);
      setAppPickerOpen(true);
    }catch(e){
      setBanksError(e?.message||"Unable to load payment apps. Please use the QR code.");
    }finally{
      setBanksBusy(false);
    }
  };

  const openBankApp=(bank)=>{
    const scheme=String(bank?.intentScheme||"").trim();
    const payload=String(payment?.qrString||payment?.qrMessage||"").trim();
    if(!scheme||!payload){
      setBanksError("This payment app could not be started. Please use the QR code.");
      return;
    }
    const base=scheme.endsWith("/")?scheme:scheme+"/";
    window.location.href=base+"?qrPayload="+encodeURIComponent(payload);
  };

  if(!open)return <button className="fonepay-reopen-button" type="button" onClick={()=>onToggleOpen?.(true)}>Open Fonepay Payment</button>;

  return createPortal(
    <div className="fonepay-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={ariaLabelledBy}>
      <div className={"fonepay-modal-card"+(appPickerOpen?" fonepay-app-picker-active":"")}>
        <div className="fonepay-brand-row">
          <picture className="fonepay-logo-picture">
            <source media="(prefers-color-scheme: dark)" srcSet="/assets/fonepay-logo.webp" />
            <img className="fonepay-real-logo" src="/assets/fonepay-logo-dark.webp" alt="Checkout by Fonepay" />
          </picture>
          <button className="fonepay-modal-minimize" type="button" onClick={()=>{setAppPickerOpen(false);setBanksError("");onToggleOpen?.(false)}} aria-label="Minimize Fonepay payment">−</button>
        </div>

        {appPickerOpen ? (
          <div className="fonepay-app-picker">
            <div className="fonepay-app-picker-title">
              <button type="button" className="fonepay-app-picker-back" onClick={()=>{setAppPickerOpen(false);setBanksError("")}} aria-label="Back to QR">‹</button>
              <div><strong>Pay with your Bank</strong><span>Select your bank or wallet</span></div>
            </div>
            <div className="fonepay-bank-list">
              {banks.map((bank,i)=><button type="button" className="fonepay-bank-option" key={bank.bankCode||bank.bankName||i} onClick={()=>openBankApp(bank)}>
                {bank.bankIcon?<img src={bank.bankIcon} alt="" />:<span className="fonepay-bank-fallback">F</span>}
                <span>{bank.bankName}</span>
              </button>)}
            </div>
            {banksError&&<p className="fonepay-app-error">{banksError}</p>}
          </div>
        ) : (
          <div className="fonepay-payment-card">
            <div id={ariaLabelledBy} className="fonepay-pay-amount">{"Pay "+money(amount)+" to confirm your order."}</div>
            {qrImage?<div className="fonepay-qr-wrap"><img src={qrImage} alt="Fonepay payment QR" /></div>:<div className="fonepay-qr-placeholder" role="status">Preparing secure Fonepay QR…</div>}
            <div className="fonepay-or">or</div>
            <button type="button" className="fonepay-app-pay-button" onClick={loadBanks} disabled={banksBusy}>{banksBusy?"Loading payment apps…":"Pay with your Bank"}</button>
            {banksError&&<p className="fonepay-app-error">{banksError}</p>}
            <div className="fonepay-payment-meta">
              <div><span>Amount</span><strong>{money(amount)}</strong></div>
              {remainingOnDelivery!==null&&remainingOnDelivery!==undefined&&<div><span>Remaining on delivery</span><strong>{money(balance)}</strong></div>}
              <div className="fonepay-reference"><span>Reference</span><strong>{reference}</strong></div>
            </div>
            <p className="fonepay-auto-status"><span className="fonepay-live-dot"></span>{statusText}</p>
            {expiresText&&<p className="small-note fonepay-expiry-note"><b>{expiresText}</b></p>}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
export default FonepayPaymentModal;
