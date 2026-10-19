import React,{useEffect,useMemo,useState} from "react";
import { supabase, money, norm } from "../../lib/api.js";

const EDITABLE_STATUSES=new Set(["pending","confirmed","processing","packed"]);
const isNcmCancelled=order=>/(cancelled|canceled)/i.test(String(order?.ncm_status||"").trim());

function optionLabel(variant){
  const details=[variant.size,variant.color].filter(Boolean).join(" · ")||"Standard option";
  return details+" — "+Math.max(0,Number(variant.stock||0))+" available";
}

export default function AdminEditOrderModal({order,onClose,onSave,onUpdated}){
  const [items,setItems]=useState([]);
  const [variantsByItem,setVariantsByItem]=useState({});
  const [drafts,setDrafts]=useState({});
  const [reason,setReason]=useState("");
  const [extraDiscount,setExtraDiscount]=useState(String(order?.manual_discount_amount??0));
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [catalogProducts,setCatalogProducts]=useState([]);
  const [catalogVariants,setCatalogVariants]=useState([]);
  const [addLines,setAddLines]=useState([{key:1,productId:"",variantId:"",quantity:"1"}]);
  const [nextLineKey,setNextLineKey]=useState(2);
  const [expandedAddLine,setExpandedAddLine]=useState(null);
  const [deletePrompt,setDeletePrompt]=useState(false);
  const [deletePin,setDeletePin]=useState("");

  useEffect(()=>{
    if(!order)return;
    let active=true;
    setItems([]);
    setVariantsByItem({});
    setDrafts({});
    setReason("");
    setExtraDiscount(String(order?.manual_discount_amount??0));
    setError("");
    setAddLines([{key:1,productId:"",variantId:"",quantity:"1"}]);
    setNextLineKey(2);
    setExpandedAddLine(null);
    setDeletePrompt(false);
    setDeletePin("");
    setLoading(true);
    (async()=>{
      const {data:rows,error:itemsError}=await supabase
        .from("order_items")
        .select("id,order_id,product_id,product_code,product_name,size,color,quantity,unit_price,total_price,is_preorder")
        .eq("order_id",order.id)
        .order("created_at",{ascending:true});
      if(itemsError)throw itemsError;
      const [{data:products,error:productsError},{data:allVariants,error:allVariantsError}]=await Promise.all([
        supabase.from("products").select("id,product_code,name,price,is_active").eq("is_active",true).order("product_code",{ascending:true}).order("name",{ascending:true}),
        supabase.from("product_sizes").select("id,product_id,size,color,stock,is_active").eq("is_active",true).order("size",{ascending:true}).order("color",{ascending:true})
      ]);
      if(productsError)throw productsError;
      if(allVariantsError)throw allVariantsError;
      if(!active)return;
      setCatalogProducts(products||[]);
      setCatalogVariants(allVariants||[]);
      const orderItems=rows||[];
      const results=await Promise.all(orderItems.map(async item=>{
        if(!item.product_id)return {item,variants:[],error:"Product record is no longer available."};
        const {data,error:variantError}=await supabase
          .from("product_sizes")
          .select("id,product_id,size,color,stock,is_active")
          .eq("product_id",item.product_id)
          .eq("is_active",true)
          .order("size",{ascending:true})
          .order("color",{ascending:true});
        if(variantError)throw variantError;
        const variants=variantError?[]:(data||[]);
        let match=variants.find(v=>norm(v.size)===norm(item.size)&&norm(v.color)===norm(item.color));
        if(!match)match=variants.find(v=>norm(v.size)===norm(item.size)&&!String(v.color||"").trim());
        return {item,variants,error:null,selected:match?.id||""};
      }));
      if(!active)return;
      setItems(results.map(x=>({...x.item,variantError:x.error||""})));
      setVariantsByItem(Object.fromEntries(results.map(x=>[x.item.id,x.variants])));
      setDrafts(Object.fromEntries(results.map(x=>[x.item.id,x.selected||""])));
    })().catch(e=>{if(active)setError(e?.message||"Unable to load order items and available sizes.")}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[order?.id]);

  const addedItems=useMemo(()=>addLines.filter(line=>line.productId&&line.variantId&&Number(line.quantity)>0).map(line=>{
    const product=catalogProducts.find(p=>p.id===line.productId);
    const variant=catalogVariants.find(v=>v.id===line.variantId&&v.product_id===line.productId);
    return {...line,product,variant,quantity:Math.floor(Number(line.quantity)||0),lineTotal:Math.round(Number(product?.price||0))*Math.floor(Number(line.quantity)||0)};
  }),[addLines,catalogProducts,catalogVariants]);
  const addedSubtotal=addedItems.reduce((sum,line)=>sum+line.lineTotal,0);
  const subtotalPreview=Number(order?.subtotal||0)+addedSubtotal;
  const previewDiscountBase=Math.max(0,Number(order?.discount||0)-Number(order?.manual_discount_amount||0));
  const effectiveExtraDiscount=Math.min(Math.max(0,Number(extraDiscount)||0),Math.max(0,subtotalPreview-previewDiscountBase));
  const previewTotal=Math.max(0,subtotalPreview-previewDiscountBase-effectiveExtraDiscount)+Math.max(0,Number(order?.shipping_fee||0));
  const discountChanged=Math.round(effectiveExtraDiscount)!==Math.round(Number(order?.manual_discount_amount||0));

  const changedItems=useMemo(()=>items.filter(item=>{
    const selected=(variantsByItem[item.id]||[]).find(v=>v.id===drafts[item.id]);
    return selected&&(selected.size!==item.size||selected.color!==item.color);
  }),[items,variantsByItem,drafts]);

  if(!order)return null;
  const status=String(order.order_status||"").toLowerCase();
  const ncmShipmentCancelled=isNcmCancelled(order);
  const statusAllowed=EDITABLE_STATUSES.has(status)||(status==="shipped"&&ncmShipmentCancelled);
  const statusEditable=statusAllowed&&!order.inventory_released_at;
  const activeNcm=!!order.ncm_order_id&&!ncmShipmentCancelled;
  const invoiceActive=!!(order.invoice_number&&order.invoice_data)&&String(order.invoice_status||"active").toLowerCase()!=="cancelled";
  const invoiceCancelled=String(order.invoice_status||"").toLowerCase()==="cancelled";
  const invoiceGenerated=!!(order.invoice_number||order.invoice_data||order.invoice_issued_at||order.invoice_visible_at||order.invoice_cancelled_at)||invoiceCancelled;
  const blockedMessage=!statusAllowed
    ?"Size changes are available for pending, confirmed, processing, and packed orders. A shipped order can only be edited after NCM confirms shipment cancellation; delivered orders require the exchange workflow."
    :order.inventory_released_at
      ?"Inventory for this order has already been released. This order cannot be edited through this workflow."
      :"";

  const deleteOrder=async()=>{
    if(invoiceActive||invoiceCancelled){setError("Orders with generated invoices cannot be deleted.");return}
    if(!deletePin.trim()){setError("Enter the deletion PIN.");return}
    if(!window.confirm("PERMANENTLY DELETE order "+order.order_number+" and its NCM shipment history? This cannot be undone."))return;
    setError("");
    setSaving(true);
    try{
      const {data,error:deleteError}=await supabase.functions.invoke("delete-order",{body:{order_id:order.id,pin:deletePin}});
      if(deleteError)throw deleteError;
      if(data?.error)throw new Error(data.error);
      if(!data?.success)throw new Error("The order could not be deleted.");
      if(onUpdated)await onUpdated();
      onClose();
    }catch(e){
      setError(e?.message||"Unable to delete this order.");
    }finally{setSaving(false)}
  };

  const removeOrderItem=async item=>{
    if(!statusEditable){setError(blockedMessage);return}
    if(!reason.trim()||reason.trim().length<3){setError("Enter a reason for removing this product (at least 3 characters).");return}
    if(item.is_preorder){setError("Pre-order items cannot be removed through this stocked-order workflow.");return}
    if(items.length<=1){setError("An order must contain at least one product. Cancel the order instead if it should have no items.");return}
    const confirmed=window.confirm(
      "Remove "+item.product_name+" ("+[item.size,item.color].filter(Boolean).join(" · ")+", qty "+item.quantity+") from order "+order.order_number+"?\n\nIts stock will be returned, order totals and the active invoice will be recalculated. This does not automatically refund any payment. Unsaved size/colour or discount changes will not be saved."
    );
    if(!confirmed)return;
    setError("");
    setSaving(true);
    try{
      const {data,error:removeError}=await supabase.rpc("admin_remove_order_item",{
        p_order_id:order.id,
        p_order_item_id:item.id,
        p_reason:reason.trim()
      });
      if(removeError)throw removeError;
      if(!data?.success)throw new Error(data?.message||"The product could not be removed.");
      if(onUpdated)await onUpdated();
      onClose();
    }catch(e){
      setError(e?.message||"Unable to remove this product from the order.");
    }finally{
      setSaving(false);
    }
  };

  const submit=async event=>{
    event.preventDefault();
    setError("");
    if(!statusEditable){setError(blockedMessage);return}
    if(!reason.trim()||reason.trim().length<3){setError("Please enter a reason for the change (at least 3 characters).");return}
    if(!changedItems.length&&!discountChanged&&!addedItems.length){setError("Change a size/colour, add a product, or enter an extra discount before saving.");return}
    if(changedItems.length>1){setError("For safety, change one existing item per save. Added products can be included with that change.");return}
    if(addLines.some(line=>(line.productId||line.variantId)&&(!line.productId||!line.variantId||!Number.isInteger(Number(line.quantity))||Number(line.quantity)<1||Number(line.quantity)>100))){setError("Complete each added product row and use a quantity from 1 to 100.");return}
    const unavailableAdd=addedItems.find(line=>!line.product||!line.variant||Number(line.variant.stock||0)<line.quantity);
    if(unavailableAdd){setError("A selected product option is no longer available in the requested quantity. Refresh the order and try again.");return}
    const invalid=changedItems.find(item=>{
      const variants=variantsByItem[item.id]||[];
      const chosen=variants.find(v=>v.id===drafts[item.id]);
      const oldVariant=variants.find(v=>norm(v.size)===norm(item.size)&&norm(v.color)===norm(item.color))
        ||variants.find(v=>norm(v.size)===norm(item.size)&&!String(v.color||"").trim());
      return !chosen||item.is_preorder||(oldVariant?.id!==chosen.id&&Number(chosen.stock||0)<Number(item.quantity||0));
    });
    if(invalid){
      setError(invalid.is_preorder
        ?"Pre-order items cannot be changed through this stocked-order workflow."
        :"The selected option does not have enough available stock for this order quantity.");
      return;
    }
    if(activeNcm&&!window.confirm(
      "An NCM shipment already exists for this order. Saving will update the order and its active invoice, but will NOT modify or cancel the existing NCM shipment. NCM may continue to show the original package details.\n\nTo send NCM the new size, cancel the current NCM shipment first and create a replacement after saving. Continue without changing the shipment?"
    ))return;
    if(!window.confirm("Save the order changes for "+order.order_number+"? Added products will be reserved from stock, order totals and the active invoice will be updated, and payment history and the order number will be preserved."))return;

    setSaving(true);
    try{
      for(const item of changedItems){
        await onSave({
          orderId:order.id,
          orderItemId:item.id,
          newVariantId:drafts[item.id],
          reason:reason.trim()
        });
      }
      if(addedItems.length){
        const {error:addError}=await supabase.rpc("admin_add_products_to_order",{
          p_order_id:order.id,
          p_items:addedItems.map(line=>({product_id:line.productId,variant_id:line.variantId,quantity:line.quantity})),
          p_manual_discount_amount:effectiveExtraDiscount,
          p_reason:reason.trim()
        });
        if(addError)throw addError;
      }else if(discountChanged){
        const {error:discountError}=await supabase.rpc("admin_update_order_extra_discount",{
          p_order_id:order.id,
          p_manual_discount_amount:effectiveExtraDiscount,
          p_reason:reason.trim()
        });
        if(discountError)throw discountError;
      }
      if(onUpdated)await onUpdated();
      onClose();
    }catch(e){
      setError(e?.message||"Unable to save the order change.");
    }finally{
      setSaving(false);
    }
  };

  return <div className="modal-backdrop admin-edit-order-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!saving)onClose()}}>
    <section className="modal-card admin-edit-order-modal" role="dialog" aria-modal="true" aria-labelledby="admin-edit-order-title">
      <div className="page-title">
        <div>
          <h2 id="admin-edit-order-title">Edit Order / Change Size</h2>
          <p>Order {order.order_number} · {order.customer_name||"Customer"}</p>
        </div>
        <button className="secondary" type="button" disabled={saving} onClick={onClose}>Close</button>
      </div>

      {ncmShipmentCancelled&&<div className="admin-edit-order-notice" role="note"><strong>The previous NCM shipment is marked cancelled locally.</strong><p>Save the new size/colour first, then create a replacement shipment if needed. The new package will use the updated order item details. The original NCM shipment record is archived for reference.</p></div>}
      {activeNcm&&<div className="admin-edit-order-notice warning" role="note">
        <strong>NCM shipment #{order.ncm_order_id} will remain unchanged.</strong>
        <p>This edit will not call NCM, cancel the shipment, or update its package text. If NCM must receive the new size, cancel this shipment using the existing NCM action and create a replacement after saving.</p>
      </div>}
      {invoiceActive?<div className="admin-edit-order-notice" role="note">
        <strong>Invoice {order.invoice_number} will be updated in place.</strong>
        <p>The invoice number and issue date stay the same. Saved size/colour details and any extra discount will update the invoice totals; payment history remains unchanged.</p>
      </div>:invoiceCancelled?<div className="admin-edit-order-notice warning" role="note">
        <strong>The current invoice is cancelled.</strong>
        <p>Its archived copy will remain unchanged. This edit will not reactivate or rewrite a cancelled invoice.</p>
      </div>:<div className="admin-edit-order-notice" role="note">
        <strong>No active invoice found.</strong>
      </div>}

      {blockedMessage&&<div className="message error" role="alert">{blockedMessage}</div>}
      {loading?<div className="product-loading">Loading order items and available options…</div>:error&&!items.length?<div className="message error" role="alert">{error}</div>:!items.length?<div className="message error">No items were found for this order.</div>:<form className="admin-form" onSubmit={submit}>
        {changedItems.length>1&&<div className="message">For safety, save one item change at a time. After saving, reopen this order to edit another item.</div>}
        <div className="admin-edit-order-items">
          {items.map(item=>{
            const variants=variantsByItem[item.id]||[];
            const selected=variants.find(v=>v.id===drafts[item.id]);
            const itemBlocked=!!item.is_preorder||!!item.variantError||!variants.length;
            const hasLineChange=!!selected&&(selected.size!==item.size||selected.color!==item.color);
            return <article className="admin-edit-order-item" key={item.id}>
              <div className="admin-edit-order-item-head">
                <div><strong>{item.product_name}</strong><small>{item.product_code} · Qty {item.quantity} · {money(item.unit_price)} each</small></div>
                {item.is_preorder&&<span className="badge inactive">Pre-order</span>}
              </div>
              <div className="admin-edit-order-current">
                <span>Current option</span>
                <strong>{[item.size,item.color].filter(Boolean).join(" · ")||"Standard"}</strong>
              </div>
              {itemBlocked?<p className="small-note">{item.variantError|| (item.is_preorder?"Pre-order items are not supported by this stocked-order size-change workflow.":"No active size/colour options are available.")}</p>:<>
                <div className="admin-edit-order-size-row"><label className="field">New size / colour
                  <select value={drafts[item.id]||""} onChange={e=>setDrafts(prev=>({...prev,[item.id]:e.target.value}))} disabled={!statusEditable||saving} required>
                    <option value="" disabled>Select an option</option>
                    {variants.map(v=>{
                      const oldVariant=variants.find(x=>norm(x.size)===norm(item.size)&&norm(x.color)===norm(item.color))
                        ||variants.find(x=>norm(x.size)===norm(item.size)&&!String(x.color||"").trim());
                      const available=Number(v.stock||0);
                      const blocked=oldVariant?.id!==v.id&&available<Number(item.quantity||0);
                      return <option key={v.id} value={v.id} disabled={blocked}>{optionLabel(v)}{blocked?" — Not enough stock":""}</option>;
                    })}
                  </select>
                </label><button className="secondary admin-edit-order-remove-inline" type="button" disabled={!statusEditable||saving||items.length<=1||item.is_preorder} onClick={()=>removeOrderItem(item)}>Remove product</button></div>
                {hasLineChange&&<p className="admin-edit-order-stock-hint">After saving, {item.quantity} item(s) will be released from the previous option and reserved from the new option.</p>}
              </>}
            </article>;
          })}
        </div>
        <section className="admin-edit-order-notice">
          <strong>Add products to this order</strong>
          <div className="admin-edit-order-items">
            {addLines.map((line,index)=>{
              const product=catalogProducts.find(p=>p.id===line.productId);
              const variants=catalogVariants.filter(v=>v.product_id===line.productId);
              const variant=catalogVariants.find(v=>v.id===line.variantId&&v.product_id===line.productId);
              const expanded=expandedAddLine===line.key;
              const summary=[product?.name,variant?[variant.size,variant.color].filter(Boolean).join(" · "):null,line.productId?"Qty "+(line.quantity||"1"):null].filter(Boolean).join(" · ");
              return <article className={"admin-edit-order-item admin-edit-order-added-item"+(expanded?" is-expanded":" is-collapsed")} key={line.key}>
                <div className="admin-edit-order-item-head admin-edit-order-added-head">
                  <div className="admin-edit-order-add-toggle-copy"><strong>New product {index+1}</strong><small>{expanded?(line.productId?money(product?.price||0)+" each":"Select product details"):(summary||"Tap “Add another product” to open this form")}</small></div>
                  {addLines.length>1&&<button className="secondary" type="button" disabled={saving} onClick={()=>{setAddLines(prev=>prev.filter(x=>x.key!==line.key));if(expandedAddLine===line.key)setExpandedAddLine(null)}}>Remove</button>}
                </div>
                {expanded&&<div className="admin-edit-order-add-fields">
                  <label className="field">Product
                    <select value={line.productId} disabled={!statusEditable||saving} onChange={e=>setAddLines(prev=>prev.map(x=>x.key===line.key?{...x,productId:e.target.value,variantId:""}:x))}>
                      <option value="">Select product</option>
                      {catalogProducts.map(p=><option key={p.id} value={p.id}>{p.product_code} · {p.name} — {money(p.price)}</option>)}
                    </select>
                  </label>
                  <label className="field">Size / colour
                    <select value={line.variantId} disabled={!statusEditable||saving||!line.productId} onChange={e=>setAddLines(prev=>prev.map(x=>x.key===line.key?{...x,variantId:e.target.value}:x))}>
                      <option value="">Select available option</option>
                      {variants.map(v=><option key={v.id} value={v.id} disabled={Number(v.stock||0)<1}>{optionLabel(v)}</option>)}
                    </select>
                  </label>
                  <label className="field">Quantity
                    <input type="number" min="1" max="100" step="1" value={line.quantity} disabled={!statusEditable||saving} onChange={e=>setAddLines(prev=>prev.map(x=>x.key===line.key?{...x,quantity:e.target.value}:x))}/>
                  </label>
                  {variant&&<p className="small-note">Line total: {money(Math.round(Number(product?.price||0))*Math.max(0,Math.floor(Number(line.quantity)||0)))} · {Math.max(0,Number(variant.stock||0))} currently available</p>}
                </div>}
              </article>;
            })}
          </div>
          <button className="secondary" type="button" disabled={!statusEditable||saving} onClick={()=>{const key=nextLineKey;setAddLines(prev=>[...prev,{key,productId:"",variantId:"",quantity:"1"}]);setNextLineKey(v=>v+1);setExpandedAddLine(key)}}>+ Add another product</button>
          <p><strong>Added products subtotal: {money(addedSubtotal)}</strong></p>
        </section>
        <section className="admin-edit-order-notice">
          <strong>Order price summary</strong>
          <p>Current subtotal: {money(order.subtotal)} · Added products: {money(addedSubtotal)} · Current discount: {money(order.discount)} · Delivery: {money(order.shipping_fee)}</p>
          <label className="field">Extra Discount Amount
            <input type="number" min="0" step="1" value={extraDiscount} onChange={e=>setExtraDiscount(e.target.value)} disabled={!statusEditable||saving}/>
          </label>
          <p>Extra discount applied: − {money(effectiveExtraDiscount)}</p>
          <p><strong>New order total: {money(previewTotal)}</strong></p>
        </section>
        <label className="field">Reason for change <span className="optional-label">(required for audit)</span>
          <textarea rows="2" maxLength={500} minLength={3} value={reason} onChange={e=>setReason(e.target.value)} required placeholder="e.g. Customer requested a size exchange"/>
        </label>
        {error&&<div className="message error" role="alert">{error}</div>}
        <div className="admin-edit-order-footer">
          <button className="secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button>
          <button className="primary" type="submit" disabled={saving||loading||!statusEditable}>
            {saving?"Saving…":"Save Order Changes"}
          </button>
        </div>
      </form>}
    </section>
  </div>;
}
