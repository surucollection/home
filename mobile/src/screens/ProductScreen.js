import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useStore } from "../StoreContext";
import { Button, Notice, Page } from "../components/UI";
import { imageUrl, money } from "../lib/format";
import { colors, radius } from "../theme";

const norm = (value) => String(value ?? "").trim().toLowerCase();
const EMPTY_VARIANTS = [];

export default function ProductScreen({ productId, navigate, goBack }) {
  const { products, addToCart, buyNow: replaceCartWithProduct } = useStore();
  const product = products.find((item) => item.id === productId);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [mainImage, setMainImage] = useState("");

  const variants = product?.variants || EMPTY_VARIANTS;
  const sizes = useMemo(
    () => [...new Set(variants.map((item) => item.size).filter(Boolean))]
      .sort((a, b) => norm(a).localeCompare(norm(b))),
    [variants]
  );
  const colours = useMemo(
    () => [...new Set(variants.map((item) => item.color).filter(Boolean))]
      .sort((a, b) => norm(a).localeCompare(norm(b))),
    [variants]
  );

  // Clear the previous product's choices when another product is opened.
  useEffect(() => {
    setSize("");
    setColor("");
    setQuantity(1);
    setMainImage("");
    setMessage("");
  }, [productId]);

  // Match the website behaviour: automatically select a sole/first available option.
  useEffect(() => {
    if (sizes.length === 1) setSize(sizes[0]);
    else if (size && !sizes.some((item) => norm(item) === norm(size))) setSize("");

    if (colours.length === 1) setColor(colours[0]);
    else if (colours.length && !colours.some((item) => norm(item) === norm(color))) setColor(colours[0]);
    else if (!colours.length && color) setColor("");
  }, [productId, sizes, colours, size, color]);

  const matching = useMemo(() => variants.filter((item) =>
    (!sizes.length || norm(item.size) === norm(size)) &&
    (!colours.length || norm(item.color) === norm(color))
  ), [variants, sizes, colours, size, color]);
  const stock = matching.reduce((sum, item) => sum + Number(item.stock || 0), 0);
  const variantRequired = sizes.length > 0 || colours.length > 0;
  const selectionComplete = (!sizes.length || !!size) && (!colours.length || !!color);

  // Show all images assigned to the selected colour. If that colour has no
  // dedicated gallery, fall back to shared images and then to the full gallery.
  const allImages = useMemo(
    () => (product?.images || []).filter((item) =>
      item.image_url && item.media_type !== "video"
    ),
    [product?.images]
  );
  const galleryImages = useMemo(() => {
    const specific = color
      ? allImages.filter((item) => norm(item.color) === norm(color))
      : [];
    if (specific.length) return specific;

    const shared = allImages.filter((item) => !String(item.color || "").trim());
    return shared.length ? shared : allImages;
  }, [allImages, color]);

  // When the selected colour changes, move to that colour's main image (or first image).
  useEffect(() => {
    if (!galleryImages.length) {
      if (mainImage) setMainImage("");
      return;
    }
    if (!galleryImages.some((item) => item.image_url === mainImage)) {
      const preferred = galleryImages.find((item) => item.is_main) || galleryImages[0];
      setMainImage(preferred.image_url);
    }
  }, [galleryImages, mainImage]);

  const currentImage =
    galleryImages.find((item) => item.image_url === mainImage) ||
    galleryImages.find((item) => item.is_main) ||
    galleryImages[0] ||
    null;
  const currentImageIndex = currentImage
    ? galleryImages.findIndex((item) => item.image_url === currentImage.image_url)
    : -1;

  if (!product) {
    return <Page><Text style={styles.title}>Product not available</Text><Button title="Go back" onPress={goBack} /></Page>;
  }

  function validateSelection() {
    if (variantRequired && !selectionComplete) {
      setMessage("Please choose the available size and colour first.");
      return false;
    }
    if (variants.length && (!matching.length || stock <= 0)) {
      setMessage(product.preorder_enabled
        ? "This option is available for pre-order on suru.com.np."
        : "The selected size and colour are currently out of stock.");
      return false;
    }
    if (variants.length && stock < quantity) {
      setMessage("Only " + stock + " item(s) are available for this option.");
      return false;
    }
    return true;
  }

  async function add() {
    if (!validateSelection()) return;
    try {
      await addToCart(product, size, color || product.color || "", quantity);
      setMessage("Added to Cart successfully.");
    } catch (error) {
      setMessage(error?.message || "Unable to add this item to your cart.");
    }
  }

  async function buyNow() {
    if (!validateSelection()) return;
    try {
      await replaceCartWithProduct(product, size, color || product.color || "", quantity);
      navigate("checkout");
    } catch (error) {
      setMessage(error?.message || "Unable to start checkout. Please try again.");
    }
  }

  return (
    <Page>
      <Text onPress={goBack} style={styles.back}>‹  Back to collection</Text>

      {currentImage?.image_url ? (
        <View style={styles.galleryMainWrap}>
          <Image
            source={{ uri: imageUrl(currentImage.image_url, 1200) }}
            resizeMode="contain"
            style={styles.heroImage}
          />
          {galleryImages.length > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>{currentImageIndex + 1} / {galleryImages.length}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.heroImage, styles.noImage]}>
          <Text style={styles.noImageText}>Suru Collection</Text>
        </View>
      )}

      {galleryImages.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailList}
        >
          {galleryImages.map((item, index) => {
            const selected = item.image_url === currentImage?.image_url;
            return (
              <Pressable
                key={item.id || item.image_url || index}
                onPress={() => setMainImage(item.image_url)}
                style={[styles.thumbnail, selected && styles.thumbnailSelected]}
                accessibilityRole="button"
                accessibilityLabel={"View product image " + (index + 1)}
              >
                <Image
                  source={{ uri: imageUrl(item.image_url, 220) }}
                  resizeMode="cover"
                  style={styles.thumbnailImage}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Text style={styles.code}>{product.product_code}</Text>
      <Text style={styles.title}>{product.name}</Text>
      <View style={styles.priceLine}>
        <Text style={styles.price}>{money(product.price)}</Text>
        {Number(product.compare_at_price) > Number(product.price) && (
          <Text style={styles.oldPrice}>{money(product.compare_at_price)}</Text>
        )}
      </View>
      {!!product.category && <Text style={styles.category}>{product.category}</Text>}
      {!!product.description && <Text style={styles.description}>{product.description}</Text>}
      {!!product.fabric && <Text style={styles.meta}>Fabric: {product.fabric}</Text>}
      {!!product.pattern && <Text style={styles.meta}>Pattern: {product.pattern}</Text>}

      {!!sizes.length && (
        <>
          <Text style={styles.label}>Select size</Text>
          <View style={styles.choices}>
            {sizes.map((item) => (
              <Pressable
                key={item}
                onPress={() => { setSize(item); setMessage(""); }}
                style={[styles.choice, size === item && styles.choiceActive]}
              >
                <Text style={[styles.choiceText, size === item && styles.choiceTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {!!colours.length && (
        <>
          <Text style={styles.label}>Select colour</Text>
          <View style={styles.choices}>
            {colours.map((item) => (
              <Pressable
                key={item}
                onPress={() => { setColor(item); setMessage(""); }}
                style={[styles.choice, norm(color) === norm(item) && styles.choiceActive]}
              >
                <Text style={[styles.choiceText, norm(color) === norm(item) && styles.choiceTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {variantRequired && <Text style={styles.stock}>Available stock for this selection: {stock}</Text>}
      {!!product.preorder_enabled && stock <= 0 && (
        <Notice>Pre-order is enabled for this item. Pre-order checkout is available on suru.com.np.</Notice>
      )}

      <View style={styles.quantityRow}>
        <Text style={styles.label}>Quantity</Text>
        <View style={styles.quantityControl}>
          <Pressable onPress={() => setQuantity((value) => Math.max(1, value - 1))} style={styles.quantityPress}>
            <Text style={styles.quantityButton}>−</Text>
          </Pressable>
          <Text style={styles.quantityText}>{quantity}</Text>
          <Pressable onPress={() => setQuantity((value) => Math.min(20, value + 1))} style={styles.quantityPress}>
            <Text style={styles.quantityButton}>＋</Text>
          </Pressable>
        </View>
      </View>

      {!!message && <Notice tone={message.startsWith("Added") ? "success" : "error"}>{message}</Notice>}

      <View style={styles.actions}>
        <Button title="Add to Cart" secondary onPress={add} style={styles.actionButton} />
        <Button title="Buy Now" onPress={buyNow} style={styles.actionButton} />
      </View>
      <Button title="View Cart" secondary onPress={() => navigate("cart")} />
    </Page>
  );
}

const styles = {
  back: { color: colors.primary, fontWeight: "700", marginBottom: 12 },
  galleryMainWrap: { width: "100%", height: 390, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft, overflow: "hidden", position: "relative" },
  heroImage: { width: "100%", height: 390, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft },
  noImage: { justifyContent: "center", alignItems: "center" },
  noImageText: { color: colors.accent, fontFamily: "serif", fontSize: 28 },
  imageCounter: { position: "absolute", right: 12, bottom: 12, borderRadius: radius.pill, backgroundColor: "rgba(48,34,31,0.76)", paddingHorizontal: 10, paddingVertical: 5 },
  imageCounterText: { color: colors.white, fontSize: 10, fontWeight: "800" },
  thumbnailList: { gap: 9, paddingVertical: 11 },
  thumbnail: { width: 68, height: 86, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 2, overflow: "hidden", backgroundColor: colors.surface },
  thumbnailSelected: { borderWidth: 2, borderColor: colors.primary },
  thumbnailImage: { width: "100%", height: "100%", borderRadius: 7, backgroundColor: colors.surfaceSoft },
  code: { color: colors.accent, fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginTop: 10 },
  title: { color: colors.ink, fontSize: 25, fontWeight: "800", lineHeight: 31, marginTop: 5 },
  priceLine: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 9 },
  price: { color: colors.primary, fontWeight: "900", fontSize: 20 },
  oldPrice: { color: colors.muted, fontSize: 13, textDecorationLine: "line-through" },
  category: { color: colors.muted, fontSize: 12, marginTop: 6 },
  description: { color: colors.ink, lineHeight: 22, fontSize: 14, marginTop: 14 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 7 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 18, marginBottom: 9 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  choiceTextActive: { color: colors.white },
  stock: { color: colors.success, fontSize: 11, fontWeight: "700", marginTop: 8 },
  quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  quantityControl: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, backgroundColor: colors.surface },
  quantityPress: { paddingHorizontal: 12, paddingVertical: 5 },
  quantityButton: { color: colors.primary, fontSize: 20, fontWeight: "700" },
  quantityText: { color: colors.ink, minWidth: 20, textAlign: "center", fontWeight: "800" },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  actionButton: { flex: 1, marginTop: 0, paddingHorizontal: 8 }
};
