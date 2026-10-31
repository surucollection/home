import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useStore } from "../StoreContext";
import { Page, ProductCard, SectionHeading } from "../components/UI";
import { colors, radius } from "../theme";

export default function ShopScreen({ navigate, params = {} }) {
  const { products, categories, loadingCatalog, refreshCatalog } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(params.category || "");
  const [featuredOnly, setFeaturedOnly] = useState(!!params.featured);
  const filtered = useMemo(() => products.filter((product) => {
    const term = search.trim().toLowerCase();
    const matchesText = !term || [product.name, product.product_code, product.category, product.fabric, product.color].some((v) => String(v || "").toLowerCase().includes(term));
    return matchesText && (!category || product.category === category) && (!featuredOnly || product.is_featured);
  }), [products, search, category, featuredOnly]);
  return (
    <Page scroll={false} style={{ padding: 0 }}>
      <ScrollView refreshControl={<RefreshControl refreshing={loadingCatalog} onRefresh={() => refreshCatalog(true).catch(() => {})} tintColor={colors.primary} />} contentContainerStyle={{ padding: 18, paddingBottom: 28 }}>
        <Text style={styles.eyebrow}>THE SURU EDIT</Text>
        <Text style={styles.title}>Our collection</Text>
        <Text style={styles.subtitle}>Find a style for every celebration and every day.</Text>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search products, code or fabric" placeholderTextColor={colors.muted} style={styles.search} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
          <Text onPress={() => { setCategory(""); setFeaturedOnly(false); }} style={[styles.chip, !category && !featuredOnly && styles.chipActive]}>All</Text>
          <Text onPress={() => { setCategory(""); setFeaturedOnly(true); }} style={[styles.chip, featuredOnly && styles.chipActive]}>Featured</Text>
          {categories.map((item) => <Text key={item} onPress={() => { setCategory(item); setFeaturedOnly(false); }} style={[styles.chip, category === item && styles.chipActive]}>{item}</Text>)}
        </ScrollView>
        <SectionHeading title={filtered.length + " styles"} />
        <View style={styles.grid}>{filtered.map((product) => <ProductCard key={product.id} product={product} onPress={() => navigate("product", { productId: product.id })} />)}</View>
        {!filtered.length && <Text style={styles.empty}>No products match your search.</Text>}
      </ScrollView>
    </Page>
  );
}

const styles = {
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: "800", letterSpacing: 1.8, marginTop: 8 },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 14 },
  search: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 16, height: 48, color: colors.ink, marginBottom: 12 },
  chip: { overflow: "hidden", borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border, color: colors.primary, fontSize: 11, fontWeight: "700" },
  chipActive: { backgroundColor: colors.primary, color: colors.white, borderColor: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 }
};