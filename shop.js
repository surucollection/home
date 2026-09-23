/* =====================================================
   SURU COLLECTION — SHOP / CART
   Browser storage + Supabase guest-cart fallback
===================================================== */

const CART_KEY = "suruCart";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

let cartMemory = [];
let cartReady = false;
let cartReadyPromise = null;
let saveTimer = null;


/* =====================================================
   SUPABASE GUEST CART
===================================================== */

function getGuestId() {
  const KEY = "suruGuestId";

  try {
    let id = localStorage.getItem(KEY);

    if (id && /^[A-Za-z0-9_-]{20,200}$/.test(id)) {
      return id;
    }
  } catch (e) {}

  try {
    let id = sessionStorage.getItem(KEY);

    if (id && /^[A-Za-z0-9_-]{20,200}$/.test(id)) {
      return id;
    }
  } catch (e) {}

  try {
    const match = document.cookie.match(
      new RegExp(
        "(?:^|; )" +
        KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "=([^;]*)"
      )
    );

    if (match && match[1]) {
      const id = decodeURIComponent(match[1]);

      if (/^[A-Za-z0-9_-]{20,200}$/.test(id)) {
        return id;
      }
    }
  } catch (e) {}

  const id =
    "suru_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2);

  try {
    localStorage.setItem(KEY, id);
  } catch (e) {}

  try {
    sessionStorage.setItem(KEY, id);
  } catch (e) {}

  try {
    document.cookie =
      KEY +
      "=" +
      encodeURIComponent(id) +
      "; path=/; max-age=" +
      COOKIE_MAX_AGE +
      "; SameSite=Lax";
  } catch (e) {}

  return id;
}


function getGuestCartUrl() {
  if (
    window.SUPABASE_URL &&
    window.SUPABASE_URL.includes("supabase.co")
  ) {
    return (
      window.SUPABASE_URL.replace(/\/$/, "") +
      "/functions/v1/guest-cart"
    );
  }

  return "https://vkycraymxhkqxgpcpdzw.supabase.co/functions/v1/guest-cart";
}


async function supabaseGuestCart(action, cart) {
  try {
    const guestId = getGuestId();

    const response = await fetch(
      getGuestCartUrl(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: action,
          guest_id: guestId,
          cart: cart
        })
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.warn(
      "Supabase guest cart unavailable:",
      error
    );

    return null;
  }
}


/* =====================================================
   COOKIE STORAGE
===================================================== */

function readCookie(name) {
  try {
    const match = document.cookie.match(
      new RegExp(
        "(?:^|; )" +
        name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "=([^;]*)"
      )
    );

    return match
      ? decodeURIComponent(match[1])
      : null;
  } catch (e) {
    return null;
  }
}


function writeCookie(name, value) {
  try {
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; path=/; max-age=" +
      COOKIE_MAX_AGE +
      "; SameSite=Lax";

    return readCookie(name) === value;
  } catch (e) {
    return false;
  }
}


/* =====================================================
   NORMAL BROWSER STORAGE
===================================================== */

function parseCart(value) {
  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {}

  return null;
}


function readStorage() {

  /* localStorage */
  try {
    const value = localStorage.getItem(CART_KEY);

    if (value) {
      const cart = parseCart(value);

      if (cart) {
        return cart;
      }
    }
  } catch (e) {}


  /* sessionStorage */
  try {
    const value = sessionStorage.getItem(CART_KEY);

    if (value) {
      const cart = parseCart(value);

      if (cart) {
        return cart;
      }
    }
  } catch (e) {}


  /* cookie */
  try {
    const value = readCookie(CART_KEY);

    if (value) {
      const cart = parseCart(value);

      if (cart) {
        return cart;
      }
    }
  } catch (e) {}


  /* IndexedDB */
  return null;
}


/* =====================================================
   WRITE LOCAL STORAGE
===================================================== */

function writeStorage(cart) {

  const value = JSON.stringify(cart);

  /* localStorage */
  try {
    localStorage.setItem(
      CART_KEY,
      value
    );

    const check =
      localStorage.getItem(CART_KEY);

    if (check === value) {
      return true;
    }
  } catch (e) {}


  /* sessionStorage */
  try {
    sessionStorage.setItem(
      CART_KEY,
      value
    );

    const check =
      sessionStorage.getItem(CART_KEY);

    if (check === value) {
      return true;
    }
  } catch (e) {}


  /* cookie */
  try {
    if (
      writeCookie(
        CART_KEY,
        value
      )
    ) {
      return true;
    }
  } catch (e) {}


  return false;
}


