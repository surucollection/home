import React, { useState } from "react";
import { StatusBar, Text, View, Pressable } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StoreProvider, useStore } from "./src/StoreContext";
import HomeScreen from "./src/screens/HomeScreen";
import ShopScreen from "./src/screens/ShopScreen";
import ProductScreen from "./src/screens/ProductScreen";
import CartScreen from "./src/screens/CartScreen";
import AccountScreen from "./src/screens/AccountScreen";
import AuthScreen from "./src/screens/AuthScreen";
import CheckoutScreen from "./src/screens/CheckoutScreen";
import OrdersScreen from "./src/screens/OrdersScreen";
import { TopBar, Notice } from "./src/components/UI";
import { colors } from "./src/theme";

function Application() {
  const [route, setRoute] = useState({ name: "home", params: {} });
  const { cartCount, catalogError, refreshCatalog } = useStore();
  const navigate = (name, params = {}) => setRoute({ name, params });
  const goBack = () => {
    if (route.name === "product") return navigate("shop");
    if (route.name === "checkout") return navigate("cart");
    if (route.name === "auth") return navigate("account");
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
    case "auth":
      screen = <AuthScreen goBack={goBack} onDone={() => navigate("account")} />;
      break;
    case "orders":
      screen = <OrdersScreen goBack={goBack} navigate={navigate} />;
      break;
    case "checkout":
      screen = <CheckoutScreen goBack={goBack} onComplete={(next) => navigate(next === "orders" ? "orders" : "home")} />;
      break;
    default:
      screen = <HomeScreen navigate={navigate} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <TopBar
        title={route.name === "product" ? "Product details" : route.name === "checkout" ? "Checkout" : route.name === "orders" ? "My orders" : undefined}
        onBack={tabsVisible ? undefined : goBack}
        onCart={route.name !== "cart" ? () => navigate("cart") : undefined}
        cartCount={cartCount}
      />
      {!!catalogError && <Pressable onPress={() => refreshCatalog().catch(() => {})}><Notice tone="error">Catalogue refresh issue: {catalogError}. Tap here to retry.</Notice></Pressable>}
      <View style={{ flex: 1 }}>{screen}</View>
      {tabsVisible && <View style={styles.tabBar}>
        {[
          ["home", "Home", "⌂"],
          ["shop", "Shop", "◇"],
          ["cart", "Bag", "▱"],
          ["account", "Account", "○"]
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
  tabIcon: { fontSize: 19, color: colors.muted, lineHeight: 22 },
  tabLabel: { fontSize: 9, color: colors.muted, fontWeight: "700", marginTop: 2 },
  tabActive: { color: colors.primary }
};