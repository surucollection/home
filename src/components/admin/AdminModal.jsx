import React,{useEffect} from "react";

export default function AdminModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  headerActions,
  bodyClassName="",
  maxWidth="900px",
  closeDisabled=false,
}) {
  useEffect(()=>{
    if(!open)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKeyDown=e=>{
      if(e.key==="Escape"&&!closeDisabled)onClose?.();
    };
    document.addEventListener("keydown",onKeyDown);
    return()=>{
      document.body.style.overflow=previousOverflow;
      document.removeEventListener("keydown",onKeyDown);
    };
  },[open,onClose,closeDisabled]);

  if(!open)return null;

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!closeDisabled)onClose?.()}}>
    <section className="admin-modal-shell" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title" style={{maxWidth}} onMouseDown={e=>e.stopPropagation()}>
      <header className="admin-modal-header">
        <div className="admin-modal-heading">
          <h3 id="admin-modal-title">{title}</h3>
          {subtitle&&<p>{subtitle}</p>}
        </div>
        {headerActions&&<div className="admin-modal-header-actions">{headerActions}</div>}
        <button type="button" className="secondary admin-modal-close" onClick={()=>!closeDisabled&&onClose?.()} disabled={closeDisabled} aria-label="Close">×</button>
      </header>
      <div className={"admin-modal-body "+bodyClassName}>{children}</div>
      {footer&&<footer className="admin-modal-footer">{footer}</footer>}
    </section>
  </div>;
}
