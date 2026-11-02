import React, { useRef, useState } from "react";
import { StatusBar, Text, View, Pressable } from "react-native";
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
import { TopBar, Notice } from "./src/components/UI";
import { colors } from "./src/theme";

function Application() {
  const [route, setRoute] = useState({ name: "home", params: {} });
  const cartReturnRoute = useRef(null);
  const { cartCount, catalogError, refreshCatalog } = useStore();
  const navigate = (name, params = {}) => {
    if (name === "cart" && route.name !== "cart") cartReturnRoute.current = { name: route.name, params: route.params || {} };
    setRoute({ name, params });
  };
  const goBack = () => {
    if (route.name === "cart") {
      const previous = cartReturnRoute.current;
      cartReturnRoute.current = null;
      return previous?.name ? navigate(previous.name, previous.params || {}) : navigate("shop");
    }
    if (route.name === "profile" || route.name === "addresses" || route.name === "security") return navigate("account");
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
      screen = <ProductScreen productId={route.params.productId} navigate={navigate} goBack={goBack} />;
      break;
    case "cart":
      screen = <CartScreen navigate={navigate} />;
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <TopBar
        title={route.name === "product" ? "Product details" : route.name === "cart" ? "Your Cart" : route.name === "checkout" ? "Checkout" : route.name === "preorder" ? "Pre-order" : route.name === "orders" ? "My orders" : route.name === "profile" ? "Personal details" : route.name === "addresses" ? "Saved addresses" : route.name === "security" ? "Sign-in & security" : undefined}
        onBack={route.name === "cart" || !tabsVisible ? goBack : undefined}
        onCart={route.name !== "cart" ? () => navigate("cart") : undefined}
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