/* =====================================================
   LOAD CART
===================================================== */

async function loadCart() {

  let localCart = readStorage();

  if (
    Array.isArray(localCart)
  ) {
    cartMemory = localCart;

    /* Still check server in background.
       Server cart is useful when browser
       storage was unavailable previously. */

    try {
      const server =
        await supabaseGuestCart(
          "get"
        );

      if (
        server &&
        Array.isArray(server.cart)
      ) {

        /* If local cart is empty and
           server has items, restore it. */

        if (
          cartMemory.length === 0 &&
          server.cart.length > 0
        ) {
          cartMemory = server.cart;

          writeStorage(cartMemory);
        }
      }
    } catch (e) {}

    return cartMemory;
  }


  /* Browser storage failed.
     Get cart from Supabase. */

  try {
    const server =
      await supabaseGuestCart(
        "get"
      );

    if (
      server &&
      Array.isArray(server.cart)
    ) {
      cartMemory = server.cart;

      writeStorage(cartMemory);

      return cartMemory;
    }
  } catch (e) {}


  /* Nothing exists anywhere. */

  cartMemory = [];

  return cartMemory;
}


/* =====================================================
   SAVE CART
===================================================== */

async function saveCart() {

  const cart =
    Array.isArray(cartMemory)
      ? cartMemory
      : [];

  /* Always keep an in-memory copy. */
  cartMemory = cart;


  /* Try browser storage first. */
  const browserSaved =
    writeStorage(cart);


  /* If browser storage worked,
     also synchronize with Supabase
     in the background. */

  if (browserSaved) {

    supabaseGuestCart(
      "save",
      cart
    ).catch(() => {});

    return true;
  }


  /* Browser storage failed.
     Supabase becomes the primary storage. */

  const server =
    await supabaseGuestCart(
      "save",
      cart
    );

  if (server) {
    return true;
  }


  /* Even if everything fails,
     keep cart in memory so the
     current session continues working. */

  return true;
}


/* =====================================================
   CART READY
===================================================== */

async function initializeCart() {

  if (cartReady) {
    return cartMemory;
  }

  if (cartReadyPromise) {
    return cartReadyPromise;
  }

  cartReadyPromise =
    loadCart()
      .then(cart => {

        cartMemory =
          Array.isArray(cart)
            ? cart
            : [];

        cartReady = true;

        updateCartCount();

        document.dispatchEvent(
          new CustomEvent(
            "suruCartReady"
          )
        );

        return cartMemory;
      })
      .catch(error => {

        console.warn(
          "Cart initialization error:",
          error
        );

        cartMemory = [];
        cartReady = true;

        updateCartCount();

        document.dispatchEvent(
          new CustomEvent(
            "suruCartReady"
          )
        );

        return cartMemory;
      });

  return cartReadyPromise;
}


/* =====================================================
   PUBLIC CART ACCESS
===================================================== */

function getCart() {
  return Array.isArray(cartMemory)
    ? cartMemory
    : [];
}


/* =====================================================
   CART COUNT
===================================================== */

function updateCartCount() {

  const count =
    cartMemory.reduce(
      (total, item) =>
        total +
        Number(item.quantity || 0),
      0
    );

  document
    .querySelectorAll(
      ".cart-count, #cartCount, [data-cart-count]"
    )
    .forEach(element => {
      element.textContent = count;
    });
}


/* =====================================================
   ITEM KEY
===================================================== */

function getItemKey(item) {

  return [
    item.product_id ||
      item.id ||
      item.productId ||
      "",
    item.size || "",
    item.color || "",
    item.colour || ""
  ].join("::");
}


/* =====================================================
   ADD TO CART
===================================================== */

async function addToCart(product) {

  await initializeCart();

  if (!product) {
    return false;
  }

  const item = {
    ...product
  };

  item.quantity =
    Math.max(
      1,
      Number(item.quantity || 1)
    );

  if (
    item.color &&
    !item.colour
  ) {
    item.colour = item.color;
  }

  if (
    item.colour &&
    !item.color
  ) {
    item.color = item.colour;
  }


  const key =
    getItemKey(item);

  const existingIndex =
    cartMemory.findIndex(
      existing =>
        getItemKey(existing) === key
    );


  if (existingIndex >= 0) {

    cartMemory[
      existingIndex
    ].quantity =
      Number(
        cartMemory[
          existingIndex
        ].quantity || 0
      ) +
      item.quantity;

  } else {

    cartMemory.push(item);
  }


  await saveCart();

  updateCartCount();

  return true;
}


