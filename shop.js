/* =====================================================
   SURU COLLECTION — SHOP / CART
   Browser storage + Supabase guest cart
   + URL guest ID fallback
===================================================== */

const CART_KEY = "suruCart";
const GUEST_KEY = "suruGuestId";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

let cartMemory = [];
let cartReady = false;
let cartReadyPromise = null;


/* =====================================================
   GUEST ID
===================================================== */

function getGuestId() {

  /* -----------------------------------------
     1. Get ID from URL
  ----------------------------------------- */

  try {

    const params =
      new URLSearchParams(
        window.location.search
      );

    const urlId =
      params.get("guest");

    if (
      urlId &&
      /^[A-Za-z0-9_-]{20,200}$/.test(urlId)
    ) {

      /* Try to save it locally too */

      try {
        localStorage.setItem(
          GUEST_KEY,
          urlId
        );
      } catch (e) {}

      try {
        sessionStorage.setItem(
          GUEST_KEY,
          urlId
        );
      } catch (e) {}

      try {
        document.cookie =
          GUEST_KEY +
          "=" +
          encodeURIComponent(urlId) +
          "; path=/; max-age=" +
          COOKIE_MAX_AGE +
          "; SameSite=Lax";
      } catch (e) {}

      return urlId;
    }

  } catch (e) {}


  /* -----------------------------------------
     2. localStorage
  ----------------------------------------- */

  try {

    const id =
      localStorage.getItem(
        GUEST_KEY
      );

    if (
      id &&
      /^[A-Za-z0-9_-]{20,200}$/.test(id)
    ) {
      return id;
    }

  } catch (e) {}


  /* -----------------------------------------
     3. sessionStorage
  ----------------------------------------- */

  try {

    const id =
      sessionStorage.getItem(
        GUEST_KEY
      );

    if (
      id &&
      /^[A-Za-z0-9_-]{20,200}$/.test(id)
    ) {
      return id;
    }

  } catch (e) {}


  /* -----------------------------------------
     4. Cookie
  ----------------------------------------- */

  try {

    const match =
      document.cookie.match(
        new RegExp(
          "(?:^|; )" +
          GUEST_KEY.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          ) +
          "=([^;]*)"
        )
      );

    if (
      match &&
      match[1]
    ) {

      const id =
        decodeURIComponent(
          match[1]
        );

      if (
        /^[A-Za-z0-9_-]{20,200}$/.test(
          id
        )
      ) {
        return id;
      }

    }

  } catch (e) {}


  /* -----------------------------------------
     5. Generate new ID
  ----------------------------------------- */

  const id =
    "suru_" +
    Date.now().toString(36) +
    "_" +
    Math.random()
      .toString(36)
      .slice(2) +
    Math.random()
      .toString(36)
      .slice(2);


  /* Try all available storage methods */

  try {
    localStorage.setItem(
      GUEST_KEY,
      id
    );
  } catch (e) {}

  try {
    sessionStorage.setItem(
      GUEST_KEY,
      id
    );
  } catch (e) {}

  try {
    document.cookie =
      GUEST_KEY +
      "=" +
      encodeURIComponent(id) +
      "; path=/; max-age=" +
      COOKIE_MAX_AGE +
      "; SameSite=Lax";
  } catch (e) {}


  return id;
}


/* =====================================================
   ADD GUEST ID TO CART LINKS
===================================================== */

function updateCartLinks() {

  const guestId =
    getGuestId();

  if (!guestId) {
    return;
  }

  document
    .querySelectorAll(
      'a[href*="order.html"]'
    )
    .forEach(link => {

      try {

        const url =
          new URL(
            link.href,
            window.location.href
          );

        url.searchParams.set(
          "guest",
          guestId
        );

        link.href =
          url.toString();

      } catch (e) {}

    });
}


/* =====================================================
   SUPABASE GUEST CART
===================================================== */

