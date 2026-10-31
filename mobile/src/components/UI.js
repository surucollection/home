import React from "react";
import {
  ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View
} from "react-native";
import { colors, radius } from "../theme";
import { imageUrl, money } from "../lib/format";

export function Page({ children, scroll = true, style }) {
  return scroll
    ? <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={[{ padding: 18, paddingBottom: 34 }, style]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={[{ flex: 1, backgroundColor: colors.background, padding: 18 }, style]}>{children}</View>;
}

export function TopBar({ title = "Suru Collection", onBack, onCart, cartCount = 0 }) {
  return (
    <View style={styles.topBar}>
      {onBack ? <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable> : <View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View>}
      <View style={{ flex: 1 }}>
        <Text style={styles.brandName}>{title}</Text>
        {!onBack && <Text style={styles.brandTag}>TRADITIONAL • ETHNIC • EVERYDAY</Text>}
      </View>
      {onCart && <Pressable onPress={onCart} style={styles.cartButton}><Text style={styles.cartButtonText}>Bag {cartCount ? "(" + cartCount + ")" : ""}</Text></Pressable>}
    </View>
  );
}

export function Button({ title, onPress, secondary = false, disabled = false, loading = false, style }) {
  return (
    <Pressable disabled={disabled || loading} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, (disabled || loading) && { opacity: 0.55 }, style]}>
      {loading ? <ActivityIndicator color={secondary ? colors.primary : colors.white} /> : <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, multiline, autoCapitalize = "sentences", editable = true }) {
  return (
    <View style={styles.fieldWrap}>
      {!!label && <Text style={styles.fieldLabel}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType || "default"}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        editable={editable}
        autoCapitalize={autoCapitalize}
        style={[styles.field, multiline && { minHeight: 88, textAlignVertical: "top" }, !editable && { opacity: 0.6 }]}
      />
    </View>
  );
}

export function SectionHeading({ eyebrow, title, action, onAction }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {!!action && <Pressable onPress={onAction}><Text style={styles.actionText}>{action}</Text></Pressable>}
    </View>
  );
}

export function ProductCard({ product, onPress }) {
  const image = product?.images?.find((item) => item.is_main) || product?.images?.[0];
  return (
    <Pressable onPress={onPress} style={styles.productCard}>
      {image?.image_url
        ? <Image source={{ uri: imageUrl(image.image_url, 520) }} style={styles.productImage} resizeMode="cover" />
        : <View style={[styles.productImage, styles.imageFallback]}><Text style={styles.fallbackLetter}>{String(product?.name || "S").slice(0, 1)}</Text></View>}
      {product?.is_featured && <View style={styles.featuredTag}><Text style={styles.featuredTagText}>FEATURED</Text></View>}
      <View style={styles.productInfo}>
        <Text numberOfLines={2} style={styles.productName}>{product?.name || "Suru Collection style"}</Text>
        <Text style={styles.productCategory}>{product?.category || "Collection"}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>{money(product?.price)}</Text>
          {Number(product?.compare_at_price) > Number(product?.price) && <Text style={styles.oldPrice}>{money(product.compare_at_price)}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

export function Notice({ children, tone = "info" }) {
  const background = tone === "error" ? "#fbeceb" : tone === "success" ? "#eaf5ef" : colors.surfaceSoft;
  const color = tone === "error" ? colors.danger : tone === "success" ? colors.success : colors.primary;
  return <View style={{ backgroundColor: background, borderRadius: radius.md, padding: 12, marginVertical: 8 }}><Text style={{ color, lineHeight: 20 }}>{children}</Text></View>;
}

export const uiStyles = styles;

const styles = {
  topBar: { minHeight: 66, backgroundColor: colors.background, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 11 },
  brandMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: colors.white, fontFamily: "serif", fontSize: 23, fontWeight: "700" },
  brandName: { color: colors.primaryDark, fontSize: 18, fontWeight: "800", letterSpacing: 0.2 },
  brandTag: { color: colors.muted, fontSize: 8, letterSpacing: 1.2, marginTop: 2 },
  backButton: { width: 36, height: 38, alignItems: "center", justifyContent: "center" },
  backText: { color: colors.primary, fontSize: 34, lineHeight: 36 },
  cartButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 13 },
  cartButtonText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  button: { minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.primary, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: "800", letterSpacing: 0.2 },
  buttonTextSecondary: { color: colors.primary },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  field: { minHeight: 47, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, color: colors.ink, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 22, marginBottom: 12 },
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.7, fontWeight: "800", marginBottom: 5 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  actionText: { color: colors.accent, fontSize: 12, fontWeight: "800", paddingBottom: 3 },
  productCard: { width: "48.2%", backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  productImage: { width: "100%", height: 185, backgroundColor: colors.surfaceSoft },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  fallbackLetter: { color: colors.accent, fontFamily: "serif", fontSize: 50, fontWeight: "700" },
  featuredTag: { position: "absolute", top: 9, left: 9, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  featuredTagText: { color: colors.white, fontSize: 8, fontWeight: "800", letterSpacing: 0.7 },
  productInfo: { padding: 10 },
  productName: { color: colors.ink, fontSize: 13, fontWeight: "700", minHeight: 34, lineHeight: 17 },
  productCategory: { color: colors.muted, fontSize: 10, marginTop: 3, marginBottom: 7 },
  priceRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  productPrice: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  oldPrice: { color: colors.muted, fontSize: 10, textDecorationLine: "line-through" }
};