import React from "react";
import { Pressable, Text, View } from "react-native";
import { useStore } from "../StoreContext";
import { Button, Notice, Page, ProductCard } from "../components/UI";
import { colors } from "../theme";

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
        {wishlistItems.map((product) => <View key={product.id} style={styles.card}>
          <ProductCard product={product} onPress={() => navigate("product", { productId: product.id })} />
          <Pressable onPress={() => removeFromWishlist(product.id)} style={styles.remove}>
            <Text style={styles.removeText}>♥  Remove</Text>
          </Pressable>
        </View>)}
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
  card: { width: "48.2%", marginBottom: 10 },
  remove: { alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 3, marginTop: -8 },
  removeText: { color: colors.danger, fontWeight: "800", fontSize: 11 }
};
