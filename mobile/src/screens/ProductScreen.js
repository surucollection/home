import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { useStore } from "../StoreContext";
import { Button, Notice, Page } from "../components/UI";
import { imageUrl, money } from "../lib/format";
import { colors, radius } from "../theme";

export default function ProductScreen({ productId, navigate, goBack }) {
  const { products, addToCart } = useStore();
  const product = products.find((item) => item.id === productId);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const variants = product?.variants || [];
  const sizes = [...new Set(variants.map((item) => item.size).filter(Boolean))].sort();
  const colours = [...new Set(variants.map((item) => item.color).filter(Boolean))].sort();
  const matching = useMemo(() => variants.filter((item) =>
    (!size || item.size === size) && (!color || item.color === color)
  ), [variants, size, color]);
  const stock = matching.reduce((sum, item) => sum + Number(item.stock || 0), 0);
  useEffect(() => {
    if (sizes.length === 1) setSize(sizes[0]);
    if (colours.length === 1) setColor(colours[0]);
  }, [productId, sizes.length, colours.length]);
  const image = product?.images?.find((item) => item.is_main) || product?.images?.[0];
  if (!product) return <Page><Text style={styles.title}>Product not available</Text><Button title="Go back" onPress={goBack} /></Page>;
  const variantRequired = sizes.length > 0 || colours.length > 0;
  const ready = !variantRequired || (matching.length > 0 && matching.some((item) => Number(item.stock) > 0));
  async function add() {
    if (variantRequired && ((sizes.length && !size) || (colours.length && !color))) {
      setMessage("Please choose the available size and colour first.");
      return;
    }
    if (variantRequired && stock < quantity) {
      setMessage("The selected variant does not have enough stock.");
      return;
    }
    await addToCart(product, size, color, quantity);
    setMessage("Added to your shopping bag.");
  }
  return (
    <Page>
      <Text onPress={goBack} style={styles.back}>‹  Back to collection</Text>
      {image?.image_url
        ? <Image source={{ uri: imageUrl(image.image_url, 1000) }} resizeMode="cover" style={styles.heroImage} />
        : <View style={[styles.heroImage, styles.noImage]}><Text style={styles.noImageText}>Suru Collection</Text></View>}
      <Text style={styles.code}>{product.product_code}</Text>
      <Text style={styles.title}>{product.name}</Text>
      <View style={styles.priceLine}>
        <Text style={styles.price}>{money(product.price)}</Text>
        {Number(product.compare_at_price) > Number(product.price) && <Text style={styles.oldPrice}>{money(product.compare_at_price)}</Text>}
      </View>
      {!!product.category && <Text style={styles.category}>{product.category}</Text>}
      {!!product.description && <Text style={styles.description}>{product.description}</Text>}
      {!!product.fabric && <Text style={styles.meta}>Fabric: {product.fabric}</Text>}
      {!!product.pattern && <Text style={styles.meta}>Pattern: {product.pattern}</Text>}
      {!!sizes.length && <><Text style={styles.label}>Select size</Text><View style={styles.choices}>{sizes.map((item) => <Text key={item} onPress={() => { setSize(item); setMessage(""); }} style={[styles.choice, size === item && styles.choiceActive]}>{item}</Text>)}</View></>}
      {!!colours.length && <><Text style={styles.label}>Select colour</Text><View style={styles.choices}>{colours.map((item) => <Text key={item} onPress={() => { setColor(item); setMessage(""); }} style={[styles.choice, color === item && styles.choiceActive]}>{item}</Text>)}</View></>}
      {variantRequired && <Text style={styles.stock}>Available stock: {stock}</Text>}
      {!!product.preorder_enabled && stock <= 0 && <Notice>Pre-order is enabled for this item. Pre-order checkout is currently available on suru.com.np.</Notice>}
      <View style={styles.quantityRow}>
        <Text style={styles.label}>Quantity</Text>
        <View style={styles.quantityControl}>
          <Text onPress={() => setQuantity((value) => Math.max(1, value - 1))} style={styles.quantityButton}>−</Text>
          <Text style={styles.quantityText}>{quantity}</Text>
          <Text onPress={() => setQuantity((value) => Math.min(20, value + 1))} style={styles.quantityButton}>＋</Text>
        </View>
      </View>
      {!!message && <Notice tone={message.startsWith("Added") ? "success" : "error"}>{message}</Notice>}
      <Button title="Add to shopping bag" onPress={add} disabled={!ready || (variantRequired && stock <= 0)} />
      <Button title="View shopping bag" secondary onPress={() => navigate("cart")} />
    </Page>
  );
}

const styles = {
  back: { color: colors.primary, fontWeight: "700", marginBottom: 12 },
  heroImage: { width: "100%", height: 390, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft },
  noImage: { justifyContent: "center", alignItems: "center" },
  noImageText: { color: colors.accent, fontFamily: "serif", fontSize: 28 },
  code: { color: colors.accent, fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginTop: 17 },
  title: { color: colors.ink, fontSize: 25, fontWeight: "800", lineHeight: 31, marginTop: 5 },
  priceLine: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 9 },
  price: { color: colors.primary, fontWeight: "900", fontSize: 20 },
  oldPrice: { color: colors.muted, fontSize: 13, textDecorationLine: "line-through" },
  category: { color: colors.muted, fontSize: 12, marginTop: 6 },
  description: { color: colors.ink, lineHeight: 22, fontSize: 14, marginTop: 14 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 7 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 18, marginBottom: 9 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, color: colors.primary, fontWeight: "700", fontSize: 12 },
  choiceActive: { backgroundColor: colors.primary, color: colors.white, borderColor: colors.primary },
  stock: { color: colors.success, fontSize: 11, fontWeight: "700", marginTop: 8 },
  quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  quantityControl: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface },
  quantityButton: { color: colors.primary, fontSize: 20, fontWeight: "700", paddingHorizontal: 14, paddingVertical: 5 },
  quantityText: { color: colors.ink, minWidth: 20, textAlign: "center", fontWeight: "800" }
};