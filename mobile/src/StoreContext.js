import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./lib/supabase";

const StoreContext = createContext(null);
const CART_KEY = "suru.mobile.cart.v1";

const imageSort = (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0);

export function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [cart, setCart] = useState([]);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [cartReady, setCartReady] = useState(false);

  const refreshCatalog = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingCatalog(true);
    try {
      const [productResult, imageResult, sizeResult] = await Promise.all([
        supabase
          .from("products")
          .select("id,product_code,name,slug,category,description,price,compare_at_price,moq,fabric,color,pattern,is_active,is_featured,preorder_enabled,updated_at,created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("product_images")
          .select("id,product_id,image_url,alt_text,sort_order,is_main,color,media_type")
          .order("sort_order", { ascending: true }),
        supabase
          .from("product_sizes")
          .select("id,product_id,size,color,stock,is_active,bust,waist,hip,shoulder,top_length,bottom_length,dupatta_length,unit,preorder_enabled")
          .eq("is_active", true)
      ]);
      if (productResult.error) throw productResult.error;
      if (imageResult.error) throw imageResult.error;
      if (sizeResult.error) throw sizeResult.error;

      const imagesByProduct = new Map();
      (imageResult.data || []).forEach((image) => {
        if (image.media_type === "video") return;
        const list = imagesByProduct.get(image.product_id) || [];
        list.push(image);
        imagesByProduct.set(image.product_id, list);
      });
      const sizesByProduct = new Map();
      (sizeResult.data || []).forEach((variant) => {
        const list = sizesByProduct.get(variant.product_id) || [];
        list.push(variant);
        sizesByProduct.set(variant.product_id, list);
      });
      const rows = (productResult.data || []).map((product) => ({
        ...product,
        images: (imagesByProduct.get(product.id) || []).sort(imageSort),
        variants: sizesByProduct.get(product.id) || []
      }));
      setProducts(rows);
      setCatalogError("");
      return rows;
    } catch (error) {
      setCatalogError(error?.message || "Unable to load the Suru Collection catalogue.");
      throw error;
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getSession();
    if (!authData?.session) {
      setProfile(null);
      return null;
    }
    const { data, error } = await supabase.rpc("my_customer_profile");
    if (error) throw error;
    setProfile(data || null);
    return data || null;
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(CART_KEY)
      .then((value) => {
        if (!active || !value) return;
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) setCart(parsed);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCartReady(true);
      });
    refreshCatalog().catch(() => {});
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession || null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [refreshCatalog]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    refreshProfile().catch((error) => {
      console.warn("Customer profile refresh failed:", error?.message || error);
    });
  }, [session?.user?.id, refreshProfile]);

  useEffect(() => {
    const channel = supabase
      .channel("suru-mobile-live-catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => refreshCatalog(true).catch(() => {}))
      .on("postgres_changes", { event: "*", schema: "public", table: "product_images" }, () => refreshCatalog(true).catch(() => {}))
      .on("postgres_changes", { event: "*", schema: "public", table: "product_sizes" }, () => refreshCatalog(true).catch(() => {}))
      .subscribe();
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshCatalog(true).catch(() => {});
    });
    return () => {
      supabase.removeChannel(channel);
      appStateSubscription.remove();
    };
  }, [refreshCatalog]);

  const persistCart = useCallback(async (next) => {
    setCart(next);
    try {
      await AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("Cart could not be saved locally:", error?.message || error);
    }
  }, []);

  const addToCart = useCallback(async (product, size = "", color = "", quantity = 1) => {
    const key = [product.id, size || "", color || ""].join("::");
    const next = [...cart];
    const existing = next.findIndex((item) =>
      [item.productId, item.size || "", item.color || ""].join("::") === key
    );
    if (existing >= 0) {
      next[existing] = {
        ...next[existing],
        quantity: Number(next[existing].quantity || 0) + Number(quantity || 1)
      };
    } else {
      next.push({
        productId: product.id,
        productCode: product.product_code,
        size: size || null,
        color: color || null,
        quantity: Math.max(1, Number(quantity || 1))
      });
    }
    await persistCart(next);
  }, [cart, persistCart]);

  const updateCartQuantity = useCallback(async (productId, size, color, quantity) => {
    const key = [productId, size || "", color || ""].join("::");
    const next = cart
      .map((item) => {
        const itemKey = [item.productId, item.size || "", item.color || ""].join("::");
        return itemKey === key ? { ...item, quantity: Math.max(0, Number(quantity || 0)) } : item;
      })
      .filter((item) => Number(item.quantity) > 0);
    await persistCart(next);
  }, [cart, persistCart]);

  const removeFromCart = useCallback(async (productId, size, color) => {
    await updateCartQuantity(productId, size, color, 0);
  }, [updateCartQuantity]);

  const clearCart = useCallback(async () => persistCart([]), [persistCart]);

  const cartItems = useMemo(() => cart.map((line) => ({
    ...line,
    product: products.find((product) => product.id === line.productId) || null
  })), [cart, products]);

  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const cartSubtotal = cartItems.reduce((sum, item) =>
    sum + Number(item.product?.price || 0) * Number(item.quantity || 0), 0
  );

  const value = {
    products,
    loadingCatalog,
    catalogError,
    refreshCatalog,
    categories: [...new Set(products.map((item) => item.category).filter(Boolean))].sort(),
    cart,
    cartItems,
    cartCount,
    cartSubtotal,
    cartReady,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    session,
    profile,
    refreshProfile,
    signOut: () => supabase.auth.signOut()
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}