import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./lib/supabase";

const StoreContext = createContext(null);
const CART_KEY = "suru.mobile.cart.v1";
const WISHLIST_KEY = "suru.mobile.wishlist.v1";
const WISHLIST_OWNER_KEY = "suru.mobile.wishlist.owner.v1";

const imageSort = (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0);

export function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [cart, setCart] = useState([]);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [cartReady, setCartReady] = useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [authReady, setAuthReady] = useState(false);
  const [wishlistReady, setWishlistReady] = useState(false);
  const currentUserIdRef = useRef(null);
  const wishlistRef = useRef([]);

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
        // Keep both image and video rows; the product gallery renders each media type natively.
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
    wishlistRef.current = wishlist;
  }, [wishlist]);

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
      const nextSession = data?.session || null;
      currentUserIdRef.current = nextSession?.user?.id || null;
      setSession(nextSession);
      setAuthReady(true);
    }).catch(() => {
      if (active) setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      const nextUserId = nextSession?.user?.id || null;
      const previousUserId = currentUserIdRef.current;
      if (previousUserId && nextUserId !== previousUserId) {
        setWishlist([]);
        wishlistRef.current = [];
        AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify([])).catch(() => {});
        AsyncStorage.setItem(WISHLIST_OWNER_KEY, "guest").catch(() => {});
      }
      currentUserIdRef.current = nextUserId;
      setSession(nextSession || null);
      setAuthReady(true);
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

  const refreshWishlist = useCallback(async ({ mergeLocal = true } = {}) => {
    const userId = session?.user?.id;
    if (!userId) return [];
    const [{ data: customer, error: customerError }, owner, legacyValue] = await Promise.all([
      supabase.from("customers").select("id").eq("auth_user_id", userId).maybeSingle(),
      AsyncStorage.getItem(WISHLIST_OWNER_KEY),
      AsyncStorage.getItem(WISHLIST_KEY)
    ]);
    if (customerError) throw customerError;
    if (!customer?.id) throw new Error("Your customer profile is not ready yet.");

    let localIds = [];
    try {
      const parsed = JSON.parse(legacyValue || "[]");
      if (Array.isArray(parsed)) localIds = parsed.filter((id) => typeof id === "string");
    } catch {
      localIds = [];
    }
    const mayMerge = mergeLocal && (!owner || owner === "guest" || owner === userId);
    if (mayMerge && localIds.length) {
      const rows = [...new Set(localIds)].map((productId) => ({
        customer_id: customer.id,
        product_id: productId
      }));
      const { error } = await supabase.from("customer_wishlist")
        .upsert(rows, { onConflict: "customer_id,product_id", ignoreDuplicates: true });
      if (error) throw error;
    }

    const { data, error } = await supabase.from("customer_wishlist")
      .select("product_id")
      .eq("customer_id", customer.id);
    if (error) throw error;
    const ids = [...new Set((data || []).map((item) => item.product_id).filter(Boolean))];
    setWishlist(ids);
    wishlistRef.current = ids;
    await Promise.all([
      AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(ids)),
      AsyncStorage.setItem(WISHLIST_OWNER_KEY, userId)
    ]);
    setWishlistReady(true);
    return ids;
  }, [session?.user?.id]);

  useEffect(() => {
    if (!authReady) return undefined;
    let active = true;
    if (!session?.user?.id) {
      AsyncStorage.getItem(WISHLIST_KEY)
        .then((value) => {
          if (!active) return;
          const parsed = JSON.parse(value || "[]");
          const ids = Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
          setWishlist(ids);
          wishlistRef.current = ids;
        })
        .catch(() => {
          if (active) {
            setWishlist([]);
            wishlistRef.current = [];
          }
        })
        .finally(() => { if (active) setWishlistReady(true); });
    } else {
      setWishlistReady(false);
      refreshWishlist().catch((error) => {
        console.warn("Account wishlist sync failed:", error?.message || error);
        if (active) setWishlistReady(true);
      });
    }
    return () => { active = false; };
  }, [authReady, session?.user?.id, refreshWishlist]);

  useEffect(() => {
    if (!authReady || !session?.user?.id) return undefined;
    let active = true;
    let channel = null;
    (async () => {
      try {
        const { data: customer, error } = await supabase.from("customers")
          .select("id").eq("auth_user_id", session.user.id).maybeSingle();
        if (error) throw error;
        if (!active || !customer?.id) return;
        channel = supabase.channel("customer-wishlist-" + customer.id)
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "customer_wishlist",
            filter: "customer_id=eq." + customer.id
          }, () => {
            refreshWishlist({ mergeLocal: false }).catch((syncError) => {
              console.warn("Live wishlist refresh failed:", syncError?.message || syncError);
            });
          })
          .subscribe();
      } catch (error) {
        console.warn("Wishlist live sync could not start:", error?.message || error);
      }
    })();
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [authReady, session?.user?.id, refreshWishlist]);

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

  const buyNow = useCallback(async (product, size = "", color = "", quantity = 1) => {
    // Replace, rather than append to, the existing cart for an immediate checkout.
    const line = {
      productId: product.id,
      productCode: product.product_code,
      size: size || null,
      color: color || null,
      quantity: Math.max(1, Number(quantity || 1))
    };
    await persistCart([line]);
  }, [persistCart]);

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

  const persistWishlist = useCallback(async (ids) => {
    setWishlist(ids);
    wishlistRef.current = ids;
    await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
    await AsyncStorage.setItem(WISHLIST_OWNER_KEY, session?.user?.id || "guest");
  }, [session?.user?.id]);

  const getWishlistCustomerId = useCallback(async () => {
    if (!session?.user?.id) return null;
    const { data, error } = await supabase.from("customers")
      .select("id").eq("auth_user_id", session.user.id).maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error("Your customer profile is not ready. Refresh your account and try again.");
    return data.id;
  }, [session?.user?.id]);

  const toggleWishlist = useCallback(async (productId) => {
    if (!productId) return false;
    const exists = wishlistRef.current.includes(productId);
    let next;
    if (session?.user?.id) {
      const customerId = await getWishlistCustomerId();
      const result = exists
        ? await supabase.from("customer_wishlist").delete().eq("customer_id", customerId).eq("product_id", productId)
        : await supabase.from("customer_wishlist").insert({ customer_id: customerId, product_id: productId });
      if (result.error) throw result.error;
      next = exists
        ? wishlistRef.current.filter((id) => id !== productId)
        : [...wishlistRef.current, productId];
    } else {
      next = exists
        ? wishlistRef.current.filter((id) => id !== productId)
        : [...wishlistRef.current, productId];
    }
    await persistWishlist(next);
    return !exists;
  }, [session?.user?.id, getWishlistCustomerId, persistWishlist]);

  const removeFromWishlist = useCallback(async (productId) => {
    if (!productId) return;
    if (session?.user?.id) {
      const customerId = await getWishlistCustomerId();
      const { error } = await supabase.from("customer_wishlist").delete()
        .eq("customer_id", customerId).eq("product_id", productId);
      if (error) throw error;
    }
    const next = wishlistRef.current.filter((id) => id !== productId);
    await persistWishlist(next);
  }, [session?.user?.id, getWishlistCustomerId, persistWishlist]);

  const wishlistItems = useMemo(() => wishlist
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean), [wishlist, products]);

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
    buyNow,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    wishlist,
    wishlistReady,
    wishlistItems,
    wishlistCount: wishlist.length,
    toggleWishlist,
    removeFromWishlist,
    session,
    profile,
    refreshProfile,
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setWishlist([]);
      wishlistRef.current = [];
      await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify([]));
      await AsyncStorage.setItem(WISHLIST_OWNER_KEY, "guest");
    }
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}