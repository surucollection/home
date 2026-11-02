import React, { useEffect, useMemo, useState } from "react";
import { Image, PanResponder, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";
import { useStore } from "../StoreContext";
import { Button, Notice, Page } from "../components/UI";
import { imageUrl, money } from "../lib/format";
import { colors, radius } from "../theme";

const norm = (value) => String(value ?? "").trim().toLowerCase();
const EMPTY_VARIANTS = [];

function ProductVideo({ uri }) {
  const player = useVideoPlayer(uri, (instance) => {
    // Match the website's muted looping product preview, with native controls available.
    instance.muted = true;
    instance.loop = true;
    instance.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.heroImage}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function ProductScreen({ productId, navigate, goBack }) {
  const insets = useSafeAreaInsets();
  const { products, session, cartItems, wishlist, wishlistReady, toggleWishlist, addToCart, buyNow: replaceCartWithProduct } = useStore();
  const product = products.find((item) => item.id === productId);
  const isWishlisted = Boolean(product && wishlist.includes(product.id));
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [mainMedia, setMainMedia] = useState("");

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

  useEffect(() => {
    setSize("");
    setColor("");
    setQuantity(1);
    setMainMedia("");
    setMessage("");
  }, [productId]);

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
  const selectedColor = color || product?.color || "";
  const alreadyInCart = Boolean(product && cartItems.some((item) => item.productId === product.id && norm(item.size) === norm(size) && norm(item.color) === norm(selectedColor)));
  const showPreorderAction = Boolean(product?.preorder_enabled && (
    !selectionComplete || !variants.length || !matching.length || stock <= 0
  ));

  // Product images and videos share the same ordered product_images collection.
  // Colour-specific media takes precedence; otherwise shared media remains visible.
  const allMedia = useMemo(
    () => (product?.images || []).filter((item) =>
      item.image_url && String(item.image_url).trim()
    ),
    [product?.images]
  );
  const galleryMedia = useMemo(() => {
    const specific = color
      ? allMedia.filter((item) => norm(item.color) === norm(color))
      : [];
    if (specific.length) return specific;

    const shared = allMedia.filter((item) => !String(item.color || "").trim());
    return shared.length ? shared : allMedia;
  }, [allMedia, color]);

  useEffect(() => {
    if (!galleryMedia.length) {
      if (mainMedia) setMainMedia("");
      return;
    }
    if (!galleryMedia.some((item) => item.image_url === mainMedia)) {
      const preferred = galleryMedia.find((item) => item.is_main && item.media_type !== "video") ||
        galleryMedia.find((item) => item.media_type !== "video") ||
        galleryMedia[0];
      setMainMedia(preferred.image_url);
    }
  }, [galleryMedia, mainMedia]);

  const currentMedia =
    galleryMedia.find((item) => item.image_url === mainMedia) ||
    galleryMedia.find((item) => item.is_main && item.media_type !== "video") ||
    galleryMedia[0] ||
    null;
  const currentMediaIndex = currentMedia
    ? galleryMedia.findIndex((item) => item.image_url === currentMedia.image_url)
    : -1;
  const currentIsVideo = currentMedia?.media_type === "video";
  const videoPoster = galleryMedia.find((item) => item.media_type !== "video") || galleryMedia[0] || null;

  // Horizontal swipes change the main product image. Vertical movement remains
  // available to the surrounding ScrollView, and videos keep their native controls.
  const gallerySwipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      !currentIsVideo &&
      galleryMedia.length > 1 &&
      Math.abs(gesture.dx) > 18 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) < 45 || !galleryMedia.length) return;
      const nextIndex = Math.max(
        0,
        Math.min(galleryMedia.length - 1, currentMediaIndex + (gesture.dx < 0 ? 1 : -1))
      );
      if (nextIndex !== currentMediaIndex) {
        setMainMedia(galleryMedia[nextIndex].image_url);
      }
    }
  }), [currentIsVideo, galleryMedia, currentMediaIndex]);

  if (!product) {
    return <Page><Text style={styles.title}>Product not available</Text><Button title="Go back" onPress={goBack} /></Page>;
  }

  function validateSelection() {
    if (variantRequired && !selectionComplete) {
      setMessage("Please choose the available colour and size first.");
      return false;
    }
    if (variants.length && (!matching.length || stock <= 0)) {
      setMessage(product.preorder_enabled
        ? "This option is available for pre-order on suru.com.np."
        : "The selected colour and size are currently out of stock.");
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

  async function toggleFavorite() {
    if (!product) return;
    const saved = await toggleWishlist(product.id);
    setMessage(saved ? "Added to your wishlist." : "Removed from your wishlist.");
  }

  async function shareProduct() {
    if (!product) return;
    const url = "https://suru.com.np/product.html?code=" + encodeURIComponent(product.product_code || "");
    try {
      await Share.share({
        title: product.name,
        message: product.name + " — " + money(product.price) + "\n" + url,
        url
      });
    } catch (error) {
      setMessage(error?.message || "Unable to share this product.");
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

  function startPreorder() {
    if (!product?.preorder_enabled) {
      setMessage("Pre-orders are not enabled for this product.");
      return;
    }
    if (variantRequired && !selectionComplete) {
      setMessage("Please select a colour and size first.");
      return;
    }
    if (variants.length && matching.length && stock > 0) {
      setMessage("This option is in stock. Use Add to Cart or Buy Now instead.");
      return;
    }
    const params = { productId, size, color, quantity };
    if (!session?.user) {
      navigate("auth", { returnRoute: { name: "preorder", params } });
      return;
    }
    navigate("preorder", params);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text onPress={goBack} style={styles.back}>‹  Back to collection</Text>

        {currentMedia?.image_url ? (
          <View style={styles.galleryMainWrap} {...gallerySwipeResponder.panHandlers}>
            {currentIsVideo ? (
              <ProductVideo key={currentMedia.image_url} uri={currentMedia.image_url} />
            ) : (
              <Image
                key={currentMedia.image_url}
                source={{ uri: imageUrl(currentMedia.image_url, 1200) }}
                resizeMode="contain"
                style={styles.heroImage}
              />
            )}
            <View pointerEvents="box-none" style={styles.mediaActions}>
              <Pressable
                onPress={toggleFavorite}
                disabled={!wishlistReady}
                style={[styles.mediaAction, !wishlistReady && { opacity: 0.55 }]}
                accessibilityRole="button"
                accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Text style={styles.mediaActionIcon}>{isWishlisted ? "❤️" : "🤍"}</Text>
              </Pressable>
              <Pressable
                onPress={shareProduct}
                style={styles.mediaAction}
                accessibilityRole="button"
                accessibilityLabel="Share product"
              >
                <Text style={styles.shareActionIcon}>➤</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.heroImage, styles.noImage]}>
            <Text style={styles.noImageText}>Suru Collection</Text>
          </View>
        )}

        {galleryMedia.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailList}
          >
            {galleryMedia.map((item, index) => {
              const selected = item.image_url === currentMedia?.image_url;
              const video = item.media_type === "video";
              return (
                <Pressable
                  key={item.id || item.image_url || index}
                  onPress={() => setMainMedia(item.image_url)}
                  style={[styles.thumbnail, selected && styles.thumbnailSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={video ? "Play product video" : "View product image " + (index + 1)}
                >
                  {video ? (
                    <View style={styles.videoThumbnail}>
                      {!!videoPoster?.image_url && (
                        <Image
                          source={{ uri: imageUrl(videoPoster.image_url, 220) }}
                          resizeMode="cover"
                          style={styles.videoThumbnailImage}
                        />
                      )}
                      <View style={styles.videoThumbnailShade}>
                        <View style={styles.videoPlayCircle}>
                          <Text style={styles.videoPlay}>▶</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: imageUrl(item.image_url, 220) }}
                      resizeMode="cover"
                      style={styles.thumbnailImage}
                    />
                  )}
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

        {!!product.description && <Text style={styles.description}>{product.description}</Text>}
        {!!product.category && <Text style={styles.category}>{product.category}</Text>}
        {!!product.fabric && <Text style={styles.meta}>Fabric: {product.fabric}</Text>}
        {!!product.pattern && <Text style={styles.meta}>Pattern: {product.pattern}</Text>}

        {variantRequired && (
          <Text style={styles.stock}>Available stock for this selection: {stock}</Text>
        )}
        {!!product.preorder_enabled && showPreorderAction && (
          <Notice>This option can be pre-ordered directly in the Suru Collection app using Fonepay.</Notice>
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
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {showPreorderAction ? (
          <Button
            title="Pre-order"
            onPress={startPreorder}
            style={styles.actionButtonFull}
            disabled={variantRequired && !selectionComplete}
          />
        ) : (
          <>
            <Button
              title={alreadyInCart ? "View Cart" : "Add to Cart"}
              secondary
              onPress={alreadyInCart ? () => navigate("cart") : add}
              style={styles.actionButton}
              disabled={variantRequired && (!selectionComplete || (variants.length > 0 && stock <= 0))}
            />
            <Button
              title="Buy Now"
              onPress={buyNow}
              style={styles.actionButton}
              disabled={variantRequired && (!selectionComplete || (variants.length > 0 && stock <= 0))}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 22 },
  back: { color: colors.primary, fontWeight: "700", marginBottom: 12 },
  galleryMainWrap: { width: "100%", height: 390, borderRadius: radius.lg, backgroundColor: colors.surfaceSoft, overflow: "hidden", position: "relative" },
  mediaActions: { position: "absolute", top: 13, right: 13, alignItems: "center", gap: 10 },
  mediaAction: { width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(90,63,57,0.12)" },
  mediaActionIcon: { fontSize: 22 },
  shareActionIcon: { fontSize: 21, color: colors.primary, transform: [{ rotate: "-35deg" }] },
  heroImage: { width: "100%", height: 390, borderRadius: radius.lg, backgroundColor: "#161616" },
  noImage: { justifyContent: "center", alignItems: "center" },
  noImageText: { color: colors.accent, fontFamily: "serif", fontSize: 28 },
  thumbnailList: { gap: 9, paddingVertical: 11 },
  thumbnail: { width: 68, height: 86, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 2, overflow: "hidden", backgroundColor: colors.surface },
  thumbnailSelected: { borderWidth: 2, borderColor: colors.primary },
  thumbnailImage: { width: "100%", height: "100%", borderRadius: 7, backgroundColor: colors.surfaceSoft },
  videoThumbnail: { flex: 1, borderRadius: 7, overflow: "hidden", backgroundColor: colors.surfaceSoft },
  videoThumbnailImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  videoThumbnailShade: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(35,22,20,0.28)" },
  videoPlayCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(59,35,32,0.82)", alignItems: "center", justifyContent: "center" },
  videoPlay: { color: colors.white, fontSize: 17, fontWeight: "900", marginLeft: 2 },
  code: { color: colors.accent, fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginTop: 10 },
  title: { color: colors.ink, fontSize: 25, fontWeight: "800", lineHeight: 31, marginTop: 5 },
  priceLine: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 9 },
  price: { color: colors.primary, fontWeight: "900", fontSize: 20 },
  oldPrice: { color: colors.muted, fontSize: 13, textDecorationLine: "line-through" },
  category: { color: colors.muted, fontSize: 12, marginTop: 13 },
  description: { color: colors.ink, lineHeight: 22, fontSize: 14, marginTop: 18 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 7 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: 17, marginBottom: 9 },
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
  bottomBar: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingHorizontal: 18, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  actionButton: { width: "48%", flexGrow: 0, flexShrink: 0, marginTop: 0, paddingHorizontal: 6 },
  actionButtonFull: { width: "100%", marginTop: 0 }
};