function getGuestCartUrl() {

  if (
    window.SUPABASE_URL &&
    window.SUPABASE_URL.includes(
      "supabase.co"
    )
  ) {

    return (
      window.SUPABASE_URL.replace(
        /\/$/,
        ""
      ) +
      "/functions/v1/guest-cart"
    );
  }

  return (
    "https://vkycraymxhkqxgpcpdzw.supabase.co" +
    "/functions/v1/guest-cart"
  );
}


async function supabaseGuestCart(
  action,
  cart
) {

  try {

    const guestId =
      getGuestId();


    const response =
      await fetch(
        getGuestCartUrl(),
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            action:
              action,

            guest_id:
              guestId,

            cart:
              cart
          })
        }
      );


    if (!response.ok) {
      return null;
    }


    return await response.json();

  } catch (error) {

    console.warn(
      "Supabase guest cart unavailable:",
      error
    );

    return null;
  }
}


/* =====================================================
   COOKIE
===================================================== */

function readCookie(name) {

  try {

    const match =
      document.cookie.match(
        new RegExp(
          "(?:^|; )" +
          name.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          ) +
          "=([^;]*)"
        )
      );

    return match
      ? decodeURIComponent(
          match[1]
        )
      : null;

  } catch (e) {

    return null;

  }
}


function writeCookie(
  name,
  value
) {

  try {

    document.cookie =
      name +
      "=" +
      encodeURIComponent(
        value
      ) +
      "; path=/; max-age=" +
      COOKIE_MAX_AGE +
      "; SameSite=Lax";


    return (
      readCookie(name) ===
      value
    );

  } catch (e) {

    return false;

  }
}


/* =====================================================
   CART PARSER
===================================================== */

function parseCart(value) {

  try {

    const parsed =
      JSON.parse(value);

    if (
      Array.isArray(parsed)
    ) {
      return parsed;
    }

  } catch (e) {}

  return null;
}


/* =====================================================
   READ CART FROM BROWSER
===================================================== */

function readStorage() {

  try {

    const value =
      localStorage.getItem(
        CART_KEY
      );

    if (value) {

      const cart =
        parseCart(value);

      if (cart) {
        return cart;
      }
    }

  } catch (e) {}


  try {

    const value =
      sessionStorage.getItem(
        CART_KEY
      );

    if (value) {

      const cart =
        parseCart(value);

      if (cart) {
        return cart;
      }
    }

  } catch (e) {}


  try {

    const value =
      readCookie(
        CART_KEY
      );

    if (value) {

      const cart =
        parseCart(value);

      if (cart) {
        return cart;
      }
    }

  } catch (e) {}


  return null;
}


/* =====================================================
   WRITE CART TO BROWSER
===================================================== */

function writeStorage(
  cart
) {

  const value =
    JSON.stringify(
      cart
    );


  try {

    localStorage.setItem(
      CART_KEY,
      value
    );

    if (
      localStorage.getItem(
        CART_KEY
      ) === value
    ) {
      return true;
    }

  } catch (e) {}


  try {

    sessionStorage.setItem(
      CART_KEY,
      value
    );

    if (
      sessionStorage.getItem(
        CART_KEY
      ) === value
    ) {
      return true;
    }

  } catch (e) {}


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

  const localCart =
    readStorage();


  if (
    Array.isArray(
      localCart
    )
  ) {

    cartMemory =
      localCart;


    /* Synchronize from server only
       when local cart is empty */

    if (
      cartMemory.length === 0
    ) {

      const server =
        await supabaseGuestCart(
          "get"
        );

      if (
        server &&
        Array.isArray(
          server.cart
        ) &&
        server.cart.length > 0
      ) {

        cartMemory =
          server.cart;

        writeStorage(
          cartMemory
        );
      }
    }


    return cartMemory;
  }


  /* Browser storage unavailable.
     Recover from Supabase. */

  const server =
    await supabaseGuestCart(
      "get"
    );


  if (
    server &&
    Array.isArray(
      server.cart
    )
  ) {

    cartMemory =
      server.cart;

    writeStorage(
      cartMemory
    );

    return cartMemory;
  }


  cartMemory = [];

  return cartMemory;
}


/* =====================================================
   SAVE CART
===================================================== */

