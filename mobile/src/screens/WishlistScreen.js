import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useStore } from "../StoreContext";
import { Button, Notice, Page } from "../components/UI";
import { imageUrl, money } from "../lib/format";
import { colors, radius } from "../theme";

export default function WishlistScreen({ navigate }) {
  const { wishlistItems, removeFromWishlist } = useStore();
  return <Page>
    <Text style={styles.eyebrow}>YOUR SAVED STYLES</Text>
    <Text style={styles.title}>My Wishlist</Text>
    <Text style={styles.subtitle}>The pieces you have saved for another look.</Text>
    {!wishlistItems.length ? <>
      <Notice>Your wishlist is empty. Tap the heart on a product to save it here.</Notice>
      <Button title="Explore the collection" onPress={() => navigate("shop")} />
    </> : <>
      <View style={styles.grid}>
        {wishlistItems.map((product) => {
          const images = (product.images || []).filter((item) => item.media_type !== "video");
          const image = images.find((item) => item.is_main) || images[0];
          return <View key={product.id} style={styles.card}>
            <Pressable onPress={() => navigate("product", { productId: product.id })} style={styles.productCard}>
              {image?.image_url
                ? <Image source={{ uri: imageUrl(image.image_url, 520) }} resizeMode="cover" style={styles.productImage} />
                : <View style={[styles.productImage, styles.imageFallback]}><Text style={styles.fallbackLetter}>S</Text></View>}
              <View style={styles.info}>
                <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
                <Text style={styles.category}>{product.category || "Collection"}</Text>
                <Text style={styles.price}>{money(product.price)}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => removeFromWishlist(product.id)} style={styles.remove}>
              <Text style={styles.removeText}>♥  Remove</Text>
            </Pressable>
          </View>;
        })}
      </View>
      <Button title="Continue shopping" secondary onPress={() => navigate("shop")} />
    </>}
  </Page>;
}

const styles = {
  eyebrow: { color: colors.accent, fontSize: 9, letterSpacing: 1.8, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 27, fontWeight: "800", marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: { width: "48.2%", marginBottom: 12 },
  productCard: { width: "100%", backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  productImage: { width: "100%", height: 185, backgroundColor: colors.surfaceSoft },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  fallbackLetter: { color: colors.accent, fontFamily: "serif", fontSize: 50, fontWeight: "700" },
  info: { padding: 10 },
  productName: { color: colors.ink, fontSize: 13, fontWeight: "700", minHeight: 34, lineHeight: 17 },
  category: { color: colors.muted, fontSize: 10, marginTop: 3, marginBottom: 7 },
  price: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  remove: { alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 3 },
  removeText: { color: colors.danger, fontWeight: "800", fontSize: 11 }
};
