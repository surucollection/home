import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, StatusBar, Text, View, Pressable } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StoreProvider, useStore } from "./src/StoreContext";
import HomeScreen from "./src/screens/HomeScreen";
import ShopScreen from "./src/screens/ShopScreen";
import ProductScreen from "./src/screens/ProductScreen";
import CartScreen from "./src/screens/CartScreen";
import AccountScreen from "./src/screens/AccountScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import AddressesScreen from "./src/screens/AddressesScreen";
import SecurityScreen from "./src/screens/SecurityScreen";
import AuthScreen from "./src/screens/AuthScreen";
import CheckoutScreen from "./src/screens/CheckoutScreen";
import PreorderScreen from "./src/screens/PreorderScreen";
import OrdersScreen from "./src/screens/OrdersScreen";
import WishlistScreen from "./src/screens/WishlistScreen";
import WebsiteScreen from "./src/screens/WebsiteScreen";
import { TopBar, Notice } from "./src/components/UI";
import { colors } from "./src/theme";

function productCodeFromUrl(rawUrl) {
  const raw = String(rawUrl || "");
  if (!raw) return "";
  const query = raw.match(/[?&]code=([^&#]+)/i);
  if (query?.[1]) {
    try { return decodeURIComponent(query[1]).trim().toUpperCase(); }
    catch { return query[1].trim().toUpperCase(); }
  }
  const share = raw.match(/\/share\/([A-Za-z0-9_-]{1,40})(?:\/|[?#]|$)/i);
  if (share?.[1]) return share[1].toUpperCase();
  const schemePath = raw.match(/^suru:\/\/product\/([A-Za-z0-9_-]{1,40})(?:[/?#]|$)/i);
  if (schemePath?.[1]) return schemePath[1].toUpperCase();
  return "";
}

function Application() {
  const [route, setRoute] = useState({ name: "home", params: {} });
  const cartReturnRoute = useRef(null);
  const { cartCount, wishlistCount, catalogError, refreshCatalog, products } = useStore();
  const lastHandledDeepLink = useRef("");
  const handleDeepLink = useCallback(async (url) => {
    const raw = String(url || "");
    if (!raw || lastHandledDeepLink.current === raw) return;
    const code = productCodeFromUrl(raw);
    if (!code) return;
    lastHandledDeepLink.current = raw;
    let match = products.find((item) => String(item.product_code || "").toUpperCase() === code);
    if (!match) {
      try {
        const refreshed = await refreshCatalog(true);
        match = (refreshed || []).find((item) => String(item.product_code || "").toUpperCase() === code);
      } catch (error) {
        console.warn("Could not refresh products for incoming share link:", error?.message || error);
      }
    }
    if (match?.id) {
      setRoute({ name: "product", params: { productId: match.id } });
    } else {
      setRoute({ name: "shop", params: { search: code } });
    }
  }, [products, refreshCatalog]);

  useEffect(() => {
    let active = true;
    Linking.getInitialURL().then((url) => {
      if (active && url) void handleDeepLink(url);
    }).catch((error) => console.warn("Could not read the initial app link:", error?.message || error));
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleDeepLink(url);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [handleDeepLink]);
  const wishlistReturnRoute = useRef(null);
  const navigate = (name, params = {}) => {
    if (name === "cart" && route.name !== "cart" && route.name !== "checkout") cartReturnRoute.current = { name: route.name, params: route.params || {} };
    if (name === "wishlist" && route.name !== "wishlist") wishlistReturnRoute.current = { name: route.name, params: route.params || {} };
    setRoute({ name, params });
  };
  const goBack = () => {
    if (route.name === "cart") {
      const previous = cartReturnRoute.current;
      cartReturnRoute.current = null;
      return previous?.name ? navigate(previous.name, previous.params || {}) : navigate("shop");
    }
    if (route.name === "wishlist") {
      const previous = wishlistReturnRoute.current;
      wishlistReturnRoute.current = null;
      return previous?.name ? navigate(previous.name, previous.params || {}) : navigate("account");
    }
    if (route.name === "profile" || route.name === "addresses" || route.name === "security" || route.name === "website") return navigate("account");
    if (route.name === "product") return navigate("shop");
    if (route.name === "checkout") return navigate("cart");
    if (route.name === "preorder") return navigate("product", { productId: route.params.productId });
    if (route.name === "auth") {
      const target = route.params?.returnRoute;
      return target?.name ? navigate(target.name, target.params || {}) : navigate("account");
    }
    if (route.name === "orders") return navigate("account");
    navigate("home");
  };
  const tabsVisible = ["home", "shop", "cart", "account"].includes(route.name);

  let screen;
  switch (route.name) {
    case "shop":
      screen = <ShopScreen navigate={navigate} params={route.params} />;
      break;
    case "product":
      screen = <ProductScreen productId={route.params.productId} initialColor={route.params.initialColor || ""} navigate={navigate} goBack={goBack} />;
      break;
    case "cart":
      screen = <CartScreen navigate={navigate} />;
      break;
    case "wishlist":
      screen = <WishlistScreen navigate={navigate} />;
      break;
    case "website":
      screen = <WebsiteScreen title={route.params.title} url={route.params.url} />;
      break;
    case "account":
      screen = <AccountScreen navigate={navigate} />;
      break;
    case "profile": screen = <ProfileScreen goBack={goBack} />; break;
    case "addresses": screen = <AddressesScreen goBack={goBack} />; break;
    case "security": screen = <SecurityScreen goBack={goBack} />; break;
    case "auth":
      screen = <AuthScreen goBack={goBack} onDone={() => {
        const target = route.params?.returnRoute;
        navigate(target?.name || "account", target?.params || {});
      }} />;
      break;
    case "orders":
      screen = <OrdersScreen goBack={goBack} navigate={navigate} />;
      break;
    case "checkout":
      screen = <CheckoutScreen goBack={goBack} onComplete={(next) => navigate(next === "orders" ? "orders" : "home")} />;
      break;
    case "preorder":
      screen = <PreorderScreen
        productId={route.params.productId}
        size={route.params.size}
        color={route.params.color}
        quantity={route.params.quantity}
        navigate={navigate}
        goBack={goBack}
      />;
      break;
    default:
      screen = <HomeScreen navigate={navigate} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <TopBar
        title={route.name === "website" ? route.params.title : route.name === "product" ? "Product details" : route.name === "cart" ? "Your Cart" : route.name === "wishlist" ? "My Wishlist" : route.name === "checkout" ? "Checkout" : route.name === "preorder" ? "Pre-order" : route.name === "orders" ? "My orders" : route.name === "profile" ? "Personal details" : route.name === "addresses" ? "Saved addresses" : route.name === "security" ? "Sign-in & security" : undefined}
        onBack={route.name === "cart" || route.name === "wishlist" || !tabsVisible ? goBack : undefined}
        onWishlist={route.name !== "wishlist" ? () => navigate("wishlist") : undefined}
        onCart={route.name !== "cart" ? () => navigate("cart") : undefined}
        wishlistCount={wishlistCount}
        cartCount={cartCount}
      />
      {!!catalogError && <Pressable onPress={() => refreshCatalog().catch(() => {})}><Notice tone="error">Catalogue refresh issue: {catalogError}. Tap here to retry.</Notice></Pressable>}
      <View style={{ flex: 1 }}>{screen}</View>
      {tabsVisible && <View style={styles.tabBar}>
        {[
          ["home", "Home", "🏠"],
          ["shop", "Shop", "🛍️"],
          ["cart", "Cart", "🛒"],
          ["account", "Account", "👤"]
        ].map(([name, label, icon]) => {
          const active = route.name === name;
          return <Pressable key={name} onPress={() => navigate(name)} style={styles.tab}>
            <Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text>
            <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}{name === "cart" && cartCount ? " " + cartCount : ""}</Text>
          </Pressable>;
        })}
      </View>}
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><StoreProvider><Application /></StoreProvider></SafeAreaProvider>;
}

const styles = {
  tabBar: { flexDirection: "row", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, paddingBottom: 5 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  tabIcon: { fontSize: 22, color: colors.muted, lineHeight: 27 },
  tabLabel: { fontSize: 9, color: colors.muted, fontWeight: "700", marginTop: 2 },
  tabActive: { color: colors.primary }
};