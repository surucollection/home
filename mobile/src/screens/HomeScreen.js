import React from "react";
import { ImageBackground, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useStore } from "../StoreContext";
import { Page, ProductCard, SectionHeading } from "../components/UI";
import { colors, radius } from "../theme";

export default function HomeScreen({ navigate }) {
  const { products, categories, loadingCatalog, refreshCatalog } = useStore();
  const { width: windowWidth } = useWindowDimensions();
  const heroTitleSize = Math.max(19, Math.min(29, Math.round((windowWidth - 32) * 0.075)));
  const heroContentWidth = windowWidth < 360 ? "64%" : "67%";
  const featured = products.filter((item) => item.is_featured).slice(0, 8);
  const latest = [...products].slice(0, 8);
  return (
    <Page scroll={false} style={{ padding: 0 }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loadingCatalog} onRefresh={() => refreshCatalog(true).catch(() => {})} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 18, paddingBottom: 24 }}
      >
        <ImageBackground source={{ uri: "https://suru.com.np/assets/hero.jpg" }} style={styles.hero} imageStyle={styles.heroImage} resizeMode="cover">
          <View style={styles.heroShade} />
          <View style={[styles.heroContent, { width: heroContentWidth }]}>
            <Text style={styles.heroEyebrow} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>WELCOME TO SURU COLLECTION</Text>
            <Text
              style={[styles.heroTitle, { fontSize: heroTitleSize, lineHeight: Math.round(heroTitleSize * 1.16) }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
              ellipsizeMode="clip"
            >More Than Fashion.{"\n"}<Text style={{ fontStyle: "italic", color: "#e6b9aa" }}>It’s a Feeling.</Text></Text>
            <Text style={styles.heroText}>Discover thoughtfully selected traditional, stylish and ethnic wear designed to make every occasion feel special.</Text>
            <Pressable onPress={() => navigate("shop")} style={styles.heroButton}>
              <Text style={styles.heroButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Explore the collection  →</Text>
            </Pressable>
          </View>
        </ImageBackground>

        <SectionHeading eyebrow="DISCOVER YOUR STYLE" title="Shop by collection" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingBottom: 2 }}>
          {categories.map((category) => (
            <Pressable key={category} onPress={() => navigate("shop", { category })} style={styles.categoryChip}>
              <Text style={styles.categoryText}>{category}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {!!featured.length && <SectionHeading eyebrow="HANDPICKED FOR YOU" title="Featured products" action="View all" onAction={() => navigate("shop", { featured: true })} />}
        <View style={styles.grid}>{featured.map((product) => <ProductCard key={product.id} product={product} onPress={(initialColor) => navigate("product", { productId: product.id, initialColor })} />)}</View>

        <SectionHeading eyebrow="JUST ARRIVED" title="Recently added" action="Shop all" onAction={() => navigate("shop")} />
        <View style={styles.grid}>{latest.map((product) => <ProductCard key={product.id} product={product} onPress={(initialColor) => navigate("product", { productId: product.id, initialColor })} />)}</View>
        {!products.length && !loadingCatalog && <Text style={styles.emptyText}>The collection is being refreshed. Pull down to try again.</Text>}
      </ScrollView>
    </Page>
  );
}

const styles = {
  hero: { backgroundColor: colors.primaryDark, borderRadius: radius.lg, padding: 22, minHeight: 250, justifyContent: "center", overflow: "hidden" },
  heroImage: { borderRadius: radius.lg },
  heroShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(34, 18, 16, 0.48)", borderRadius: radius.lg },
  heroContent: { alignSelf: "flex-start", alignItems: "flex-start" },
  heroEyebrow: { color: "#e1b6a8", fontSize: 9, letterSpacing: 1.2, fontWeight: "800", marginBottom: 12, maxWidth: "100%" },
  heroTitle: { color: colors.white, fontFamily: "serif", fontWeight: "700", textAlign: "left", width: "100%" },
  heroText: { color: "#f1ded6", lineHeight: 18, fontSize: 12, marginTop: 10, maxWidth: "100%", textAlign: "left" },
  heroButton: { alignSelf: "flex-start", maxWidth: "100%", backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 10, marginTop: 15 },
  heroButtonText: { color: colors.primary, fontWeight: "800", fontSize: 11 },
  categoryChip: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 10, borderRadius: radius.pill },
  categoryText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 3 },
  emptyText: { color: colors.muted, textAlign: "center", marginTop: 20 }
};