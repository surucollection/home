import React,{useEffect,useMemo,useState} from "react";
import AdminModal from "./AdminModal.jsx";
import {supabase,money} from "../../lib/api.js";
import {NEPAL_PROVINCES,provinceDistricts,canonicalProvince,getNcmBranches,matchNcmBranch,normalizeNepalPhone} from "../../lib/appShared.js";

const SOURCE_OPTIONS=[
  ["whatsapp","WhatsApp"],
  ["instagram","Instagram"],
  ["facebook","Facebook"],
  ["tiktok","TikTok"],
  ["phone","Phone"],
  ["admin","Admin"],
  ["other","Other"]
];

const emptyAddress={
  label:"Home",
  full_name:"",
  phone:"",
  address:"",
  city:"",
  district:"",
  province:"",
  postal_code:"",
  is_default:false,
  ncm_destination_branch:""
};

const emptyLine=()=>({
  productId:"",
  size:"",
  color:"",
  qty:"1",
  isPreorder:false
});

const cleanText=v=>String(v??"").trim();

export default function AdminCreateOrderModal({open,onClose,onCreated}){
  const [mode,setMode]=useState("existing");
  const [customers,setCustomers]=useState([]);
  const [customerSearch,setCustomerSearch]=useState("");
  const [selectedCustomer,setSelectedCustomer]=useState(null);
  const [addresses,setAddresses]=useState([]);
  const [addressMode,setAddressMode]=useState("new");
  const [addressId,setAddressId]=useState("");
  const [customerDraft,setCustomerDraft]=useState({name:"",phone:"",email:"",first_name:"",last_name:""});
  const [addressDraft,setAddressDraft]=useState({...emptyAddress});
  const [products,setProducts]=useState([]);
  const [lines,setLines]=useState([emptyLine()]);
  const [source,setSource]=useState("whatsapp");
  const [paymentMethod,setPaymentMethod]=useState("cod");
  const [amountPaid,setAmountPaid]=useState("0");
  const [paymentReference,setPaymentReference]=useState("");
  const [balanceMethod,setBalanceMethod]=useState("cod");
  const [couponCode,setCouponCode]=useState("");
  const [customerNote,setCustomerNote]=useState("");
  const [branches,setBranches]=useState([]);
  const [branchManual,setBranchManual]=useState(false);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [created,setCreated]=useState(null);
  const [copied,setCopied]=useState(false);

  const activeProducts=useMemo(()=>products.filter(p=>p.is_active!==false),[products]);
  const filteredCustomers=useMemo(()=>{
    const q=cleanText(customerSearch).toLowerCase();
    if(!q)return customers.slice(0,8);
    return customers.filter(c=>[c.name,c.phone,c.email,c.city,c.district].filter(Boolean).join(" ").toLowerCase().includes(q)).slice(0,8);
  },[customers,customerSearch]);

  const selectedAddress=useMemo(()=>addresses.find(a=>a.id===addressId)||null,[addresses,addressId]);

  const updateCustomerDraft=(patch)=>{
    setCustomerDraft(prev=>({...prev,...patch}));
  };

  const updateAddressDraft=(patch)=>{
    setAddressDraft(prev=>({...prev,...patch}));
    if(Object.prototype.hasOwnProperty.call(patch,"ncm_destination_branch"))setBranchManual(true);
  };

  const applyBranchMatch=(draft,force=false)=>{
    if(!force&&branchManual)return;
    const province=canonicalProvince(draft.province);
    const matched=matchNcmBranch(branches,draft.city,draft.district,null,province);
    if(matched){
      setAddressDraft(prev=>({...prev,province:province||prev.province,ncm_destination_branch:matched}));
      setBranchManual(false);
    }
  };

  const loadCustomers=async()=>{
    const {data,error:e}=await supabase.rpc("admin_list_customers");
    if(e)throw e;
    setCustomers(data||[]);
  };

  const loadProducts=async()=>{
    const {data,error:e}=await supabase
      .from("products")
      .select("id,product_code,name,price,preorder_enabled,preorder_advance_percent,is_active,product_sizes(id,size,color,stock,is_active,preorder_enabled,preorder_advance_percent)")
      .eq("is_active",true)
      .order("product_code");
    if(e)throw e;
    setProducts((data||[]).map(p=>({...p,product_sizes:(p.product_sizes||[]).filter(s=>s.is_active!==false)})));
  };

  const loadBranches=async()=>{
    try{
      const data=await getNcmBranches();
      setBranches(Array.isArray(data)?data:[]);
    }catch{}
  };

  useEffect(()=>{
    if(!open)return;
    let active=true;
    setError("");
    setCreated(null);
    setCopied(false);
    setMode("existing");
    setCustomerSearch("");
    setSelectedCustomer(null);
    setAddresses([]);
    setAddressMode("new");
    setAddressId("");
    setCustomerDraft({name:"",phone:"",email:"",first_name:"",last_name:""});
    setAddressDraft({...emptyAddress});
    setLines([emptyLine()]);
    setSource("whatsapp");
    setPaymentMethod("cod");
    setAmountPaid("0");
    setPaymentReference("");
    setBalanceMethod("cod");
    setCouponCode("");
    setCustomerNote("");
    setBranchManual(false);
    setLoading(true);
    Promise.all([loadCustomers(),loadProducts(),loadBranches()])
      .catch(e=>{if(active)setError(e?.message||"Unable to load order data.")})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[open]);

  useEffect(()=>{
    if(!selectedAddress)return;
    const province=canonicalProvince(selectedAddress.province);
    setCustomerDraft(prev=>({
      ...prev,
      name:selectedAddress.full_name||prev.name,
      phone:selectedAddress.phone||prev.phone
    }));
    setAddressDraft({
      label:selectedAddress.label||"Home",
      full_name:selectedAddress.full_name||"",
      phone:selectedAddress.phone||"",
      address:selectedAddress.address||"",
      city:selectedAddress.city||"",
      district:selectedAddress.district||"",
      province,
      postal_code:selectedAddress.postal_code||"",
      is_default:!!selectedAddress.is_default,
      ncm_destination_branch:selectedCustomer?.ncm_destination_branch||""
    });
    setBranchManual(!!selectedCustomer?.ncm_destination_branch);
  },[selectedAddress,selectedCustomer]);

  const selectExistingCustomer=async customer=>{
    setError("");
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name||customer.phone||"");
    setCustomerDraft({
      name:customer.name||"",
      phone:customer.phone||"",
      email:customer.email||"",
      first_name:customer.first_name||"",
      last_name:customer.last_name||""
    });
    try{
      const {data,error:e}=await supabase
        .from("customer_addresses")
        .select("id,label,full_name,phone,address,city,district,province,postal_code,is_default,created_at,updated_at")
        .eq("customer_id",customer.id)
        .order("is_default",{ascending:false})
        .order("updated_at",{ascending:false});
      if(e)throw e;
      const rows=data||[];
      setAddresses(rows);
      const defaultRow=rows.find(a=>a.is_default)||rows[0];
      if(defaultRow){
        setAddressMode("saved");
        setAddressId(defaultRow.id);
      }else{
        setAddressMode("new");
        setAddressId("");
        setAddressDraft({
          ...emptyAddress,
          full_name:customer.name||"",
          phone:customer.phone||"",
          ncm_destination_branch:customer.ncm_destination_branch||""
        });
        setBranchManual(!!customer.ncm_destination_branch);
      }
    }catch(e){
      setError("Customer selected, but saved addresses could not be loaded: "+(e?.message||"Unable to load addresses."));
      setAddresses([]);
      setAddressMode("new");
      setAddressId("");
      setAddressDraft({
        ...emptyAddress,
        full_name:customer.name||"",
        phone:customer.phone||"",
        ncm_destination_branch:customer.ncm_destination_branch||""
      });
      setBranchManual(!!customer.ncm_destination_branch);
    }
  };

  const startNewCustomer=()=>{
    setMode("new");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setAddresses([]);
    setAddressMode("new");
    setAddressId("");
    setCustomerDraft({name:"",phone:"",email:"",first_name:"",last_name:""});
    setAddressDraft({...emptyAddress});
    setBranchManual(false);
    setError("");
  };

  const changeAddressMode=next=>{
    setAddressMode(next);
    setError("");
    if(next==="saved"){
      const first=addresses.find(a=>a.is_default)||addresses[0];
      if(first)setAddressId(first.id);
    }else{
      setAddressId("");
      setAddressDraft({
        ...emptyAddress,
        full_name:customerDraft.name||selectedCustomer?.name||"",
        phone:customerDraft.phone||selectedCustomer?.phone||"",
        ncm_destination_branch:!branchManual?(selectedCustomer?.ncm_destination_branch||""):addressDraft.ncm_destination_branch
      });
    }
  };

  const selectSavedAddress=id=>{
    setAddressId(id);
    if(!id){changeAddressMode("new");return}
    setAddressMode("saved");
    setBranchManual(false);
  };

  const variantsForLine=line=>{
    const p=activeProducts.find(x=>x.id===line.productId);
    return p?.product_sizes||[];
  };

  const getLineVariant=(line,strict=true)=>{
    const variants=variantsForLine(line);
    if(!variants.length)return null;
    if(line.size||line.color){
      const exact=variants.find(v=>cleanText(v.size).toUpperCase()===cleanText(line.size).toUpperCase()&&cleanText(v.color).toUpperCase()===cleanText(line.color).toUpperCase());
      if(exact)return exact;
      const sizeOnly=variants.find(v=>cleanText(v.size).toUpperCase()===cleanText(line.size).toUpperCase()&&!v.color);
      if(sizeOnly&&line.size)return sizeOnly;
      const colorOnly=variants.find(v=>cleanText(v.color).toUpperCase()===cleanText(line.color).toUpperCase()&&!v.size);
      if(colorOnly&&line.color)return colorOnly;
    }
    return strict?null:variants.length===1?variants[0]:null;
  };

  const lineProduct=line=>activeProducts.find(p=>p.id===line.productId)||null;
  const lineTotal=line=>{
    const p=lineProduct(line);
    return p?Math.round(Number(p.price||0)*Math.max(1,Number(line.qty||1))):0;
  };
  const subtotal=useMemo(()=>lines.reduce((sum,l)=>sum+lineTotal(l),0),[lines,activeProducts]);
  const estimatedPreorderDiscount=useMemo(()=>lines.reduce((sum,l)=>{
    if(!l.isPreorder)return sum;
    return sum+Math.round(lineTotal(l)*0.05);
  },0),[lines,activeProducts]);
  const estimatedTotal=Math.max(0,subtotal-estimatedPreorderDiscount);

  const lineEligibility=(line)=>{
    const p=lineProduct(line),v=getLineVariant(line,false),qty=Math.max(1,Number(line.qty||1));
    if(!p||!v)return {canPreorder:false,stock:null,message:"Select product options"};
    const stock=Number(v.stock||0);
    const enabled=!!(v.preorder_enabled??p.preorder_enabled);
    if(stock>=qty)return {canPreorder:false,stock,enabled,message:"In stock"};
    if(enabled)return {canPreorder:true,stock,enabled,message:"Preorder available"};
    return {canPreorder:false,stock,enabled,message:"Insufficient stock"};
  };

  const updateLine=(index,patch)=>{
    setLines(prev=>prev.map((line,i)=>{
      if(i!==index)return line;
      const next={...line,...patch};
      if(Object.prototype.hasOwnProperty.call(patch,"productId")){
        const p=activeProducts.find(x=>x.id===patch.productId);
        const variants=p?.product_sizes||[];
        const sizes=[...new Set(variants.map(v=>cleanText(v.size)).filter(Boolean))];
        const colors=[...new Set(variants.map(v=>cleanText(v.color)).filter(Boolean))];
        next.size=sizes.length===1?sizes[0]:"";
        next.color=colors.length===1?colors[0]:"";
        next.isPreorder=false;
      }
      const eligibility=lineEligibility(next);
      if(eligibility.canPreorder&&Number(next.qty||1)>Number(eligibility.stock||0))next.isPreorder=true;
      if(Number(next.qty||1)<=Number(eligibility.stock||0))next.isPreorder=false;
      return next;
    }));
  };

  const addLine=()=>setLines(prev=>[...prev,emptyLine()]);
  const removeLine=i=>setLines(prev=>prev.length===1?prev.map((x,j)=>j===0?emptyLine():x):prev.filter((_,j)=>j!==i));

  const buildConfirmation=(data)=>{
    const itemText=lines.map(l=>{
      const p=lineProduct(l);
      return `• ${p?.name||"Product"}${[l.size,l.color].filter(Boolean).length?" ("+[l.size,l.color].filter(Boolean).join(" / ")+")":""} × ${l.qty}`;
    }).join("\n");
    const location=[addressDraft.city,addressDraft.district,addressDraft.province,addressDraft.postal_code].filter(Boolean).join(", ");
    const paid=Number(data?.amount_paid||0);
    const due=Number(data?.balance_due||0);
    return `Suru Collection
Order #${data?.order_number||"—"}
Customer: ${customerDraft.name||addressDraft.full_name||"—"}
Phone: ${customerDraft.phone||addressDraft.phone||"—"}

${itemText}

Total: ${money(data?.total||estimatedTotal)}
Paid now: ${money(paid)}
Balance due: ${money(due)}
Payment: ${String(paymentMethod).toUpperCase()}
Source: ${SOURCE_OPTIONS.find(x=>x[0]===source)?.[1]||source}
Delivery: ${[addressDraft.address,location].filter(Boolean).join(", ")}

Thank you for ordering from Suru Collection.`;
  };

  const submit=async e=>{
    e?.preventDefault();
    if(saving)return;
    setError("");
    const name=cleanText(customerDraft.name)||cleanText(addressDraft.full_name);
    const phone=cleanText(customerDraft.phone)||cleanText(addressDraft.phone);
    if(!name||!phone||!cleanText(addressDraft.address)||!cleanText(addressDraft.city)){
      setError("Please enter customer name, phone, full address and city.");
      return;
    }
    if(!cleanText(addressDraft.province)||!cleanText(addressDraft.district)){
      setError("Please select province first, then district.");
      return;
    }
    if(mode==="existing"&&!selectedCustomer){
      setError("Select an existing customer or choose New Customer.");
      return;
    }
    if(addressMode==="saved"&&!selectedAddress){
      setError("Select a saved address or choose New Address.");
      return;
    }
    const cleanLines=lines.map(l=>{
      const p=lineProduct(l),v=getLineVariant(l,false);
      return {...l,product:p,variant:v,qty:Math.max(1,parseInt(l.qty||"1",10))};
    });
    for(const l of cleanLines){
      if(!l.product||!l.variant){
        setError("Complete the product and variant selection for every item.");
        return;
      }
      const eligibility=lineEligibility(l);
      if(l.isPreorder){
        if(!eligibility.canPreorder){
          setError(`Preorder is not available for ${l.product.name} with the selected option.`);
          return;
        }
      }else if(Number(eligibility.stock||0)<l.qty){
        setError(`Only ${eligibility.stock||0} item(s) available for ${l.product.name}. Enable Preorder for this line when it is eligible.`);
        return;
      }
    }
    const paid=Math.max(0,Number(amountPaid||0));
    if(!Number.isFinite(paid))return setError("Enter a valid amount paid.");
    if(paid>Math.max(0,estimatedTotal)+1000000)return setError("Amount paid is invalid.");
    if(paymentMethod==="cod"&&!cleanText(addressDraft.ncm_destination_branch)){
      setError("Select an NCM destination branch for COD orders.");
      return;
    }
    if(mode==="new"&&!cleanText(customerDraft.email)&&cleanText(addressDraft.email))customerDraft.email=addressDraft.email;
    setSaving(true);
    try{
      const payload={
        name,
        first_name:cleanText(customerDraft.first_name)||null,
        last_name:cleanText(customerDraft.last_name)||null,
        phone:normalizeNepalPhone(phone),
        email:cleanText(customerDraft.email)||null,
        address:cleanText(addressDraft.address),
        city:cleanText(addressDraft.city),
        district:cleanText(addressDraft.district),
        province:canonicalProvince(addressDraft.province),
        postal_code:cleanText(addressDraft.postal_code)||null,
        ncm_destination_branch:cleanText(addressDraft.ncm_destination_branch)||null
      };
      const args={
        p_customer_id:mode==="existing"?selectedCustomer.id:null,
        p_customer:payload,
        p_items:cleanLines.map(l=>({
          code:l.product.product_code,
          size:cleanText(l.variant.size)||null,
          color:cleanText(l.variant.color)||null,
          qty:l.qty,
          is_preorder:!!l.isPreorder
        })),
        p_payment_method:paymentMethod,
        p_customer_note:cleanText(customerNote)||null,
        p_coupon_code:cleanText(couponCode)||null,
        p_order_source:source,
        p_save_address:addressMode==="new",
        p_address_label:cleanText(addressDraft.label)||"Home",
        p_address_is_default:addressMode==="new"&&!!addressDraft.is_default,
        p_amount_paid:paid,
        p_payment_reference:cleanText(paymentReference)||null,
        p_preorder_balance_method:balanceMethod
      };
      const {data,error:e}=await supabase.rpc("admin_create_order",args);
      if(e)throw e;
      if(!data?.success)throw Error("Order creation returned no success response.");
      const result={...data,confirmation:buildConfirmation(data)};
      setCreated(result);
      await onCreated?.(data);
    }catch(e){
      setError(e?.message||"Unable to create order.");
    }finally{
      setSaving(false);
    }
  };

  const copyConfirmation=async()=>{
    if(!created?.confirmation)return;
    try{
      await navigator.clipboard.writeText(created.confirmation);
      setCopied(true);
      setTimeout(()=>setCopied(false),2500);
    }catch{
      setError("Could not copy the confirmation text on this device.");
    }
  };

  const modalFooter=created
    ? <div className="admin-create-order-footer"><button type="button" className="secondary" onClick={copyConfirmation}>{copied?"Copied":"Copy Customer Message"}</button><button type="button" className="primary" onClick={onClose}>Done</button></div>
    : <div className="admin-create-order-footer"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="primary" onClick={submit} disabled={saving||loading}>{saving?"Creating Order…":"Create Order"}</button></div>;

  return <AdminModal
    open={open}
    onClose={onClose}
    closeDisabled={saving}
    title={created?"Order Created":"Create Order for Customer"}
    subtitle={created?"The order is now in the normal Suru Collection Orders list.":"Create a normal order for a social-media, phone or walk-in customer without requiring a website login."}
    maxWidth="1080px"
    footer={modalFooter}
  >
    {created
      ? <div className="admin-create-order-success">
          <div className="admin-create-order-success-icon">✓</div>
          <h3>Order #{created.order_number} created</h3>
          <p>{created.preorder?"Pre-order advance handling is included.":"The order has been added to the normal order workflow."}</p>
          <div className="admin-create-order-confirmation"><pre>{created.confirmation}</pre></div>
          {created.advance_required>0&&<div className="message">Advance required: <b>{money(created.advance_required)}</b> · Paid now: <b>{money(created.amount_paid||0)}</b> · Balance due: <b>{money(created.balance_due||0)}</b></div>}
        </div>
      : <form onSubmit={submit} className="admin-create-order-form">
          {error&&<div className="message error" role="alert">{error}</div>}
          {loading
            ? <div className="card"><p>Loading customers, products and delivery branches…</p></div>
            : <>
              <section className="admin-create-order-section">
                <div className="admin-create-order-section-title"><div><h4>1. Customer</h4><p>No website account is required for a new customer.</p></div><div className="admin-create-order-toggle"><button type="button" className={mode==="existing"?"active":""} onClick={()=>{setMode("existing");setError("")}}>Existing Customer</button><button type="button" className={mode==="new"?"active":""} onClick={startNewCustomer}>New Customer</button></div></div>
                {mode==="existing"
                  ? <>
                      <div className="admin-create-order-customer-search"><input value={customerSearch} onChange={e=>{setCustomerSearch(e.target.value);setSelectedCustomer(null)}} placeholder="Search name, phone or email"/>{selectedCustomer&&<span className="admin-create-order-selected-customer">{selectedCustomer.name||"Customer"} · {selectedCustomer.phone||"No phone"}</span>}</div>
                      {!selectedCustomer&&<div className="admin-create-order-customer-results">{filteredCustomers.length?filteredCustomers.map(c=><button key={c.id} type="button" onClick={()=>selectExistingCustomer(c)}><b>{c.name||"—"}</b><span>{c.phone||"—"}{c.email?" · "+c.email:""}</span></button>):<span className="small-note">No matching active customer. Choose New Customer.</span>}</div>}
                    </>
                  : <div className="admin-create-order-grid admin-create-order-grid-3">
                      <label>Name *<input value={customerDraft.name} onChange={e=>updateCustomerDraft({name:e.target.value})}/></label>
                      <label>Mobile *<input value={customerDraft.phone} onChange={e=>updateCustomerDraft({phone:e.target.value})} inputMode="tel" placeholder="98XXXXXXXX"/></label>
                      <label>Email<input type="email" value={customerDraft.email} onChange={e=>updateCustomerDraft({email:e.target.value})}/></label>
                    </div>}
                {selectedCustomer&&<div className="admin-create-order-grid admin-create-order-grid-3 admin-create-order-customer-fields">
                  <label>Name *<input value={customerDraft.name} onChange={e=>updateCustomerDraft({name:e.target.value})}/></label>
                  <label>Mobile *<input value={customerDraft.phone} onChange={e=>updateCustomerDraft({phone:e.target.value})} inputMode="tel"/></label>
                  <label>Email<input type="email" value={customerDraft.email} onChange={e=>updateCustomerDraft({email:e.target.value})}/></label>
                </div>}
              </section>

              <section className="admin-create-order-section">
                <div className="admin-create-order-section-title"><div><h4>2. Delivery Address</h4><p>Province comes first, then district. NCM branch is auto-matched when possible.</p></div>{mode==="existing"&&addresses.length>0&&<div className="admin-create-order-address-toggle"><button type="button" className={addressMode==="saved"?"active":""} onClick={()=>changeAddressMode("saved")}>Saved Address</button><button type="button" className={addressMode==="new"?"active":""} onClick={()=>changeAddressMode("new")}>New Address</button></div>}</div>
                {addressMode==="saved"&&addresses.length
                  ? <div className="admin-create-order-saved-address-picker"><select value={addressId} onChange={e=>selectSavedAddress(e.target.value)}><option value="">Select saved address</option>{addresses.map(a=><option key={a.id} value={a.id}>{a.label||"Address"} — {[a.city,a.district,a.province].filter(Boolean).join(", ")}{a.is_default?" — Default":""}</option>)}</select>{selectedAddress&&<div className="admin-create-order-address-preview"><b>{selectedAddress.full_name||"—"} · {selectedAddress.phone||"—"}</b><span>{selectedAddress.address||"—"}</span><span>{[selectedAddress.city,selectedAddress.district,canonicalProvince(selectedAddress.province),selectedAddress.postal_code].filter(Boolean).join(", ")}</span></div>}</div>
                  : <>
                    <div className="admin-create-order-grid admin-create-order-grid-4">
                      <label>Label<input value={addressDraft.label} onChange={e=>updateAddressDraft({label:e.target.value})} placeholder="Home"/></label>
                      <label>Recipient Name *<input value={addressDraft.full_name} onChange={e=>updateAddressDraft({full_name:e.target.value})}/></label>
                      <label>Mobile *<input value={addressDraft.phone} onChange={e=>updateAddressDraft({phone:e.target.value})} inputMode="tel"/></label>
                      <label>Postal Code<input value={addressDraft.postal_code} onChange={e=>updateAddressDraft({postal_code:e.target.value})}/></label>
                    </div>
                    <label className="admin-create-order-full-field">Address *<textarea value={addressDraft.address} onChange={e=>updateAddressDraft({address:e.target.value})} rows="2"/></label>
                    <div className="admin-create-order-grid admin-create-order-grid-4">
                      <label>Province *<select value={canonicalProvince(addressDraft.province)} onChange={e=>{const v=e.target.value;updateAddressDraft({province:v,district:""});setTimeout(()=>applyBranchMatch({...addressDraft,province:v,district:""}),0)}}><option value="">Select province</option>{NEPAL_PROVINCES.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
                      <label>District *<select value={addressDraft.district} onChange={e=>{const v=e.target.value;updateAddressDraft({district:v});setTimeout(()=>applyBranchMatch({...addressDraft,district:v}),0)}} disabled={!addressDraft.province}><option value="">Select district</option>{provinceDistricts(canonicalProvince(addressDraft.province)).map(d=><option key={d} value={d}>{d}</option>)}</select></label>
                      <label>City / Municipality *<input value={addressDraft.city} onChange={e=>{const v=e.target.value;updateAddressDraft({city:v});setTimeout(()=>applyBranchMatch({...addressDraft,city:v}),0)}}/></label>
                      <label>NCM Destination Branch<select value={addressDraft.ncm_destination_branch} onChange={e=>updateAddressDraft({ncm_destination_branch:e.target.value})}><option value="">Select branch</option>{branches.map((b,i)=><option key={i} value={b?.name||b?.branch_name||b?.title||b?.branch||""}>{b?.name||b?.branch_name||b?.title||b?.branch||"Unnamed branch"}</option>)}</select></label>
                    </div>
                    {addressMode==="new"&&<label className="admin-create-order-check"><input type="checkbox" checked={!!addressDraft.is_default} onChange={e=>updateAddressDraft({is_default:e.target.checked})}/> Save this as the customer's default address</label>}
                    {!branches.length&&<small className="small-note">NCM branch list could not be loaded. COD orders require a destination branch.</small>}
                  </>}
              </section>

              <section className="admin-create-order-section">
                <div className="admin-create-order-section-title"><div><h4>3. Products</h4><p>Stock is checked again by the server when the order is submitted.</p></div><button type="button" className="secondary" onClick={addLine}>+ Add Product</button></div>
                <div className="admin-create-order-lines">
                  {lines.map((line,i)=>{
                    const variants=variantsForLine(line),sizes=[...new Set(variants.map(v=>cleanText(v.size)).filter(Boolean))],colors=[...new Set(variants.map(v=>cleanText(v.color)).filter(Boolean))],eligibility=lineEligibility(line);
                    return <div className="admin-create-order-line" key={i}>
                      <div className="admin-create-order-line-top"><strong>Item {i+1}</strong><button type="button" className="admin-create-order-remove" onClick={()=>removeLine(i)}>Remove</button></div>
                      <div className="admin-create-order-grid admin-create-order-grid-4">
                        <label className="admin-create-order-span-2">Product *<select value={line.productId} onChange={e=>updateLine(i,{productId:e.target.value})}><option value="">Select product</option>{activeProducts.map(p=><option key={p.id} value={p.id}>{p.product_code} — {p.name}</option>)}</select></label>
                        <label>Quantity *<input type="number" min="1" max="10000" value={line.qty} onChange={e=>updateLine(i,{qty:e.target.value})}/></label>
                        <div className="admin-create-order-line-total"><span>Line total</span><b>{money(lineTotal(line))}</b></div>
                      </div>
                      {line.productId&&<div className="admin-create-order-grid admin-create-order-grid-4">
                        {sizes.length>0&&<label>Size *<select value={line.size} onChange={e=>updateLine(i,{size:e.target.value})}><option value="">Select size</option>{sizes.map(v=><option key={v} value={v}>{v}</option>)}</select></label>}
                        {colors.length>0&&<label>Color *<select value={line.color} onChange={e=>updateLine(i,{color:e.target.value})}><option value="">Select color</option>{colors.map(v=><option key={v} value={v}>{v}</option>)}</select></label>}
                        <div className="admin-create-order-stock-status"><span>Stock</span><b>{eligibility.stock===null?"Select option":eligibility.stock}</b><small>{eligibility.message}</small></div>
                        {eligibility.canPreorder&&<label className="admin-create-order-preorder-check"><input type="checkbox" checked={!!line.isPreorder} onChange={e=>updateLine(i,{isPreorder:e.target.checked})}/> Pre-order</label>}
                      </div>}
                      {line.productId&&getLineVariant(line,false)?.size===null&&getLineVariant(line,false)?.color===null&&<div className="small-note">This product has one general stock variant.</div>}
                    </div>;
                  })}
                </div>
              </section>

              <section className="admin-create-order-section">
                <div className="admin-create-order-section-title"><div><h4>4. Payment & Order Source</h4><p>Enter any money already collected from the customer. The server calculates the final balance.</p></div></div>
                <div className="admin-create-order-grid admin-create-order-grid-4">
                  <label>Order Source<select value={source} onChange={e=>setSource(e.target.value)}>{SOURCE_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
                  <label>Payment Method<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cod">Cash on Delivery</option><option value="fonepay">Fonepay</option><option value="online">Online</option></select></label>
                  {lines.some(l=>l.isPreorder)&&<label>Pre-order Balance<select value={balanceMethod} onChange={e=>setBalanceMethod(e.target.value)}><option value="cod">Cash on Delivery</option><option value="online">Online later</option></select></label>}
                  <label>Amount Paid Now<input type="number" min="0" step="1" value={amountPaid} onChange={e=>setAmountPaid(e.target.value)}/></label>
                </div>
                <div className="admin-create-order-grid admin-create-order-grid-2">
                  <label>Payment Reference<input value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} placeholder="Fonepay ref / receipt note (optional)"/></label>
                  <label>Coupon Code<input value={couponCode} onChange={e=>setCouponCode(e.target.value)} placeholder="Optional"/></label>
                </div>
                <div className="admin-create-order-summary">
                  <div><span>Subtotal</span><b>{money(subtotal)}</b></div>
                  <div><span>Pre-order discount</span><b>− {money(estimatedPreorderDiscount)}</b></div>
                  <div className="grand"><span>Estimated total</span><b>{money(estimatedTotal)}</b></div>
                  {paymentMethod==="cod"&&<small>COD advance is calculated from the selected NCM delivery destination on the server.</small>}
                </div>
              </section>

              <section className="admin-create-order-section">
                <div className="admin-create-order-section-title"><div><h4>5. Note</h4><p>Optional internal/customer note stored on the normal order.</p></div></div>
                <textarea className="admin-create-order-note" value={customerNote} onChange={e=>setCustomerNote(e.target.value)} rows="2" placeholder="Example: Customer ordered through Instagram ad."></textarea>
              </section>

              <div className="admin-create-order-legal-note">Admin-created orders follow the same inventory, coupon, COD advance, pre-order and normal order-status rules as the website checkout. A customer account is not required.</div>
            </>}
        </form>}
  </AdminModal>;
}