/* =====================================================
   REMOVE FROM CART
===================================================== */

async function removeFromCart(index) {

  await initializeCart();

  if (
    index < 0 ||
    index >= cartMemory.length
  ) {
    return false;
  }

  cartMemory.splice(
    index,
    1
  );

  await saveCart();

  updateCartCount();

  return true;
}


/* =====================================================
   UPDATE QUANTITY
===================================================== */

async function updateCartQuantity(
  index,
  quantity
) {

  await initializeCart();

  if (
    index < 0 ||
    index >= cartMemory.length
  ) {
    return false;
  }

  const qty =
    Math.max(
      1,
      Number(quantity || 1)
    );

  cartMemory[index].quantity =
    qty;

  await saveCart();

  updateCartCount();

  return true;
}


/* =====================================================
   CLEAR CART
===================================================== */

async function clearCart() {

  await initializeCart();

  cartMemory = [];

  writeStorage([]);

  await supabaseGuestCart(
    "delete"
  );

  updateCartCount();

  return true;
}


/* =====================================================
   BUY NOW
===================================================== */

async function buyNow(product) {

  await clearCart();

  await addToCart(product);

  window.location.href =
    "order.html";
}


/* =====================================================
   LEGACY / PRODUCT CARD SUPPORT
===================================================== */

function normalizeProductFromElement(
  element
) {

  if (!element) {
    return null;
  }

  const product = {
    id:
      element.dataset.productId ||
      element.dataset.id ||
      "",
    product_id:
      element.dataset.productId ||
      element.dataset.id ||
      "",
    name:
      element.dataset.productName ||
      element.dataset.name ||
      "",
    price:
      Number(
        element.dataset.price || 0
      ),
    image:
      element.dataset.image ||
      "",
    size:
      element.dataset.size ||
      "",
    color:
      element.dataset.color ||
      element.dataset.colour ||
      "",
    colour:
      element.dataset.colour ||
      element.dataset.color ||
      "",
    quantity: 1
  };

  return product;
}


/* =====================================================
   DOM CLICK HANDLER
===================================================== */

document.addEventListener(
  "click",
  async function(event) {

    const addButton =
      event.target.closest(
        ".add-cart, .variant-aware-add, [data-add-to-cart]"
      );

    if (!addButton) {
      return;
    }

    /*
      If the product page already has
      its own handler, do not interfere.
    */

    if (
      addButton.dataset.cartHandled ===
      "true"
    ) {
      return;
    }

    const card =
      addButton.closest(
        ".product-card, .product-item, [data-product-id]"
      );

    if (!card) {
      return;
    }


    /* Try to use existing global
       product object if supplied. */

    let product = null;

    if (
      card._suruProduct
    ) {
      product =
        card._suruProduct;
    }


    if (!product) {
      product =
        normalizeProductFromElement(
          card
        );
    }


    if (
      !product ||
      (
        !product.product_id &&
        !product.id
      )
    ) {
      return;
    }


    event.preventDefault();

    addButton.dataset.cartHandled =
      "true";

    addButton.disabled = true;

    try {

      await addToCart(product);

      addButton.textContent =
        "Added ✓";

      setTimeout(() => {

        addButton.disabled =
          false;

        addButton.textContent =
          "Add to Cart";

        delete addButton.dataset
          .cartHandled;

      }, 1000);

    } catch (error) {

      console.error(
        "Add to cart error:",
        error
      );

      addButton.disabled =
        false;

      delete addButton.dataset
        .cartHandled;
    }

  }
);


/* =====================================================
   CART LINK COUNT
===================================================== */

function refreshCartUI() {
  updateCartCount();
}


/* =====================================================
   INITIALIZATION
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  function() {

    initializeCart();

    refreshCartUI();

  }
);


/* =====================================================
   GLOBAL API
===================================================== */

window.SuruShop = {

  ready:
    initializeCart(),

  getCart:
    getCart,

  addToCart:
    addToCart,

  removeFromCart:
    removeFromCart,

  updateCartQuantity:
    updateCartQuantity,

  clearCart:
    clearCart,

  buyNow:
    buyNow,

  saveCart:
    saveCart,

  loadCart:
    loadCart,

  updateCartCount:
    updateCartCount

};


/* =====================================================
   KEEP CART COUNT UPDATED AFTER PAGE CHANGES
===================================================== */

document.addEventListener(
  "suruCartReady",
  function() {
    updateCartCount();
  }
);
