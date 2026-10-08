import React from "react";
import { createPortal } from "react-dom";
import { money } from "../lib/api.js";

function FonepayPaymentModal({
  payment,
  qrImage="",
  open=false,
  onToggleOpen,
  remainingOnDelivery=null,
  expiresText="",
  statusText="Payment status is checked automatically. Your order will be confirmed automatically after successful payment.",
  ariaLabelledBy="fonepay-modal-title",
}) {
  if(!payment)return null;

  const handleMinimize=()=>onToggleOpen?.(false);
  const handleOpen=()=>onToggleOpen?.(true);
  const amount=Number(payment?.amount||0);
  const balance=Number(remainingOnDelivery ?? payment?.balanceDue ?? 0);
  const reference=payment?.reference||"—";

  const modal=open&&typeof document!=="undefined"
    ? createPortal(
      <div className="fonepay-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={ariaLabelledBy}>
        <div className="fonepay-modal-card">
          <div className="fonepay-brand-row">
            <div className="fonepay-logo-picture">
              <img className="fonepay-real-logo" src="/assets/fonepay-logo-dark.webp" alt="Checkout by Fonepay" />
            </div>
            <button
              className="fonepay-modal-minimize"
              type="button"
              onClick={handleMinimize}
              aria-label="Minimize Fonepay payment"
            >−</button>
          </div>

          <div className="fonepay-payment-card">
            <div id={ariaLabelledBy} className="fonepay-pay-amount">
              {"Pay "+money(amount)+" to confirm your order."}
            </div>

            {qrImage
              ? <div className="fonepay-qr-wrap"><img src={qrImage} alt="Fonepay payment QR" /></div>
              : <div className="fonepay-qr-placeholder" role="status">Preparing secure Fonepay QR…</div>
            }

            <div className="fonepay-payment-meta">
              <div>
                <span>Amount</span>
                <strong>{money(amount)}</strong>
              </div>

              {remainingOnDelivery!==null && remainingOnDelivery!==undefined && (
                <div>
                  <span>Remaining on delivery</span>
                  <strong>{money(balance)}</strong>
                </div>
              )}

              <div className="fonepay-reference">
                <span>Reference</span>
                <strong>{reference}</strong>
              </div>
            </div>

            <p className="fonepay-auto-status">
              <span className="fonepay-live-dot"></span>
              {statusText}
            </p>

            {expiresText&&<p className="small-note fonepay-expiry-note"><b>{expiresText}</b></p>}
          </div>
        </div>
      </div>,
      document.body
    )
    : null;

  return <>
    {modal}
    {!open&&<button className="fonepay-reopen-button" type="button" onClick={handleOpen}>Open Fonepay Payment</button>}
  </>;
}

export default FonepayPaymentModal;