async function saveCart() {

  const cart =
    Array.isArray(
      cartMemory
    )
      ? cartMemory
      : [];


  cartMemory =
    cart;


  const browserSaved =
    writeStorage(
      cart
    );


  /* Always synchronize with
     Supabase */

  try {

    await supabaseGuestCart(
      "save",
      cart
    );

  } catch (e) {}


  /*
     Returning true is important.

     The cart is always retained
     in memory even when a browser
     blocks persistent storage.
  */

  return true;
}


/* =====================================================
   INITIALIZE
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


        cartReady =
          true;


        updateCartCount();

        updateCartLinks();


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

        cartReady =
          true;


        updateCartCount();

        updateCartLinks();


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
   GET CART
===================================================== */

function getCart() {

  return Array.isArray(
    cartMemory
  )
    ? cartMemory
    : [];
}


/* =====================================================
   CART COUNT
===================================================== */

function updateCartCount() {

  const count =
    cartMemory.reduce(
      (total, item) => {

        return (
          total +
          Number(
            item.quantity ??
            item.qty ??
            0
          )
        );

      },
      0
    );


  document
    .querySelectorAll(
      "#cartCount, .cart-count, [data-cart-count]"
    )
    .forEach(element => {

      element.textContent =
        count;

    });
}


/* =====================================================
   ITEM KEY
===================================================== */

function getItemKey(
  item
) {

  return [

    item.product_id ||
      item.id ||
      item.productId ||
      "",

    item.size || "",

    item.color ||
      item.colour ||
      ""

  ].join("::");
}


/* =====================================================
   ADD TO CART
===================================================== */

async function addToCart(
  product
) {

  await initializeCart();


  if (!product) {
    return false;
  }


  const item = {
    ...product
  };


  const qty =
    Number(
      item.quantity ??
      item.qty ??
      1
    );


  item.quantity =
    Math.max(
      1,
      qty
    );


  /* Keep both names for compatibility */

  item.qty =
    item.quantity;


  if (
    item.color &&
    !item.colour
  ) {
    item.colour =
      item.color;
  }


  if (
    item.colour &&
    !item.color
  ) {
    item.color =
      item.colour;
  }


  const key =
    getItemKey(
      item
    );


  const existingIndex =
    cartMemory.findIndex(
      existing =>
        getItemKey(
          existing
        ) === key
    );


  if (
    existingIndex >= 0
  ) {

    const oldQty =
      Number(
        cartMemory[
          existingIndex
        ].quantity ??
        cartMemory[
          existingIndex
        ].qty ??
        0
      );


    cartMemory[
      existingIndex
    ].quantity =
      oldQty +
      item.quantity;


    cartMemory[
      existingIndex
    ].qty =
      cartMemory[
        existingIndex
      ].quantity;

  } else {

    cartMemory.push(
      item
    );

  }


  await saveCart();

  updateCartCount();

  updateCartLinks();

  return true;
}


/* =====================================================
   REMOVE
===================================================== */

async function removeFromCart(
  index
) {

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
      Number(
        quantity || 1
      )
    );


  cartMemory[
    index
  ].quantity =
    qty;


  cartMemory[
    index
  ].qty =
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


  writeStorage(
    []
  );


  await supabaseGuestCart(
    "delete"
  );


  updateCartCount();

  return true;
}


/* =====================================================
   BUY NOW
===================================================== */

async function buyNow(
  product
) {

  await clearCart();

  await addToCart(
    product
  );


  const guestId =
    getGuestId();


  window.location.href =
    "order.html?guest=" +
    encodeURIComponent(
      guestId
    );
}


/* =====================================================
   INIT
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  function() {

    initializeCart();

    updateCartLinks();

    updateCartCount();

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
    updateCartCount,

  /* Compatibility aliases */

  updateCount:
    updateCartCount,

  clear:
    clearCart

};


/* =====================================================
   CART READY
===================================================== */

document.addEventListener(
  "suruCartReady",
  function() {

    updateCartCount();

    updateCartLinks();

  }
);
