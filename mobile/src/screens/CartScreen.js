import React from "react";
import { Image, Text, View } from "react-native";
import { useStore } from "../StoreContext";
import { Button, Notice, Page, SectionHeading } from "../components/UI";
import { imageUrl, money } from "../lib/format";
import { colors, radius } from "../theme";

export default function CartScreen({ navigate }) {
  const { cartItems, cartSubtotal, updateCartQuantity, removeFromCart } = useStore();
  return (
    <Page>
      <Text style={styles.eyebrow}>YOUR SELECTION</Text>
      <Text style={styles.title}>Shopping bag</Text>
      <Text style={styles.subtitle}>Review your pieces before checkout.</Text>
      {!cartItems.length ? <Notice>Your shopping bag is empty. Discover the latest Suru Collection styles.</Notice> : <>
        {cartItems.map((item) => {
          const product = item.product;
          const image = product?.images?.find((entry) => entry.is_main) || product?.images?.[0];
          return (
            <View key={[item.productId, item.size, item.color].join("::")} style={styles.item}>
              {image?.image_url ? <Image source={{ uri: imageUrl(image.image_url, 260) }} style={styles.image} /> : <View style={[styles.image, styles.placeholder]} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.code}>{product?.product_code || item.productCode}</Text>
                <Text style={styles.name}>{product?.name || "This product is no longer available"}</Text>
                {!!item.size && <Text style={styles.meta}>Size: {item.size}</Text>}
                {!!item.color && <Text style={styles.meta}>Colour: {item.color}</Text>}
                <Text style={styles.price}>{money(product?.price || 0)}</Text>
                <View style={styles.controls}>
                  <Text onPress={() => updateCartQuantity(item.productId, item.size, item.color, Number(item.quantity) - 1)} style={styles.step}>−</Text>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <Text onPress={() => updateCartQuantity(item.productId, item.size, item.color, Number(item.quantity) + 1)} style={styles.step}>＋</Text>
                  <Text onPress={() => removeFromCart(item.productId, item.size, item.color)} style={styles.remove}>Remove</Text>
                </View>
                {!product && <Notice tone="error">This item is no longer active. Remove it to continue.</Notice>}
              </View>
            </View>
          );
        })}
        <View style={styles.total}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalPrice}>{money(cartSubtotal)}</Text></View>
        <Text style={styles.note}>Delivery charges are calculated from the destination NCM branch during checkout.</Text>
        <Button title="Continue to checkout" onPress={() => navigate("checkout")} disabled={cartItems.some((item) => !item.product)} />
        <Button title="Continue shopping" secondary onPress={() => navigate("shop")} />
      </>}
    </Page>
  );
}

const styles = {
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800", marginTop: 6 },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 6, marginBottom: 16 },
  item: { flexDirection: "row", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  image: { width: 94, height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceSoft },
  placeholder: { backgroundColor: colors.surfaceSoft },
  code: { color: colors.accent, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  name: { color: colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 19, marginTop: 3 },
  meta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  price: { color: colors.primary, fontWeight: "800", fontSize: 14, marginTop: 7 },
  controls: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 12 },
  step: { color: colors.primary, fontSize: 20, fontWeight: "700" },
  qty: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  remove: { color: colors.danger, fontSize: 11, fontWeight: "700", marginLeft: 5 },
  total: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderColor: colors.border, paddingTop: 15, marginTop: 18 },
  totalLabel: { color: colors.ink, fontWeight: "700" },
  totalPrice: { color: colors.primary, fontSize: 17, fontWeight: "900" },
  note: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 8 }
};