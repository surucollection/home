export async function createBrandedPaymentQr({qrImage,orderNumber,reference,amount,purpose="COD delivery advance"}) {
  const qr = await loadImage(qrImage);
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1120;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to prepare branded QR image.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.fillStyle = "#741d3b";
  ctx.fillRect(0,0,canvas.width,16);
  try {
    const logo = await loadImage("/assets/suru-logo-official.png");
    // Preserve the source logo's aspect ratio; never stretch the artwork.
    const maxLogoWidth = 138;
    const maxLogoHeight = 112;
    const scale = Math.min(maxLogoWidth / logo.naturalWidth, maxLogoHeight / logo.naturalHeight);
    const logoWidth = logo.naturalWidth * scale;
    const logoHeight = logo.naturalHeight * scale;
    ctx.drawImage(logo, 36 + (maxLogoWidth - logoWidth) / 2, 32 + (maxLogoHeight - logoHeight) / 2, logoWidth, logoHeight);
  } catch {}
  ctx.fillStyle = "#741d3b";
  ctx.font = "bold 42px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SURU COLLECTION",178,82);
  ctx.fillStyle = "#6d5b61";
  ctx.font = "24px Arial, sans-serif";
  ctx.fillText("Fonepay payment",180,120);

  ctx.fillStyle = "#f8eff2";
  roundRect(ctx,38,158,824,130,22);
  ctx.fillStyle = "#6d1838";
  ctx.font = "24px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PAYMENT AMOUNT",450,198);
  ctx.font = "bold 48px Arial, sans-serif";
  const amountText = String(amount ?? "0").replace(/^\s*NPR\s*/i, "").trim();
  ctx.fillText("NPR " + amountText,450,252);

  // Keep the QR fully inside its frame with consistent white quiet-zone
  // margins, and keep the scan instruction clear of the QR border.
  ctx.strokeStyle = "#eadde2";
  ctx.lineWidth = 2;
  roundRect(ctx,80,318,740,560,24,false,true);
  const qrSize = 500;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr,200,338,qrSize,qrSize);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "#6d5b61";
  ctx.font = "22px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Scan with a supported banking app",450,918);

  ctx.textAlign = "left";
  ctx.fillStyle = "#2f2529";
  ctx.font = "bold 23px Arial, sans-serif";
  ctx.fillText("Order number",52,970);
  ctx.font = "23px Arial, sans-serif";
  ctx.fillText(fitText(ctx,String(orderNumber||"—"),590),310,970);
  ctx.font = "bold 23px Arial, sans-serif";
  ctx.fillText("Reference",52,1015);
  ctx.font = "23px Arial, sans-serif";
  ctx.fillText(fitText(ctx,String(reference||"—"),590),310,1015);
  ctx.font = "bold 23px Arial, sans-serif";
  ctx.fillText("Payment for",52,1060);
  ctx.font = "23px Arial, sans-serif";
  ctx.fillText(fitText(ctx,String(purpose||"Payment"),590),310,1060);
  ctx.fillStyle = "#741d3b";
  ctx.fillRect(0,1104,canvas.width,16);
  return canvas.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve,reject)=>{
    const image = new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("Unable to load QR image."));
    image.src=src;
  });
}
function roundRect(ctx,x,y,w,h,r,fill=true,stroke=false) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill)ctx.fill();
  if(stroke)ctx.stroke();
}
function fitText(ctx,text,maxWidth) {
  let value=text;
  while(value.length>4&&ctx.measureText(value).width>maxWidth)value=value.slice(0,-2)+"…";
  return value;
}
