import React from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useStore } from "../StoreContext";
import { Page, ProductCard, SectionHeading, Button } from "../components/UI";
import { colors, radius } from "../theme";

export default function HomeScreen({ navigate }) {
  const { products, categories, loadingCatalog, refreshCatalog, cartCount } = useStore();
  const featured = products.filter((item) => item.is_featured).slice(0, 8);
  const latest = [...products].slice(0, 8);
  return (
    <Page scroll={false} style={{ padding: 0 }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loadingCatalog} onRefresh={() => refreshCatalog(true).catch(() => {})} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 18, paddingBottom: 24 }}
      >
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>WELCOME TO SURU COLLECTION</Text>
          <Text style={styles.heroTitle}>More Than Fashion.{"\n"}<Text style={{ fontStyle: "italic", color: "#e6b9aa" }}>It’s a Feeling.</Text></Text>
          <Text style={styles.heroText}>Thoughtfully selected traditional and ethnic wear for the moments that matter.</Text>
          <Pressable onPress={() => navigate("shop")} style={styles.heroButton}><Text style={styles.heroButtonText}>Explore the collection  →</Text></Pressable>
        </View>

        <SectionHeading eyebrow="DISCOVER YOUR STYLE" title="Shop by collection" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingBottom: 2 }}>
          {categories.map((category) => (
            <Pressable key={category} onPress={() => navigate("shop", { category })} style={styles.categoryChip}>
              <Text style={styles.categoryText}>{category}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {!!featured.length && <SectionHeading eyebrow="HANDPICKED FOR YOU" title="Featured products" action="View all" onAction={() => navigate("shop", { featured: true })} />}
        <View style={styles.grid}>{featured.map((product) => <ProductCard key={product.id} product={product} onPress={() => navigate("product", { productId: product.id })} />)}</View>

        <SectionHeading eyebrow="JUST ARRIVED" title="Recently added" action="Shop all" onAction={() => navigate("shop")} />
        <View style={styles.grid}>{latest.map((product) => <ProductCard key={product.id} product={product} onPress={() => navigate("product", { productId: product.id })} />)}</View>
        {!products.length && !loadingCatalog && <Text style={styles.emptyText}>The collection is being refreshed. Pull down to try again.</Text>}
        <Button title={"Open shopping bag" + (cartCount ? " (" + cartCount + ")" : "")} secondary onPress={() => navigate("cart")} />
      </ScrollView>
    </Page>
  );
}

const styles = {
  hero: { backgroundColor: colors.primaryDark, borderRadius: radius.lg, padding: 22, minHeight: 250, justifyContent: "center", overflow: "hidden" },
  heroEyebrow: { color: "#e1b6a8", fontSize: 9, letterSpacing: 2, fontWeight: "800", marginBottom: 12 },
  heroTitle: { color: colors.white, fontFamily: "serif", fontSize: 31, lineHeight: 37, fontWeight: "700" },
  heroText: { color: "#f1ded6", lineHeight: 21, fontSize: 13, marginTop: 12, maxWidth: 290 },
  heroButton: { alignSelf: "flex-start", backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 11, marginTop: 18 },
  heroButtonText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  categoryChip: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 10, borderRadius: radius.pill },
  categoryText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 3 },
  emptyText: { color: colors.muted, textAlign: "center", marginTop: 20 }
};