/* =========================================================
   SURU COLLECTION — CONSOLIDATED JAVASCRIPT
   Local site JavaScript and former inline scripts live here.
   Third-party CDN libraries remain external in the HTML.
========================================================= */


/* SUPABASE CONFIG */
window.SURU_SUPABASE_URL =
  "https://vkycraymxhkqxgpcpdzw.supabase.co";

window.SURU_SUPABASE_KEY =
  "sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC";


/* SHOP / CART */
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


/* LOCATION PICKER */
if (document.getElementById("locationMap") || document.getElementById("setLocationOnMap") || document.getElementById("useCurrentLocation")) {
/* =====================================================
   SURU COLLECTION — DELIVERY LOCATION PICKER
   Uses browser geolocation + Leaflet/OpenStreetMap.
   Coordinates are stored separately from the written
   address so hard-to-find addresses remain deliverable.
===================================================== */

(function () {
  "use strict";

  const DEFAULT_LAT = 26.7645; // Gaur
  const DEFAULT_LNG = 85.2786;

  function byId(id) {
    return document.getElementById(id);
  }

  function formatCoord(value) {
    return Number(value).toFixed(6);
  }

  function createMapPicker(config) {
    const {
      mapId = "locationMap",
      openButtonId = "setLocationOnMap",
      currentButtonId = "useCurrentLocation",
      statusId = "locationStatus",
      latId = "locationLatitude",
      lngId = "locationLongitude",
      addressId = "locationAddress",
      dialogId = "locationDialog",
      confirmButtonId = "confirmMapLocation",
      closeButtonId = "closeMapLocation"
    } = config || {};

    const status = byId(statusId);
    const latInput = byId(latId);
    const lngInput = byId(lngId);
    const addressInput = byId(addressId);
    const dialog = byId(dialogId);
    const openButton = byId(openButtonId);
    const currentButton = byId(currentButtonId);
    const confirmButton = byId(confirmButtonId);
    const closeButton = byId(closeButtonId);
    const mapElement = byId(mapId);

    if (!status || !latInput || !lngInput) {
      return null;
    }

    let map = null;
    let marker = null;
    let pendingLat = null;
    let pendingLng = null;

    function setStatus(text, type) {
      status.textContent = text || "";
      status.className = "location-status" + (type ? " " + type : "");
    }

    function updateStatus() {
      const lat = parseFloat(latInput.value);
      const lng = parseFloat(lngInput.value);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setStatus(
          "Location saved: " +
          formatCoord(lat) +
          ", " +
          formatCoord(lng),
          "selected"
        );
      } else {
        setStatus(
          "No map location selected yet. A map pin is required before placing an order."
        );
      }
    }

    function ensureMap() {
      if (map || !mapElement || !window.L) {
        return map;
      }

      map = L.map(mapElement, {
        zoomControl: true
      }).setView([DEFAULT_LAT, DEFAULT_LNG], 13);

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }
      ).addTo(map);

      map.on("click", function (event) {
        pendingLat = event.latlng.lat;
        pendingLng = event.latlng.lng;
        showPendingMarker(pendingLat, pendingLng);
      });

      const existingLat = parseFloat(latInput.value);
      const existingLng = parseFloat(lngInput.value);

      if (Number.isFinite(existingLat) && Number.isFinite(existingLng)) {
        pendingLat = existingLat;
        pendingLng = existingLng;
        map.setView([existingLat, existingLng], 17);
        showPendingMarker(existingLat, existingLng);
      }

      return map;
    }

    function showPendingMarker(lat, lng) {
      if (!map) return;

      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng], {
          draggable: true
        }).addTo(map);

        marker.on("dragend", function () {
          const point = marker.getLatLng();
          pendingLat = point.lat;
          pendingLng = point.lng;
        });
      }

      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    }

    function openMap() {
      if (!dialog) return;

      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }

      const m = ensureMap();

      if (m) {
        setTimeout(function () {
          m.invalidateSize();
        }, 50);
      }
    }

    function closeMap() {
      if (!dialog) return;

      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }

    function savePendingLocation() {
      if (!Number.isFinite(pendingLat) || !Number.isFinite(pendingLng)) {
        setStatus("Please tap the map or use your current location first.", "error");
        return false;
      }

      latInput.value = String(pendingLat);
      lngInput.value = String(pendingLng);

      /*
        Keep a machine-readable fallback even if no reverse
        geocoder is used. The written delivery address remains
        the customer's human-readable address.
      */
      if (addressInput && !addressInput.value.trim()) {
        addressInput.value =
          "Map pin: " +
          formatCoord(pendingLat) +
          ", " +
          formatCoord(pendingLng);
      }

      updateStatus();
      closeMap();
      return true;
    }

    function useCurrentLocation() {
      if (!navigator.geolocation) {
        setStatus(
          "Your browser does not support location services. Please set the location on the map.",
          "error"
        );
        return;
      }

      setStatus("Requesting your current location…");

      navigator.geolocation.getCurrentPosition(
        function (position) {
          pendingLat = position.coords.latitude;
          pendingLng = position.coords.longitude;

          const m = ensureMap();

          if (m) {
            m.setView([pendingLat, pendingLng], 17);
            showPendingMarker(pendingLat, pendingLng);
          }

          latInput.value = String(pendingLat);
          lngInput.value = String(pendingLng);

          if (addressInput && !addressInput.value.trim()) {
            addressInput.value =
              "Current location pin: " +
              formatCoord(pendingLat) +
              ", " +
              formatCoord(pendingLng);
          }

          updateStatus();
        },
        function (error) {
          let message =
            "Could not get your current location.";

          if (error && error.code === 1) {
            message =
              "Location permission was denied. Please allow location access or set the pin on the map.";
          } else if (error && error.code === 2) {
            message =
              "Your location could not be determined. Please set the pin on the map.";
          }

          setStatus(message, "error");
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    }

    if (openButton) {
      openButton.addEventListener("click", openMap);
    }

    if (currentButton) {
      currentButton.addEventListener("click", useCurrentLocation);
    }

    if (confirmButton) {
      confirmButton.addEventListener("click", savePendingLocation);
    }

    if (closeButton) {
      closeButton.addEventListener("click", closeMap);
    }

    if (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) {
          closeMap();
        }
      });
    }

    updateStatus();

    return {
      setLocation: function (lat, lng, label) {
        const latitude = Number(lat);
        const longitude = Number(lng);

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return false;
        }

        latInput.value = String(latitude);
        lngInput.value = String(longitude);

        if (addressInput && label) {
          addressInput.value = String(label);
        }

        pendingLat = latitude;
        pendingLng = longitude;

        if (map) {
          map.setView([latitude, longitude], 17);
          showPendingMarker(latitude, longitude);
        }

        updateStatus();
        return true;
      },

      clear: function () {
        latInput.value = "";
        lngInput.value = "";

        if (addressInput) {
          addressInput.value = "";
        }

        pendingLat = null;
        pendingLng = null;

        if (marker) {
          marker.remove();
          marker = null;
        }

        updateStatus();
      },

      getLocation: function () {
        const latitude = parseFloat(latInput.value);
        const longitude = parseFloat(lngInput.value);

        return {
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          location_address:
            addressInput?.value.trim() || null
        };
      },

      open: openMap,
      useCurrentLocation
    };
  }

  window.SuruLocationPicker = {
    init: createMapPicker
  };
})();
}


/* CUSTOMER AUTHENTICATION */
if (document.getElementById("passwordLoginButton") || document.getElementById("registerForm") || document.getElementById("logoutBtn")) {
/* =====================================================
   SURU COLLECTION - CUSTOMER AUTHENTICATION
   Email OTP Login / Registration / Account
   + Saved delivery map location

   Customers can authenticate with either their email/password or email OTP.
   Phone is NOT used for authentication. A phone number can
   still be collected at checkout because it is useful for delivery.
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabase.createClient(
    window.SURU_SUPABASE_URL,
    window.SURU_SUPABASE_KEY
  );

  const $ = id => document.getElementById(id);

  function showMessage(text, type = "") {
    const el = $("message");
    if (!el) return;
    el.textContent = text;
    el.className = "message " + type;
  }

  function getLocationPicker() {
    return window.suruRegisterLocationPicker ||
      window.suruAccountLocationPicker ||
      window.SuruLocationPickerInstance ||
      null;
  }

  function getLocationFromInputs() {
    const latitude = parseFloat($("locationLatitude")?.value);
    const longitude = parseFloat($("locationLongitude")?.value);
    return {
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      location_address: $("locationAddress")?.value.trim() || null
    };
  }

  /* =====================================================
     MAIN NAVIGATION / YEAR
  ===================================================== */
  const menuToggle = $("menuToggle");
  const mainNav = $("mainNav");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", function () {
      const open = mainNav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(open));
    });

    mainNav.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", function () {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const year = $("year");
  if (year) year.textContent = new Date().getFullYear();

  async function getProfile() {
    // Always obtain the current authenticated user first. getUser() asks
    // Supabase for the authenticated identity and avoids relying only on the
    // locally hydrated session immediately after a redirect.
    const { data: userResult, error: userError } = await client.auth.getUser();
    const authUser = userResult?.user || null;

    if (userError) {
      console.warn("Could not read authenticated user:", userError);
    }

    if (authUser?.id) {
      const { data: directProfile, error: directError } = await client
        .from("customers")
        .select("*")
        .eq("auth_user_id", authUser.id)
        .maybeSingle();

      if (directProfile) return { data: directProfile, error: null, user: authUser };

      if (directError) {
        console.warn("Direct customer profile lookup failed:", directError);
      }
    }

    // SECURITY DEFINER fallback. This also works when the customers SELECT
    // policy or browser cache prevents the direct table query from returning.
    const { data, error } = await client.rpc("my_customer_profile");
    let profile = data;

    if (typeof profile === "string") {
      try { profile = JSON.parse(profile); } catch (_) {}
    }

    return {
      data: profile && typeof profile === "object" && Object.keys(profile).length ? profile : null,
      error,
      user: authUser
    };
  }

  const { data: sessionData } = await client.auth.getSession();
  let session = sessionData?.session || null;

  async function finishCustomerProfile(user, pending = null) {
    if (!user) return null;

    const existing = await getProfile();
    if (!pending && existing.data) return existing.data;

    const metadata = user.user_metadata || {};
    const p = pending || {};
    const locationData = {
      latitude: p.latitude ?? metadata.latitude ?? null,
      longitude: p.longitude ?? metadata.longitude ?? null,
      location_address: p.location_address || metadata.location_address || null
    };

    const phone = String(
      p.phone ?? metadata.phone ?? existing.data?.phone ?? ""
    ).trim();

    if (!phone) {
      throw new Error("Phone number is required to create your customer profile. Please go back and enter your phone number.");
    }

    const payload = {
      auth_user_id: user.id,
      name: p.name || metadata.name || existing.data?.name || "",
      email: user.email || p.email || existing.data?.email || null,
      phone,
      address: p.address || existing.data?.address || null,
      city: p.city || existing.data?.city || null,
      district: p.district || existing.data?.district || null,
      province: p.province || existing.data?.province || null,
      postal_code: p.postal_code || existing.data?.postal_code || null,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      location_address: locationData.location_address,
      location_updated_at:
        locationData.latitude != null && locationData.longitude != null
          ? new Date().toISOString()
          : existing.data?.location_updated_at || null,
      is_active: true
    };

    const { data, error } = await client
      .from("customers")
      .upsert(payload, { onConflict: "auth_user_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  }


  /* =====================================================
     LOGIN - EMAIL/PASSWORD ONLY
  ===================================================== */
  $("passwordLoginButton")?.addEventListener("click", async () => {
    const identifier = $("email")?.value.trim().toLowerCase() || "";
    const password = $("password")?.value || "";

    if (!identifier || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      showMessage("Please enter a valid email address.", "error"); return;
    }
    if (!password) { showMessage("Please enter your password.", "error"); return; }

    showMessage("Signing in…");
    const { data, error } = await client.auth.signInWithPassword({
      email: identifier,
      password
    });
    if (error) {
      showMessage(error.message, "error");
      return;
    }
    if (!data?.session || !data?.user) {
      showMessage("Sign in was not completed. Please try again.", "error");
      return;
    }
    session = data.session;
    try {
      await finishCustomerProfile(data.user, null);
    } catch (e) {
      showMessage(e.message || "Could not load your customer profile.", "error");
      return;
    }
    location.href = "account.html";
  });

  /* =====================================================
     REGISTER - PASSWORD (NO EMAIL VERIFICATION)
  ===================================================== */
  $("registerForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("email")?.value.trim().toLowerCase() || "";
    const name = $("name")?.value.trim() || "";
    const password = $("password")?.value || "";
    const confirmPassword = $("confirmPassword")?.value || "";
    const phone = $("phone")?.value.trim() || "";
    const address = $("address")?.value.trim() || "";
    const city = $("city")?.value.trim() || "";
    const district = $("district")?.value.trim() || "";
    const locationData = getLocationFromInputs();

    if (!name) { showMessage("Please enter your name.", "error"); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMessage("Please enter a valid email address.", "error"); return; }
    if (password.length < 6) { showMessage("Password must be at least 6 characters.", "error"); return; }
    if (password !== confirmPassword) { showMessage("Passwords do not match.", "error"); return; }
    if (!phone) { showMessage("Please enter your phone number.", "error"); return; }

    showMessage("Creating your account…");
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          name, phone, address, city, district,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          location_address: locationData.location_address
        }
      }
    });

    if (error) { showMessage(error.message, "error"); return; }

    const user = data?.user;
    if (!user) { showMessage("Account creation did not complete. Please try again.", "error"); return; }

    // With Supabase "Confirm email" disabled, signUp returns an active session.
    // If it is still enabled, Supabase returns no session and the user must
    // confirm their email; show a clear message instead of pretending signup succeeded.
    if (!data?.session) {
      showMessage('Your account was created, but Supabase still requires email confirmation. Please disable "Confirm email" in Authentication → Providers → Email and try again.', "error");
      return;
    }

    session = data.session;
    try {
      await finishCustomerProfile(user, {
        name, email, phone, address, city, district,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        location_address: locationData.location_address
      });
    } catch (e) {
      showMessage(e.message || "Account was created, but the customer profile could not be saved.", "error");
      return;
    }

    showMessage("Account created successfully. Redirecting…", "success");
    setTimeout(() => { location.href = "account.html"; }, 350);
  });

  /* =====================================================
     LOGOUT
  ===================================================== */
  $("logoutBtn")?.addEventListener("click", async () => {
    await client.auth.signOut();
    location.href = "login.html";
  });

  /* =====================================================
     ACCOUNT PAGE
  ===================================================== */
  if (location.pathname.endsWith("account.html")) {
    if (!session) {
      location.href = "login.html";
      return;
    }

    let profileResult = await getProfile();

    // A just-completed login can take a moment to hydrate the authenticated
    // session across a page redirect. Retry briefly instead of rendering an
    // empty account page.
    for (let attempt = 0; attempt < 3 && !profileResult.data; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 400));
      profileResult = await getProfile();
    }

    const profile = profileResult.data;
    const profileUser = profileResult.user || session?.user || null;

    if (profileResult.error && !profile) {
      showMessage(profileResult.error.message || "Could not load your customer profile.", "error");
      return;
    }

    // Always show the authenticated email even if an old account is missing
    // its customers row; the remaining fields fall back cleanly.
    if ($("customerName")) $("customerName").textContent = profile?.name || profileUser?.user_metadata?.name || "Customer";
    if ($("profileName")) $("profileName").textContent = profile?.name || profileUser?.user_metadata?.name || "—";
    if ($("profileEmail")) $("profileEmail").textContent = profile?.email || profileUser?.email || "—";
    if ($("profilePhone")) $("profilePhone").textContent = profile?.phone || profileUser?.user_metadata?.phone || "Not added";
    if ($("profileAddress")) $("profileAddress").textContent = profile?.address || profileUser?.user_metadata?.address || "—";
    if ($("profileCity")) $("profileCity").textContent = [profile?.city || profileUser?.user_metadata?.city, profile?.district || profileUser?.user_metadata?.district].filter(Boolean).join(", ") || "—";

    if (!profile) {
      showMessage("Your login is active, but your customer profile has not been created yet.", "error");
      return;
    }

    const accountPicker = window.suruAccountLocationPicker;
    if (accountPicker && profile.latitude != null && profile.longitude != null) {
      accountPicker.setLocation(
        profile.latitude,
        profile.longitude,
        profile.location_address || `Saved map pin: ${Number(profile.latitude).toFixed(6)}, ${Number(profile.longitude).toFixed(6)}`
      );
    }

    const locationMissing = profile.latitude == null || profile.longitude == null;
    if ($("accountLocationPrompt") && locationMissing) {
      $("accountLocationPrompt").textContent =
        "Your delivery map location is not saved. Please save it now or it will be requested during checkout.";
    }

    $("saveAccountLocation")?.addEventListener("click", async () => {
      const locationData = accountPicker?.getLocation?.() || getLocationFromInputs();
      if (locationData.latitude == null || locationData.longitude == null) {
        showMessage("Please use your current location or set a pin on the map.", "error");
        return;
      }

      const { error } = await client
        .from("customers")
        .update({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          location_address: locationData.location_address || null,
          location_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("auth_user_id", session.user.id);

      if (error) {
        showMessage(error.message, "error");
        return;
      }

      showMessage("Delivery location saved successfully.", "success");
      if ($("accountLocationPrompt")) {
        $("accountLocationPrompt").textContent =
          "Your delivery location is saved and will be used for future orders.";
      }
    });

    /* -----------------------------
       ORDERS
    ----------------------------- */
    const { data: orders, error: orderError } = await client
      .from("orders")
      .select(`
        id,
        order_number,
        total,
        payment_method,
        payment_status,
        order_status,
        shipping_address,
        city,
        delivery_latitude,
        delivery_longitude,
        created_at,
        order_items(
          product_name,
          size,
          color,
          quantity,
          unit_price,
          total_price
        )
      `)
      .eq("customer_id", profile.id)
      .order("created_at", { ascending: false });

    if (orderError) {
      if ($("orders")) $("orders").innerHTML = `<p class="message error">${orderError.message}</p>`;
      return;
    }
    if (!$("orders")) return;

    if (!orders?.length) {
      $("orders").innerHTML = "<p>No orders yet.</p>";
    } else {
      $("orders").innerHTML = orders.map(order => {
        const items = order.order_items || [];
        const mapLink = order.delivery_latitude != null && order.delivery_longitude != null
          ? `<a class="location-map-link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${encodeURIComponent(order.delivery_latitude + "," + order.delivery_longitude)}">View delivery pin</a>`
          : "";
        return `
          <article class="order-card">
            <div class="order-head"><strong>${order.order_number || "Order"}</strong><span>${order.order_status || "pending"}</span></div>
            <p>${new Date(order.created_at).toLocaleString()}</p>
            <div class="order-items">
              ${items.map(item => `<div>${item.product_name || ""}${item.color ? ` · ${item.color}` : ""}${item.size ? ` · ${item.size}` : ""} × ${item.quantity}</div>`).join("")}
            </div>
            <strong class="order-total">NPR ${Number(order.total || 0).toLocaleString("en-IN")}</strong>
            <small>Payment: ${order.payment_method || "—"} · ${order.payment_status || "—"}</small>
            ${mapLink}
          </article>`;
      }).join("");
    }
  }
});
}


/* NEWSLETTER */
if (document.getElementById("newsletterForm")) {
(function () {

  "use strict";


  function initializeNewsletter() {

    const form =
      document.getElementById(
        "newsletterForm"
      );


    if (!form) {
      return;
    }


    if (
      !window.supabase ||
      !window.SURU_SUPABASE_URL ||
      !window.SURU_SUPABASE_KEY
    ) {

      console.error(
        "Newsletter: Supabase configuration unavailable."
      );

      return;

    }


    const client =
      window.supabase.createClient(
        window.SURU_SUPABASE_URL,
        window.SURU_SUPABASE_KEY
      );


    const emailInput =
      document.getElementById(
        "newsletterEmail"
      );


    const button =
      document.getElementById(
        "newsletterButton"
      );


    const status =
      document.getElementById(
        "newsletterStatus"
      );


    form.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();


        const email =
          emailInput.value
            .trim()
            .toLowerCase();


        if (
          !emailInput.checkValidity()
        ) {

          status.textContent =
            "Please enter a valid email address.";

          status.className =
            "newsletter-status error";

          emailInput.focus();

          return;

        }


        button.disabled = true;

        button.textContent =
          "Subscribing…";


        status.textContent =
          "";

        status.className =
          "newsletter-status";


        try {


          const result =
            await client
              .from(
                "newsletter_subscribers"
              )
              .insert({
                email: email
              });


          if (result.error) {


            if (
              result.error.code ===
              "23505"
            ) {

              status.textContent =
                "You are already subscribed. Thank you!";

              status.className =
                "newsletter-status success";

            } else {

              throw result.error;

            }


          } else {


            status.textContent =
              "Thank you! You are now subscribed to Suru Collection updates.";

            status.className =
              "newsletter-status success";


            form.reset();

          }


        } catch (error) {


          console.error(
            "Newsletter subscription failed:",
            error
          );


          status.textContent =
            "Something went wrong. Please try again in a moment.";


          status.className =
            "newsletter-status error";


        } finally {


          button.disabled =
            false;


          button.textContent =
            "Subscribe";

        }

      }
    );

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initializeNewsletter
    );

  } else {

    initializeNewsletter();

  }

})();
}


/* PRODUCT DETAIL PAGE */
if (document.getElementById("productRoot")) {
(function () {
  "use strict";

  const root = document.getElementById("productRoot");

  if (!root) return;

  const SUPABASE_URL =
    window.SURU_SUPABASE_URL ||
    "https://vkycraymxhkqxgpcpdzw.supabase.co";

  const SUPABASE_KEY =
    window.SURU_SUPABASE_KEY ||
    "sb_publishable_IUD5XQOsqHtrGCj3BJ5jpA_EjSPTUrC";

  const client =
    window.supabase &&
    window.supabase.createClient
      ? window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_KEY
        )
      : null;


  /* =========================================================
     HELPERS
     ========================================================= */

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function normalise(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }


  function money(value) {
    const n = Number(value || 0);

    return (
      "NPR " +
      n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );
  }


  function getCode() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    return (
      params.get("code") ||
      params.get("product") ||
      ""
    ).trim();
  }


  function uniqueValues(values) {
    const result = [];

    values.forEach(function (value) {
      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
      ) {
        return;
      }

      const exists = result.some(
        function (existing) {
          return (
            normalise(existing) ===
            normalise(value)
          );
        }
      );

      if (!exists) {
        result.push(
          String(value).trim()
        );
      }
    });

    return result;
  }


  /* =========================================================
     LOAD PRODUCT
     ========================================================= */

  async function loadProduct() {

    const code = getCode();

    if (!code) {
      root.innerHTML = `
        <div class="product-loading-page">
          <h2>Product not found</h2>
          <p>No product code was provided.</p>
        </div>
      `;
      return;
    }


    if (!client) {
      root.innerHTML = `
        <div class="product-loading-page">
          Unable to connect to the product service.
        </div>
      `;
      return;
    }


    try {

      const {
        data: product,
        error: productError
      } = await client
        .from("products")
        .select(`
          id,
          product_code,
          name,
          slug,
          category,
          description,
          price,
          compare_at_price,
          moq,
          fabric,
          color,
          pattern,
          is_active
        `)
        .eq(
          "product_code",
          code
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle();


      if (productError) {
        throw productError;
      }


      if (!product) {
        root.innerHTML = `
          <div class="product-loading-page">
            <h2>Product not found</h2>
            <p>This product is unavailable.</p>
          </div>
        `;
        return;
      }


      const {
        data: images,
        error: imageError
      } = await client
        .from("product_images")
        .select(`
          image_url,
          alt_text,
          sort_order,
          is_main
        `)
        .eq(
          "product_id",
          product.id
        )
        .order(
          "sort_order",
          {
            ascending: true
          }
        );


      if (imageError) {
        throw imageError;
      }


      const {
        data: variants,
        error: variantError
      } = await client
        .from("product_sizes")
        .select(`
          id,
          size,
          color,
          bust,
          waist,
          hip,
          shoulder,
          top_length,
          bottom_length,
          dupatta_length,
          unit,
          stock,
          is_active
        `)
        .eq(
          "product_id",
          product.id
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "size",
          {
            ascending: true,
            nullsFirst: true
          }
        );


      if (variantError) {
        throw variantError;
      }


      renderProduct(
        product,
        Array.isArray(images)
          ? images
          : [],
        Array.isArray(variants)
          ? variants
          : []
      );


    } catch (error) {

      console.error(
        "Product loading error:",
        error
      );


      root.innerHTML = `
        <div class="product-loading-page">
          <h2>Unable to load product</h2>
          <p>
            ${esc(
              error?.message ||
              "Please try again."
            )}
          </p>
        </div>
      `;

    }

  }


  /* =========================================================
     RENDER PRODUCT
     ========================================================= */

  function renderProduct(
    product,
    images,
    variants
  ) {

    const mainImage =
      images.find(
        function (img) {
          return img.is_main;
        }
      ) ||
      images[0];


    const mainImageUrl =
      mainImage?.image_url ||
      "";


    const colours =
      uniqueValues(
        variants.map(
          function (variant) {
            return variant.color;
          }
        )
      );


    /*
      If variants don't contain colours but
      product.color exists, treat it as a
      fixed colour.
    */

    const productColour =
      product.color
        ? String(product.color).trim()
        : "";


    const effectiveColours =
      colours.length
        ? colours
        : productColour
          ? [productColour]
          : [];


    const sizes =
      uniqueValues(
        variants.map(
          function (variant) {
            return variant.size;
          }
        )
      );


    const hasSizes =
      sizes.length > 0;


    const hasMultipleColours =
      colours.length > 1;


    const hasAnyColour =
      effectiveColours.length > 0;


    const showColourSelector =
      hasMultipleColours;


    const noVariantProduct =
      !hasSizes &&
      !hasAnyColour;


    root.innerHTML = `

      <div class="product-layout">

        <!-- =================================================
             GALLERY
             ================================================= -->

        <div class="product-gallery">

          <div class="product-main-image">

            <img
              id="productMainImage"
              src="${esc(mainImageUrl)}"
              alt="${esc(product.name)}"
            >

          </div>


          ${
            images.length > 1
              ? `
                <div class="product-thumbnails">

                  ${images.map(
                    function (img, index) {

                      return `
                        <button
                          type="button"
                          class="product-thumb ${
                            index === 0
                              ? "active"
                              : ""
                          }"
                          data-image="${esc(
                            img.image_url
                          )}"
                        >

                          <img
                            src="${esc(
                              img.image_url
                            )}"
                            alt="${esc(
                              img.alt_text ||
                              product.name
                            )}"
                          >

                        </button>
                      `;

                    }
                  ).join("")}

                </div>
              `
              : ""
          }

        </div>


        <!-- =================================================
             PRODUCT INFORMATION
             ================================================= -->

        <div class="product-info">

          <div class="product-code">
            ${esc(
              product.product_code
            )}
          </div>


          <h1>
            ${esc(product.name)}
          </h1>


          <div class="product-price">

            ${money(product.price)}

            ${
              product.compare_at_price
                ? `
                  <span class="compare-price">
                    ${money(
                      product.compare_at_price
                    )}
                  </span>
                `
                : ""
            }

          </div>


          ${
            product.description
              ? `
                <div class="product-description">
                  ${esc(
                    product.description
                  )}
                </div>
              `
              : ""
          }


          <div class="product-details">

            ${
              product.fabric
                ? `
                  <div>
                    <strong>Fabric:</strong>
                    ${esc(
                      product.fabric
                    )}
                  </div>
                `
                : ""
            }


            ${
              productColour &&
              !showColourSelector
                ? `
                  <div>
                    <strong>Colour:</strong>
                    ${esc(
                      productColour
                    )}
                  </div>
                `
                : ""
            }


            ${
              product.pattern
                ? `
                  <div>
                    <strong>Pattern:</strong>
                    ${esc(
                      product.pattern
                    )}
                  </div>
                `
                : ""
            }


            ${
              product.moq != null
                ? `
                  <div>
                    <strong>MOQ:</strong>
                    ${esc(
                      product.moq
                    )}
                  </div>
                `
                : ""
            }

          </div>


          <!-- =================================================
               COLOUR SELECTOR
               ================================================= -->

          ${
            showColourSelector
              ? `
                <div class="variant-group">

                  <label
                    for="productColor"
                  >
                    Colour
                  </label>


                  <select
                    id="productColor"
                    class="variant-select"
                  >

                    <option value="">
                      Select Colour
                    </option>

                    ${effectiveColours.map(
                      function (colour) {

                        const available =
                          variants.some(
                            function (variant) {

                              return (
                                normalise(
                                  variant.color
                                ) ===
                                normalise(
                                  colour
                                ) &&
                                Number(
                                  variant.stock || 0
                                ) > 0
                              );

                            }
                          );


                        return `
                          <option
                            value="${esc(
                              colour
                            )}"
                            ${
                              !available
                                ? "disabled"
                                : ""
                            }
                          >

                            ${esc(colour)}

                            ${
                              !available
                                ? " — Out of Stock"
                                : ""
                            }

                          </option>
                        `;

                      }
                    ).join("")}

                  </select>

                </div>
              `
              : ""
          }


          <!-- =================================================
               FIXED COLOUR
               ================================================= -->

          ${
            !showColourSelector &&
            effectiveColours.length === 1
              ? `
                <div class="variant-group">

                  <label>
                    Colour
                  </label>

                  <div class="variant-fixed">
                    ${esc(
                      effectiveColours[0]
                    )}
                  </div>

                </div>
              `
              : ""
          }


          <!-- =================================================
               SIZE SELECTOR
               ================================================= -->

          ${
            hasSizes
              ? `
                <div class="variant-group">

                  <label
                    for="productSize"
                  >
                    Size
                  </label>


                  <select
                    id="productSize"
                    class="variant-select"
                  >

                    <option value="">
                      Select Size
                    </option>

                  </select>


                  <div
                    id="variantStock"
                    class="variant-stock"
                  >
                    Select your options
                  </div>

                </div>
              `
              : `
                <div
                  id="variantStock"
                  class="variant-stock"
                ></div>
              `
          }


          <!-- =================================================
               QUANTITY
               ================================================= -->

          <div class="quantity-group">

            <label
              for="productQty"
            >
              Quantity
            </label>


            <input
              id="productQty"
              class="quantity-input"
              type="number"
              min="1"
              value="1"
              inputmode="numeric"
            >


            <small
              id="quantityHelp"
            ></small>

          </div>


          <!-- =================================================
               ACTIONS
               ================================================= -->

          <div class="product-actions">

            <button
              type="button"
              class="buy-button"
              id="addToCartButton"
              disabled
            >
              Add to Cart
            </button>


            <button
              type="button"
              class="buy-now-button"
              id="buyNowButton"
              disabled
            >
              Buy Now
            </button>

          </div>


          <div
            id="variantMessage"
            class="variant-message"
          ></div>


          ${
            hasSizes
              ? renderSizeGuide(
                  variants
                )
              : ""
          }


          <!-- =================================================
               WHATSAPP
               ================================================= -->

          <div class="product-enquiry">

            <a
              href="https://wa.me/9779740381427?text=${encodeURIComponent(
                "Hello Suru Collection, I am interested in " +
                product.name +
                " (" +
                product.product_code +
                ")."
              )}"
              target="_blank"
              rel="noopener"
            >
              Enquire on WhatsApp
            </a>

          </div>

        </div>

      </div>
    `;


    setupGallery();


    setupVariantLogic(
      product,
      variants,
      {
        hasSizes:
          hasSizes,

        hasColours:
          hasAnyColour,

        multipleColours:
          hasMultipleColours,

        noVariantProduct:
          noVariantProduct
      }
    );

  }


  /* =========================================================
     SIZE GUIDE
     ========================================================= */

  function renderSizeGuide(
    variants
  ) {

    const guideVariants =
      variants.filter(
        function (variant) {

          return (
            variant.size &&
            normalise(
              variant.size
            ) !== "one size"
          );

        }
      );


    if (!guideVariants.length) {

      return "";

    }


    return `

      <div class="size-guide">

        <h3>
          Size Guide
        </h3>


        <div class="size-table-wrap">

          <table class="size-table">

            <thead>

              <tr>
                <th>Size</th>
                <th>Bust</th>
                <th>Waist</th>
                <th>Hip</th>
                <th>Shoulder</th>
                <th>Top Length</th>
                <th>Stock</th>
              </tr>

            </thead>


            <tbody>

              ${guideVariants.map(
                function (variant) {

                  return `

                    <tr>

                      <td>
                        ${esc(
                          variant.size
                        )}
                      </td>


                      <td>
                        ${
                          variant.bust != null
                            ? esc(
                                variant.bust
                              )
                            : "—"
                        }
                      </td>


                      <td>
                        ${
                          variant.waist != null
                            ? esc(
                                variant.waist
                              )
                            : "—"
                        }
                      </td>


                      <td>
                        ${
                          variant.hip != null
                            ? esc(
                                variant.hip
                              )
                            : "—"
                        }
                      </td>


                      <td>
                        ${
                          variant.shoulder != null
                            ? esc(
                                variant.shoulder
                              )
                            : "—"
                        }
                      </td>


                      <td>
                        ${
                          variant.top_length != null
                            ? esc(
                                variant.top_length
                              )
                            : "—"
                        }
                      </td>


                      <td>
                        ${
                          Number(
                            variant.stock || 0
                          ) > 0
                            ? "Available"
                            : "Out of Stock"
                        }
                      </td>

                    </tr>

                  `;

                }
              ).join("")}

            </tbody>

          </table>

        </div>

      </div>

    `;

  }


  /* =========================================================
     GALLERY
     ========================================================= */

  function setupGallery() {

    const mainImage =
      document.getElementById(
        "productMainImage"
      );


    document
      .querySelectorAll(
        ".product-thumb"
      )
      .forEach(
        function (button) {

          button.addEventListener(
            "click",
            function () {

              const image =
                button.dataset.image;


              if (
                mainImage &&
                image
              ) {

                mainImage.src =
                  image;

              }


              document
                .querySelectorAll(
                  ".product-thumb"
                )
                .forEach(
                  function (item) {

                    item.classList.remove(
                      "active"
                    );

                  }
                );


              button.classList.add(
                "active"
              );

            }
          );

        }
      );

  }


  /* =========================================================
     VARIANT LOGIC
     ========================================================= */

  function setupVariantLogic(
    product,
    variants,
    config
  ) {

    const colourSelect =
      document.getElementById(
        "productColor"
      );


    const sizeSelect =
      document.getElementById(
        "productSize"
      );


    const qtyInput =
      document.getElementById(
        "productQty"
      );


    const stockText =
      document.getElementById(
        "variantStock"
      );


    const quantityHelp =
      document.getElementById(
        "quantityHelp"
      );


    const message =
      document.getElementById(
        "variantMessage"
      );


    const addButton =
      document.getElementById(
        "addToCartButton"
      );


    const buyNowButton =
      document.getElementById(
        "buyNowButton"
      );


    /*
      Get selected colour.
    */

    function getSelectedColour() {

      if (colourSelect) {

        return (
          colourSelect.value ||
          ""
        );

      }


      return (
        product.color ||
        ""
      );

    }


    /*
      Find exact variant.

      First:
      size + colour

      Then:
      size + fixed product colour

      Then:
      colour only

      Finally:
      no size + no colour.
    */

    function findVariant() {

      const selectedColour =
        getSelectedColour();


      const selectedSize =
        sizeSelect
          ? sizeSelect.value
          : "";


      /*
        No variants in database.
      */

      if (
        variants.length === 0
      ) {

        return null;

      }


      /*
        PRODUCT WITH NO SIZE
        AND NO COLOUR
      */

      if (
        !config.hasSizes &&
        !config.hasColours
      ) {

        return (
          variants.find(
            function (variant) {

              return (
                !variant.size &&
                !variant.color
              );

            }
          ) ||
          null
        );

      }


      /*
        SIZE + COLOUR
      */

      if (
        config.hasSizes &&
        config.hasColours
      ) {

        if (
          !selectedSize
        ) {

          return null;

        }


        if (
          !selectedColour
        ) {

          return null;

        }


        /*
          Exact colour match.
        */

        let match =
          variants.find(
            function (variant) {

              return (
                normalise(
                  variant.size
                ) ===
                normalise(
                  selectedSize
                ) &&

                normalise(
                  variant.color
                ) ===
                normalise(
                  selectedColour
                )
              );

            }
          );


        if (match) {

          return match;

        }


        /*
          Legacy fixed-colour
          product_sizes rows where
          color is NULL.
        */

        match =
          variants.find(
            function (variant) {

              return (
                normalise(
                  variant.size
                ) ===
                normalise(
                  selectedSize
                ) &&

                !normalise(
                  variant.color
                ) &&

                normalise(
                  product.color
                ) ===
                normalise(
                  selectedColour
                )
              );

            }
          );


        return match || null;

      }


      /*
        SIZE ONLY
      */

      if (
        config.hasSizes &&
        !config.hasColours
      ) {

        if (
          !selectedSize
        ) {

          return null;

        }


        return (
          variants.find(
            function (variant) {

              return (
                normalise(
                  variant.size
                ) ===
                normalise(
                  selectedSize
                )
              );

            }
          ) ||
          null
        );

      }


      /*
        COLOUR ONLY
      */

      if (
        !config.hasSizes &&
        config.hasColours
      ) {

        if (
          !selectedColour
        ) {

          return null;

        }


        return (
          variants.find(
            function (variant) {

              return (
                !variant.size &&

                (
                  normalise(
                    variant.color
                  ) ===
                  normalise(
                    selectedColour
                  ) ||

                  (
                    !variant.color &&
                    normalise(
                      product.color
                    ) ===
                    normalise(
                      selectedColour
                    )
                  )
                )
              );

            }
          ) ||
          null
        );

      }


      return null;

    }


    /*
      Populate size options based
      on selected colour.
    */

    function populateSizes() {

      if (!sizeSelect) {

        return;

      }


      const selectedColour =
        getSelectedColour();


      const previousSize =
        sizeSelect.value;


      const sizes =
        uniqueValues(
          variants.map(
            function (variant) {
              return variant.size;
            }
          )
        );


      sizeSelect.innerHTML =
        `
          <option value="">
            Select Size
          </option>
        `;


      sizes.forEach(
        function (size) {

          const option =
            document.createElement(
              "option"
            );


          option.value =
            size;


          option.textContent =
            size;


          /*
            Find variants for this size.
          */

          const matching =
            variants.filter(
              function (variant) {

                if (
                  normalise(
                    variant.size
                  ) !==
                  normalise(
                    size
                  )
                ) {

                  return false;

                }


                /*
                  If colour selected,
                  only use that colour.
                */

                if (
                  selectedColour
                ) {

                  const variantColour =
                    normalise(
                      variant.color
                    );


                  const selected =
                    normalise(
                      selectedColour
                    );


                  /*
                    Exact colour.
                  */

                  if (
                    variantColour ===
                    selected
                  ) {

                    return true;

                  }


                  /*
                    Legacy fixed colour.
                  */

                  if (
                    !variantColour &&
                    normalise(
                      product.color
                    ) ===
                    selected
                  ) {

                    return true;

                  }


                  return false;

                }


                return true;

              }
            );


          const available =
            matching.some(
              function (variant) {

                return (
                  Number(
                    variant.stock || 0
                  ) > 0
                );

              }
            );


          if (!available) {

            option.disabled =
              true;


            option.textContent =
              size +
              " — Out of Stock";

          }


          sizeSelect.appendChild(
            option
          );

        }
      );


      /*
        Restore previous size if
        still available.
      */

      if (
        previousSize &&
        Array.from(
          sizeSelect.options
        ).some(
          function (option) {

            return (
              option.value ===
                previousSize &&
              !option.disabled
            );

          }
        )
      ) {

        sizeSelect.value =
          previousSize;

      }

    }


    /*
      Update stock and buttons.
    */

    function updateUI() {

      const variant =
        findVariant();


      if (!variant) {

        if (
          config.noVariantProduct
        ) {

          if (
            variants.length === 0
          ) {

            stockText.textContent =
              "Stock information is not configured.";

            stockText.classList.add(
              "out-of-stock"
            );

          } else {

            stockText.textContent =
              "Please select an available option.";

            stockText.classList.remove(
              "out-of-stock"
            );

          }

        } else {

          stockText.textContent =
            "Please select an available option.";

          stockText.classList.remove(
            "out-of-stock"
          );

        }


        quantityHelp.textContent =
          "";


        addButton.disabled =
          true;


        buyNowButton.disabled =
          true;


        qtyInput.removeAttribute(
          "max"
        );


        return;

      }


      const stock =
        Number(
          variant.stock || 0
        );


      if (
        stock <= 0
      ) {

        stockText.textContent =
          "Out of Stock";


        stockText.classList.add(
          "out-of-stock"
        );


        quantityHelp.textContent =
          "This option is currently out of stock.";


        addButton.disabled =
          true;


        buyNowButton.disabled =
          true;


        qtyInput.value =
          "1";


        qtyInput.max =
          "0";


        return;

      }


      stockText.textContent =
        stock +
        " item(s) available";


      stockText.classList.remove(
        "out-of-stock"
      );


      quantityHelp.textContent =
        "Maximum available: " +
        stock;


      qtyInput.max =
        String(stock);


      let quantity =
        parseInt(
          qtyInput.value,
          10
        ) || 1;


      if (
        quantity < 1
      ) {

        quantity = 1;

      }


      if (
        quantity > stock
      ) {

        quantity = stock;

      }


      qtyInput.value =
        String(quantity);


      addButton.disabled =
        false;


      buyNowButton.disabled =
        false;

    }


    /*
      Colour changed.
    */

    if (colourSelect) {

      colourSelect.addEventListener(
        "change",
        function () {

          /*
            Rebuild sizes for the
            selected colour.
          */

          populateSizes();


          /*
            Do not retain a size that
            belongs to another colour.
          */

          if (sizeSelect) {

            sizeSelect.value =
              "";

          }


          updateUI();

        }
      );

    }


    /*
      Size changed.
    */

    if (sizeSelect) {

      populateSizes();


      sizeSelect.addEventListener(
        "change",
        updateUI
      );

    }


    /*
      Quantity changed.
    */

    if (qtyInput) {

      qtyInput.addEventListener(
        "input",
        function () {

          const variant =
            findVariant();


          if (!variant) {

            return;

          }


          const stock =
            Number(
              variant.stock || 0
            );


          let quantity =
            parseInt(
              qtyInput.value,
              10
            ) || 1;


          if (
            quantity < 1
          ) {

            quantity = 1;

          }


          if (
            stock > 0 &&
            quantity > stock
          ) {

            quantity =
              stock;

          }


          qtyInput.value =
            String(quantity);

        }
      );

    }


    /*
      Add to Cart.
    */

    if (addButton) {

      addButton.addEventListener(
        "click",
        function () {

          const variant =
            findVariant();


          if (!variant) {

            showMessage(
              "Please select an available option.",
              true
            );

            return;

          }


          const stock =
            Number(
              variant.stock || 0
            );


          const quantity =
            Math.max(
              1,
              parseInt(
                qtyInput.value,
                10
              ) || 1
            );


          if (
            stock <= 0 ||
            quantity > stock
          ) {

            showMessage(
              "Selected quantity is not available.",
              true
            );

            return;

          }


          if (
            !window.SuruShop ||
            typeof window.SuruShop.addToCart !==
              "function"
          ) {

            showMessage(
              "Shopping cart is unavailable. Please refresh the page.",
              true
            );

            return;

          }


          const mainImage =
            document.getElementById(
              "productMainImage"
            );


          const saved =
            window.SuruShop.addToCart({

              code:
                product.product_code,

              name:
                product.name,

              price:
                Number(
                  product.price || 0
                ),

              image:
                mainImage?.src ||
                "",

              size:
                variant.size ||
                null,

              color:
                variant.color ||
                product.color ||
                null,

              qty:
                quantity

            });


          if (
            saved !== false
          ) {

            showMessage(
              "Added to cart successfully.",
              false
            );

          } else {

            showMessage(
              "Unable to save your cart. Please try again.",
              true
            );

          }

        }
      );

    }


    /*
      Buy Now.
    */

    if (buyNowButton) {

      buyNowButton.addEventListener(
        "click",
        function () {

          const variant =
            findVariant();


          if (!variant) {

            showMessage(
              "Please select an available option.",
              true
            );

            return;

          }


          const stock =
            Number(
              variant.stock || 0
            );


          const quantity =
            Math.max(
              1,
              parseInt(
                qtyInput.value,
                10
              ) || 1
            );


          if (
            stock <= 0 ||
            quantity > stock
          ) {

            showMessage(
              "Selected quantity is not available.",
              true
            );

            return;

          }


          if (
            !window.SuruShop ||
            typeof window.SuruShop.addToCart !==
              "function"
          ) {

            showMessage(
              "Shopping cart is unavailable. Please refresh the page.",
              true
            );

            return;

          }


          const mainImage =
            document.getElementById(
              "productMainImage"
            );


          const saved =
            window.SuruShop.addToCart({

              code:
                product.product_code,

              name:
                product.name,

              price:
                Number(
                  product.price || 0
                ),

              image:
                mainImage?.src ||
                "",

              size:
                variant.size ||
                null,

              color:
                variant.color ||
                product.color ||
                null,

              qty:
                quantity

            });


          if (
            saved === false
          ) {

            showMessage(
              "Unable to save your cart. Please try again.",
              true
            );

            return;

          }


          /*
            Go directly to checkout.
          */

          window.location.href =
            "order.html";

        }
      );

    }


    /*
      Initial state.
    */

    updateUI();


    /* =======================================================
       MESSAGE
       ======================================================= */

    function showMessage(
      text,
      isError
    ) {

      if (!message) {

        return;

      }


      message.textContent =
        text;


      message.classList.toggle(
        "error",
        !!isError
      );


      message.classList.add(
        "visible"
      );


      clearTimeout(
        window.__suruProductMessageTimer
      );


      window.__suruProductMessageTimer =
        setTimeout(
          function () {

            message.classList.remove(
              "visible"
            );

          },
          3000
        );

    }

  }


  /* =========================================================
     START
     ========================================================= */

  loadProduct();

})();
}


/* ADMIN PANEL */
if (document.getElementById("loginView") || document.getElementById("appView")) {
document.addEventListener("DOMContentLoaded", function () {

  const client = window.supabase.createClient(
    window.SURU_SUPABASE_URL,
    window.SURU_SUPABASE_KEY
  );

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const money = (n) =>
    "NPR " + Number(n || 0).toLocaleString("en-IN");

  const esc = (s) =>
    String(s ?? "").replace(/[&<>'"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[c] || c));

  function msg(el, text, type = "") {
    if (!el) return;
    el.textContent = text;
    el.className = "message " + type;
  }

  /* =========================================================
     PRODUCT EDITOR STYLES
  ========================================================= */

  const editorStyles = document.createElement("style");

  editorStyles.textContent = `
    .product-card-admin {
      background: #fff;
      border: 1px solid #eaded8;
      border-radius: 15px;
      padding: 20px;
      box-shadow: 0 5px 20px rgba(70,35,40,.04);
    }

    .product-card-admin h3 {
      margin: 6px 0 5px;
      color: #76102f;
    }

    .product-card-admin > small {
      color: #806d70;
    }

    .product-card-admin .product-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 16px;
    }

    .product-edit-panel {
      margin-top: 18px;
      padding-top: 18px;
      border-top: 1px solid #eaded8;
    }

    .product-edit-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap: 14px;
    }

    .product-edit-grid .full {
      grid-column: 1 / -1;
    }

    .product-edit-grid label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: #62464d;
    }

    .product-edit-grid input,
    .product-edit-grid textarea,
    .product-edit-grid select {
      width: 100%;
      margin-top: 6px;
      border: 1px solid #ddd0cb;
      border-radius: 8px;
      background: #fff;
      color: #49363a;
      padding: 10px;
      font-family: inherit;
      font-size: 13px;
    }

    .product-edit-grid input {
      height: 40px;
    }

    .product-edit-grid textarea {
      resize: vertical;
      min-height: 90px;
    }

    .check-row {
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
      align-items: center;
      padding-top: 5px;
    }

    .check-row label {
      display: flex;
      align-items: center;
      gap: 7px;
      font-weight: 600;
    }

    .check-row input {
      width: auto;
      margin: 0;
    }

    .image-manager {
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid #eaded8;
    }

    .image-manager h4 {
      margin: 0 0 12px;
      color: #6f0f2d;
      font-size: 15px;
    }

    .image-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 12px;
    }

    .image-item {
      position: relative;
      border: 1px solid #eaded8;
      border-radius: 10px;
      padding: 8px;
      background: #fffaf7;
    }

    .image-item img {
      width: 100%;
      height: 170px;
      display: block;
      object-fit: cover;
      border-radius: 7px;
      background: #f5eee9;
    }

    .image-item-main {
      border: 2px solid #8d1236;
    }

    .image-item-info {
      padding: 8px 2px 2px;
    }

    .image-item-info small {
      display: block;
      color: #806d70;
      word-break: break-all;
      line-height: 1.35;
    }

    .image-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 8px;
      border-radius: 999px;
      background: #8d1236;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
    }

    .image-buttons {
      display: flex;
      gap: 5px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .image-buttons button {
      border: 1px solid #d8cbc6;
      background: #fff;
      color: #6d3041;
      border-radius: 7px;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 600;
    }

    .image-buttons button:hover {
      background: #f7eee9;
    }

    .image-buttons .danger {
      color: #a33a2d;
      border-color: #e2c4bf;
    }

    .add-image-row {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .add-image-row input {
      flex: 1;
      height: 40px;
      border: 1px solid #ddd0cb;
      border-radius: 8px;
      padding: 0 10px;
      font-family: inherit;
      min-width: 0;
    }

    .product-saving {
      opacity: .65;
      pointer-events: none;
    }

    .editor-message {
      margin-top: 10px;
      text-align: left;
    }

    @media (max-width: 700px) {
      .product-edit-grid {
        grid-template-columns: 1fr;
      }

      .product-edit-grid .full {
        grid-column: auto;
      }

      .image-list {
        grid-template-columns: repeat(2, minmax(0,1fr));
      }

      .image-item img {
        height: 150px;
      }
    }

    @media (max-width: 480px) {
      .image-list {
        grid-template-columns: 1fr;
      }

      .image-item img {
        height: 220px;
      }

      .add-image-row {
        flex-direction: column;
      }
    }
  `;

  document.head.appendChild(editorStyles);


  /* =========================================================
     ADMIN CHECK
  ========================================================= */

  async function isAdmin(session) {

    if (!session?.user?.id) {
      return {
        ok: false,
        error: "No active session."
      };
    }

    /*
      Check the signed-in user's own admin_users row directly.
      This avoids an auth-state/RPC timing issue that can send a
      valid admin back to the login screen. The RLS policy permits
      an authenticated user to read only their own admin record.
    */
    const { data, error } =
      await client
        .from("admin_users")
        .select("id,role,is_active")
        .eq("id", session.user.id)
        .maybeSingle();

    if (error) {
      return {
        ok: false,
        error:
          "Admin check failed: " +
          error.message
      };
    }

    const allowed =
      !!data &&
      data.is_active === true &&
      (data.role === "admin" || data.role === "manager");

    return {
      ok: allowed,
      error:
        allowed
          ? ""
          : "This account is not authorized for the admin panel."
    };
  }


  /* =========================================================
     START
  ========================================================= */

  async function start(sessionOverride = null) {

    try {

      const sessionResult =
        sessionOverride
          ? {
              data: {
                session: sessionOverride
              },
              error: null
            }
          : await client.auth.getSession();

      if (sessionResult.error) {
        throw sessionResult.error;
      }

      const session =
        sessionResult.data.session;

      if (!session) {

        $("#loginView")
          .classList.remove("hidden");

        $("#appView")
          .classList.add("hidden");

        return false;
      }

      const admin =
        await isAdmin(session);

      if (!admin.ok) {

        $("#loginView")
          .classList.remove("hidden");

        $("#appView")
          .classList.add("hidden");

        msg(
          $("#loginMessage"),
          admin.error ||
            "Admin authorization failed.",
          "error"
        );

        return false;
      }

      $("#loginView")
        .classList.add("hidden");

      $("#appView")
        .classList.remove("hidden");

      $("#userEmail").textContent =
        session.user.email || "";

      await loadDashboard();

      return true;

    } catch (err) {

      console.error(
        "Admin start error:",
        err
      );

      $("#loginView")
        .classList.remove("hidden");

      $("#appView")
        .classList.add("hidden");

      msg(
        $("#loginMessage"),
        "Connection error: " +
          (err?.message || err),
        "error"
      );

      return false;
    }
  }


  /* =========================================================
     AUTH
  ========================================================= */

  client.auth.onAuthStateChange(
    (event, session) => {

      if (event === "INITIAL_SESSION") {

        setTimeout(
          () => start(session),
          0
        );
      }

      if (event === "SIGNED_OUT") {

        $("#loginView")
          .classList.remove("hidden");

        $("#appView")
          .classList.add("hidden");
      }
    }
  );


  /* =========================================================
     LOGIN
  ========================================================= */

  $("#loginForm").addEventListener(
    "submit",
    async function (e) {

      e.preventDefault();

      const email =
        $("#loginEmail")
          .value
          .trim();

      const password =
        $("#loginPassword")
          .value;

      if (!email || !password) {

        msg(
          $("#loginMessage"),
          "Please enter email and password.",
          "error"
        );

        return;
      }

      msg(
        $("#loginMessage"),
        "Signing in…"
      );

      try {

        const {
          data,
          error
        } =
          await client.auth
            .signInWithPassword({
              email,
              password
            });

        if (error) {

          msg(
            $("#loginMessage"),
            error.message,
            "error"
          );

          return;
        }

        const ok =
          await start(data.session);

        if (ok) {
          $("#loginPassword").value = "";
        }

      } catch (err) {

        console.error(
          "Login error:",
          err
        );

        msg(
          $("#loginMessage"),
          err?.message ||
            "Login failed.",
          "error"
        );
      }
    }
  );


  /* =========================================================
     LOGOUT
  ========================================================= */

  $("#logoutBtn").onclick =
    async function () {

      await client.auth.signOut();

      location.reload();
    };


  /* =========================================================
     SIDEBAR
  ========================================================= */

  $$(".sidebar button")
    .forEach((button) => {

      button.addEventListener(
        "click",
        async function () {

          $$(".sidebar button")
            .forEach((x) =>
              x.classList.remove("active")
            );

          button.classList.add("active");

          $$(".view")
            .forEach((x) =>
              x.classList.remove("active")
            );

          const viewName =
            button.dataset.view;

          const view =
            document.getElementById(
              viewName
            );

          if (view) {
            view.classList.add("active");
          }

          if (viewName === "dashboard") {
            await loadDashboard();
          }

          if (viewName === "orders") {
            await loadOrders();
          }

          if (viewName === "products") {
            await loadProducts();
          }

          if (viewName === "inventory") {
            await loadInventory();
          }

          if (viewName === "customers") {
            await loadCustomers();
          }
        }
      );
    });


  /* =========================================================
     DASHBOARD
  ========================================================= */

  async function loadDashboard() {

    try {

      const [
        ordersResult,
        productsResult,
        pendingResult
      ] = await Promise.all([

        client
          .from("orders")
          .select("*", {
            count: "exact",
            head: true
          }),

        client
          .from("products")
          .select("*", {
            count: "exact",
            head: true
          })
          .eq("is_active", true),

        client
          .from("orders")
          .select(
            "id,order_number,customer_name,total,order_status,created_at"
          )
          .order("created_at", {
            ascending: false
          })
          .limit(5)
      ]);

      $("#statOrders").textContent =
        ordersResult.count ?? 0;

      $("#statProducts").textContent =
        productsResult.count ?? 0;

      const pending =
        pendingResult.data || [];

      $("#statPending").textContent =
        pending.filter(
          x =>
            x.order_status ===
            "pending"
        ).length;

      renderOrderTable(
        $("#recentOrders"),
        pending,
        false
      );

    } catch (err) {

      console.error(
        "Dashboard error:",
        err
      );
    }
  }


  /* =========================================================
     NCM SHIPPING INTEGRATION
  ========================================================= */

  let ncmBranches = [];
  let ncmBranchesLoaded = false;

  function ncmBranchOptions(selected = "", placeholder = "Select branch") {
    return `<option value="">${esc(placeholder)}</option>` +
      ncmBranches.map(b => {
        const name = b.name || b.branch_name || b.title || "";
        return `<option value="${esc(name)}" ${String(name).toLowerCase() === String(selected).toLowerCase() ? "selected" : ""}>${esc(name)}</option>`;
      }).join("");
  }

  function guessNcmBranch(order) {
    const hay = [order.city, order.district, order.province].filter(Boolean).join(" ").toLowerCase();
    return ncmBranches.find(b => {
      const name = String(b.name || b.branch_name || b.title || "").toLowerCase();
      return name && (hay.includes(name) || name.includes(String(order.city || "").toLowerCase()));
    })?.name || "";
  }

  async function ncmInvoke(body) {
    const result = await client.functions.invoke("ncm-admin", { body });
    if (result.error) {
      const detail = result.data?.error || result.error.message || "NCM function failed";
      throw new Error(detail);
    }
    if (result.data?.error) throw new Error(result.data.error);
    return result.data;
  }

  async function loadNcmBranches(showAlert = true) {
    const select = $("#ncmSourceBranch");
    if (select) select.disabled = true;
    try {
      const data = await ncmInvoke({ action: "branches" });
      ncmBranches = Array.isArray(data) ? data : (data?.branches || []);
      ncmBranchesLoaded = true;
      if (select) {
        const saved = localStorage.getItem("suru_ncm_source_branch") || "";
        select.innerHTML = ncmBranchOptions(saved, "NCM source branch");
        if (saved) select.value = saved;
      }
      if (showAlert) alert(`Loaded ${ncmBranches.length} NCM branches.`);
      if ($("#orders")) loadOrders();
    } catch (err) {
      if (showAlert) alert("NCM: " + err.message);
    } finally {
      if (select) select.disabled = false;
    }
  }

  $("#ncmLoadBranches")?.addEventListener("click", () => loadNcmBranches(true));

  $("#ncmSourceBranch")?.addEventListener("change", e => {
    localStorage.setItem("suru_ncm_source_branch", e.target.value || "");
  });

  $("#ncmConfigureWebhook")?.addEventListener("click", async () => {
    const btn = $("#ncmConfigureWebhook");
    btn.disabled = true;
    try {
      const data = await ncmInvoke({ action: "configure-webhook" });
      if (!data?.success) {
        alert("NCM webhook configuration failed. HTTP " + (data?.ncm_status || "?") + "\n\n" + JSON.stringify(data?.ncm_response || {}, null, 2));
        return;
      }
      alert("Nepal Can Move webhook configured successfully.");
    } catch (err) {
      alert("NCM webhook: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  $("#ncmTestWebhook")?.addEventListener("click", async () => {
    const btn = $("#ncmTestWebhook");
    btn.disabled = true;
    try {
      const data = await ncmInvoke({ action: "test-webhook" });
      if (!data?.success) {
        alert("NCM webhook test failed. HTTP " + (data?.ncm_status || "?") + "\n\n" + JSON.stringify(data?.ncm_response || {}, null, 2));
        return;
      }
      alert("NCM webhook test request was accepted.\n\n" + JSON.stringify(data?.ncm_response || {}, null, 2));
    } catch (err) {
      alert("NCM webhook test: " + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  /* =========================================================
     ORDERS
  ========================================================= */

  function renderOrderTable(
    el,
    rows,
    full = true
  ) {

    if (!rows.length) {

      el.innerHTML =
        '<p class="subscriber-count">No orders found.</p>';

      return;
    }

    el.innerHTML =
      `
      <table class="table">

        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Status</th>
            <th>Date</th>
            ${
              full
                ? "<th>Update</th><th>Nepal Can Move</th>"
                : ""
            }
          </tr>
        </thead>

        <tbody>

          ${rows.map((o) => `

            <tr>

              <td>
                <b>
                  ${esc(o.order_number)}
                </b>

                ${
                  full
                    ? `
                      <div
                        class="order-items"
                        data-items="${esc(o.id)}">
                      </div>
                    `
                    : ""
                }
              </td>

              <td>
                ${esc(o.customer_name)}
                <br>
                <small>
                  ${esc(
                    o.customer_phone ||
                    ""
                  )}
                </small>
              </td>

              <td>
                ${money(o.total)}
              </td>

              <td>
                <span class="badge">
                  ${esc(
                    o.order_status
                  )}
                </span>
              </td>

              <td>
                ${new Date(
                  o.created_at
                ).toLocaleString()}
              </td>

              ${
                full
                  ? `
                    <td>
                      <select
                        class="status-select"
                        data-id="${o.id}">

                        ${
                          [
                            "pending",
                            "confirmed",
                            "processing",
                            "shipped",
                            "delivered",
                            "cancelled"
                          ]
                            .map(
                              s =>
                                `<option ${
                                  s ===
                                  o.order_status
                                    ? "selected"
                                    : ""
                                }>${s}</option>`
                            )
                            .join("")
                        }

                      </select>
                    </td>
                    <td class="ncm-cell">
                      ${o.ncm_order_id
                        ? `<strong>NCM #${esc(o.ncm_order_id)}</strong><br><small>${esc(o.ncm_status || "created")}</small><br><button type="button" class="btn-secondary ncm-sync-btn" data-id="${o.id}">Sync</button>`
                        : `<select class="ncm-destination-branch" data-id="${o.id}">${ncmBranchOptions(guessNcmBranch(o), "Destination branch")}</select><button type="button" class="btn-primary ncm-create-btn" data-id="${o.id}">Create shipment</button>`}
                    </td>
                  `
                  : ""
              }

            </tr>

          `).join("")}

        </tbody>

      </table>
      `;

    if (full) {
      loadOrderItems(rows);
    }
  }


  async function loadOrderItems(rows) {

    const ids =
      rows.map(x => x.id);

    if (!ids.length) return;

    const { data } =
      await client
        .from("order_items")
        .select(
          "order_id,product_name,size,quantity"
        )
        .in("order_id", ids);

    (data || []).forEach(
      (item) => {

        const el =
          document.querySelector(
            `[data-items="${item.order_id}"]`
          );

        if (!el) return;

        el.textContent +=
          (
            el.textContent
              ? ", "
              : ""
          ) +
          `${item.product_name}` +
          `${
            item.size
              ? " (" +
                item.size +
                ")"
              : ""
          }` +
          ` × ${item.quantity}`;
      }
    );
  }


  async function loadOrders() {

    const search =
      $("#orderSearch")
        .value
        .trim();

    const status =
      $("#orderStatusFilter")
        .value;

    let query =
      client
        .from("orders")
        .select("*")
        .order("created_at", {
          ascending: false
        })
        .limit(100);

    if (status) {
      query =
        query.eq(
          "order_status",
          status
        );
    }

    if (search) {

      query =
        query.or(
          `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
        );
    }

    const {
      data,
      error
    } = await query;

    if (error) {

      $("#ordersTable").innerHTML =
        `<p class="message error">
          ${esc(error.message)}
        </p>`;

      return;
    }

    renderOrderTable(
      $("#ordersTable"),
      data || [],
      true
    );
  }


  $("#orderSearch")
    .addEventListener(
      "input",
      loadOrders
    );

  $("#orderStatusFilter")
    .addEventListener(
      "change",
      loadOrders
    );


  document.addEventListener("click", async function (e) {
    const createBtn = e.target.closest(".ncm-create-btn");
    const syncBtn = e.target.closest(".ncm-sync-btn");

    if (createBtn) {
      const orderId = createBtn.dataset.id;
      const source = $("#ncmSourceBranch")?.value || localStorage.getItem("suru_ncm_source_branch") || "";
      const destination = document.querySelector(`.ncm-destination-branch[data-id="${orderId}"]`)?.value || "";
      if (!source) return alert("Select the NCM source branch first.");
      if (!destination) return alert("Select the NCM destination branch for this order.");
      if (!confirm("Create this order in Nepal Can Move as a live shipment?")) return;
      createBtn.disabled = true;
      try {
        await ncmInvoke({ action: "create", order_id: orderId, source_branch: source, destination_branch: destination, delivery_type: "Door2Door", weight: "1" });
        alert("NCM shipment created successfully.");
        await loadOrders();
      } catch (err) {
        alert("NCM: " + err.message);
      } finally {
        createBtn.disabled = false;
      }
      return;
    }

    if (syncBtn) {
      const orderId = syncBtn.dataset.id;
      syncBtn.disabled = true;
      try {
        await ncmInvoke({ action: "sync", order_id: orderId });
        await loadOrders();
      } catch (err) {
        alert("NCM sync: " + err.message);
      } finally {
        syncBtn.disabled = false;
      }
    }
  });


  /* =========================================================
     ORDER STATUS
  ========================================================= */

  document.addEventListener(
    "change",
    async function (e) {

      if (
        !e.target.matches(
          ".status-select"
        )
      ) {
        return;
      }

      const id =
        e.target.dataset.id;

      const status =
        e.target.value;

      e.target.disabled = true;

      const { error } =
        await client
          .from("orders")
          .update({
            order_status:
              status
          })
          .eq("id", id);

      e.target.disabled = false;

      if (error) {
        alert(error.message);
      }
    }
  );


  /* =========================================================
     PRODUCTS
  ========================================================= */

  async function loadProducts() {

    const container =
      $("#productsGrid");

    if (!container) return;

    container.innerHTML =
      '<p class="subscriber-count">Loading products…</p>';

    try {

      const {
        data,
        error
      } =
        await client
          .from("products")
          .select("*")
          .order("created_at", {
            ascending: false
          });

      if (error) {

        container.innerHTML =
          `<p class="message error">
            ${esc(error.message)}
          </p>`;

        return;
      }

      if (!data?.length) {

        container.innerHTML =
          '<p class="subscriber-count">No products found.</p>';

        return;
      }

      container.innerHTML =
        `<div class="product-grid">
          ${
            data
              .map(renderProductCard)
              .join("")
          }
        </div>`;

    } catch (err) {

      console.error(
        "Products error:",
        err
      );

      container.innerHTML =
        `<p class="message error">
          ${esc(
            err?.message ||
            "Unable to load products."
          )}
        </p>`;
    }
  }


  function renderProductCard(p) {

    return `
      <div
        class="product-card-admin"
        data-product-card="${p.id}">

        <small>
          ${esc(
            p.product_code || ""
          )}
          ·
          ${esc(
            p.category || ""
          )}
        </small>

        <h3>
          ${esc(
            p.name || ""
          )}
        </h3>

        <div>
          <b>
            ${money(p.price)}
          </b>

          &nbsp; · &nbsp;

          MOQ:
          ${esc(p.moq)}
        </div>

        <div style="margin-top:8px">

          <span class="badge ${
            p.is_active
              ? "active"
              : "inactive"
          }">
            ${
              p.is_active
                ? "Active"
                : "Inactive"
            }
          </span>

          ${
            p.is_featured
              ? `
                <span class="badge">
                  Featured
                </span>
              `
              : ""
          }

        </div>

        <div class="product-actions">

          <button
            class="primary edit-product"
            data-id="${p.id}"
            type="button">

            Edit Product

          </button>

        </div>

        <div
          class="product-edit-panel hidden"
          id="editor-${p.id}">

          <p class="subscriber-count">
            Loading product details…
          </p>

        </div>

      </div>
    `;
  }


  /* =========================================================
     OPEN PRODUCT EDITOR
  ========================================================= */

  document.addEventListener(
    "click",
    async function (e) {

      const button =
        e.target.closest(
          ".edit-product"
        );

      if (!button) return;

      const id =
        button.dataset.id;

      const panel =
        $("#editor-" + id);

      if (!panel) return;

      if (
        !panel.classList.contains(
          "hidden"
        )
      ) {

        panel.classList.add(
          "hidden"
        );

        button.textContent =
          "Edit Product";

        return;
      }

      panel.classList.remove(
        "hidden"
      );

      button.textContent =
        "Close Editor";

      await loadProductEditor(
        id
      );
    }
  );


  /* =========================================================
     LOAD PRODUCT EDITOR
  ========================================================= */

  async function loadProductEditor(
    productId
  ) {

    const panel =
      $("#editor-" + productId);

    panel.innerHTML =
      '<p class="subscriber-count">Loading product details…</p>';

    try {

      const [
        productResult,
        imagesResult
      ] = await Promise.all([

        client
          .from("products")
          .select("*")
          .eq("id", productId)
          .single(),

        client
          .from("product_images")
          .select("*")
          .eq("product_id", productId)
          .order("sort_order", {
            ascending: true
          })
      ]);

      if (productResult.error) {
        throw productResult.error;
      }

      if (imagesResult.error) {
        throw imagesResult.error;
      }

      const product =
        productResult.data;

      const images =
        imagesResult.data || [];

      panel.innerHTML =
        renderProductEditor(
          product,
          images
        );

    } catch (err) {

      console.error(
        "Product editor error:",
        err
      );

      panel.innerHTML =
        `<p class="message error">
          ${esc(
            err?.message ||
            "Unable to load product."
          )}
        </p>`;
    }
  }


  function renderProductEditor(
    p,
    images
  ) {

    return `

      <div class="product-edit-grid">

        <label>
          Product Code

          <input
            id="edit-code-${p.id}"
            value="${esc(
              p.product_code || ""
            )}">
        </label>

        <label>
          Product Name

          <input
            id="edit-name-${p.id}"
            value="${esc(
              p.name || ""
            )}">
        </label>

        <label>
          Category

          <input
            id="edit-category-${p.id}"
            value="${esc(
              p.category || ""
            )}">
        </label>

        <label>
          Price (NPR)

          <input
            id="edit-price-${p.id}"
            type="number"
            min="0"
            step="0.01"
            value="${Number(
              p.price || 0
            )}">
        </label>

        <label>
          MOQ

          <input
            id="edit-moq-${p.id}"
            type="number"
            min="0"
            value="${Number(
              p.moq || 0
            )}">
        </label>

        <label>
          Fabric

          <input
            id="edit-fabric-${p.id}"
            value="${esc(
              p.fabric || ""
            )}">
        </label>

        <label>
          Color

          <input
            id="edit-color-${p.id}"
            value="${esc(
              p.color || ""
            )}">
        </label>

        <label>
          Pattern

          <input
            id="edit-pattern-${p.id}"
            value="${esc(
              p.pattern || ""
            )}">
        </label>

        <label class="full">
          Description

          <textarea
            id="edit-description-${p.id}"
            rows="5">${esc(
              p.description || ""
            )}</textarea>
        </label>

        <div class="full check-row">

          <label>
            <input
              id="edit-active-${p.id}"
              type="checkbox"
              ${
                p.is_active
                  ? "checked"
                  : ""
              }>

            Active on website
          </label>

          <label>
            <input
              id="edit-featured-${p.id}"
              type="checkbox"
              ${
                p.is_featured
                  ? "checked"
                  : ""
              }>

            Featured product
          </label>

        </div>

        <div class="full">

          <button
            class="primary save-product-details"
            data-id="${p.id}"
            type="button">

            Save Product Details

          </button>

          <span
            class="message editor-message"
            id="edit-message-${p.id}">
          </span>

        </div>

      </div>

      <div class="image-manager">

        <h4>
          Product Images
        </h4>

        <p class="form-note">
          Add public image URLs. The image marked
          <b>Main</b> is used as the primary product image.
        </p>

        <div
          class="image-list"
          id="image-list-${p.id}">

          ${
            images.length
              ? images
                  .map(
                    img =>
                      renderImageItem(
                        img,
                        p.id
                      )
                  )
                  .join("")
              : `
                <p class="subscriber-count">
                  No images added yet.
                </p>
              `
          }

        </div>

        <div class="add-image-row">

          <input
            id="new-image-${p.id}"
            type="url"
            placeholder="https://example.com/product-image.jpg">

          <button
            class="primary add-product-image"
            data-id="${p.id}"
            type="button">

            + Add Image

          </button>

        </div>

        <span
          class="message editor-message"
          id="image-message-${p.id}">
        </span>

      </div>
    `;
  }


  /* =========================================================
     IMAGE ITEM
  ========================================================= */

  function renderImageItem(
    image,
    productId
  ) {

    return `
      <div
        class="image-item ${
          image.is_main
            ? "image-item-main"
            : ""
        }"
        data-image-id="${image.id}">

        <img
          src="${esc(image.image_url)}"
          alt="${esc(
            image.alt_text || ""
          )}"
          loading="lazy"
          onerror="this.style.opacity='.35'">

        <div class="image-item-info">

          <small>
            ${esc(
              image.image_url
            )}
          </small>

          ${
            image.is_main
              ? `
                <span class="image-badge">
                  MAIN IMAGE
                </span>
              `
              : ""
          }

        </div>

        <div class="image-buttons">

          ${
            image.is_main
              ? ""
              : `
                <button
                  class="set-main-image"
                  data-image="${image.id}"
                  data-product="${productId}"
                  type="button">
                  Set Main
                </button>
              `
          }

          <button
            class="move-image-up"
            data-image="${image.id}"
            data-product="${productId}"
            type="button">
            ↑
          </button>

          <button
            class="move-image-down"
            data-image="${image.id}"
            data-product="${productId}"
            type="button">
            ↓
          </button>

          <button
            class="danger delete-product-image"
            data-image="${image.id}"
            data-product="${productId}"
            type="button">
            Delete
          </button>

        </div>

      </div>
    `;
  }


  /* =========================================================
     SAVE PRODUCT DETAILS
  ========================================================= */

  document.addEventListener(
    "click",
    async function (e) {

      const button =
        e.target.closest(
          ".save-product-details"
        );

      if (!button) return;

      const id =
        button.dataset.id;

      const message =
        $("#edit-message-" + id);

      const payload = {

        product_code:
          $("#edit-code-" + id)
            .value
            .trim()
            .toUpperCase(),

        name:
          $("#edit-name-" + id)
            .value
            .trim(),

        category:
          $("#edit-category-" + id)
            .value
            .trim(),

        price:
          Number(
            $("#edit-price-" + id)
              .value
          ),

        moq:
          Math.max(
            0,
            Number(
              $("#edit-moq-" + id)
                .value
            )
          ),

        fabric:
          $("#edit-fabric-" + id)
            .value
            .trim() || null,

        color:
          $("#edit-color-" + id)
            .value
            .trim() || null,

        pattern:
          $("#edit-pattern-" + id)
            .value
            .trim() || null,

        description:
          $("#edit-description-" + id)
            .value
            .trim() || null,

        is_active:
          $("#edit-active-" + id)
            .checked,

        is_featured:
          $("#edit-featured-" + id)
            .checked
      };

      if (
        !payload.product_code ||
        !payload.name ||
        !payload.category
      ) {

        msg(
          message,
          "Product code, name and category are required.",
          "error"
        );

        return;
      }

      button.disabled = true;

      msg(
        message,
        "Saving…"
      );

      const {
        error
      } =
        await client
          .from("products")
          .update(payload)
          .eq("id", id);

      button.disabled = false;

      if (error) {

        msg(
          message,
          "Save failed: " +
            error.message,
          "error"
        );

        return;
      }

      msg(
        message,
        "Product details saved successfully.",
        "success"
      );

      await loadProducts();
    }
  );


  /* =========================================================
     ADD IMAGE
  ========================================================= */

  document.addEventListener(
    "click",
    async function (e) {

      const button =
        e.target.closest(
          ".add-product-image"
        );

      if (!button) return;

      const productId =
        button.dataset.id;

      const input =
        $("#new-image-" + productId);

      const message =
        $("#image-message-" + productId);

      const url =
        input.value.trim();

      if (!url) {

        msg(
          message,
          "Please enter an image URL.",
          "error"
        );

        return;
      }

      try {

        new URL(url);

      } catch {

        msg(
          message,
          "Please enter a valid image URL.",
          "error"
        );

        return;
      }

      button.disabled = true;

      msg(
        message,
        "Adding image…"
      );

      const {
        data: existing,
        error: existingError
      } =
        await client
          .from("product_images")
          .select(
            "id,sort_order,is_main"
          )
          .eq(
            "product_id",
            productId
          )
          .order(
            "sort_order",
            {
              ascending: false
            }
          )
          .limit(1);

      if (existingError) {

        button.disabled = false;

        msg(
          message,
          existingError.message,
          "error"
        );

        return;
      }

      const last =
        existing?.[0];

      const nextOrder =
        last
          ? Number(
              last.sort_order || 0
            ) + 1
          : 0;

      const isMain =
        !existing?.length;

      const {
        error
      } =
        await client
          .from("product_images")
          .insert({
            product_id:
              productId,

            image_url:
              url,

            alt_text:
              "Suru Collection",

            sort_order:
              nextOrder,

            is_main:
              isMain
          });

      button.disabled = false;

      if (error) {

        msg(
          message,
          "Image failed: " +
            error.message,
          "error"
        );

        return;
      }

      input.value = "";

      msg(
        message,
        "Image added.",
        "success"
      );

      await loadProductEditor(
        productId
      );
    }
  );


  /* =========================================================
     SET MAIN IMAGE
  ========================================================= */

  document.addEventListener(
    "click",
    async function (e) {

      const button =
        e.target.closest(
          ".set-main-image"
        );

      if (!button) return;

      const imageId =
        button.dataset.image;

      const productId =
        button.dataset.product;

      const message =
        $("#image-message-" + productId);

      button.disabled = true;

      try {

        /*
         * First remove main flag
         * from all images of this product.
         */

        const {
          error: clearError
        } =
          await client
            .from("product_images")
            .update({
              is_main: false
            })
            .eq(
              "product_id",
              productId
            );

        if (clearError) {
          throw clearError;
        }

        /*
         * Then make selected image main.
         */

        const {
          error
        } =
          await client
            .from("product_images")
            .update({
              is_main: true,
              sort_order: 0
            })
            .eq(
              "id",
              imageId
            );

        if (error) {
          throw error;
        }

        /*
         * Re-number remaining images.
         */

        const {
          data: images
        } =
          await client
            .from("product_images")
            .select("id,is_main")
            .eq(
              "product_id",
              productId
            )
            .order(
              "is_main",
              {
                ascending: false
              }
            )
            .order(
              "created_at",
              {
                ascending: true
              }
            );

        if (images) {

          for (
            let i = 0;
            i < images.length;
            i++
          ) {

            await client
              .from(
                "product_images"
              )
              .update({
                sort_order: i
              })
              .eq(
                "id",
                images[i].id
              );
          }
        }

        msg(
          message,
          "Main image updated.",
          "success"
        );

        await loadProductEditor(
          productId
        );

      } catch (err) {

        msg(
          message,
          err?.message ||
            "Unable to set main image.",
          "error"
        );

      } finally {

        button.disabled = false;
      }
    }
  );


  /* =========================================================
     DELETE IMAGE
  ========================================================= */

  document.addEventListener(
    "click",
    async function (e) {

      const button =
        e.target.closest(
          ".delete-product-image"
        );

      if (!button) return;

      const imageId =
        button.dataset.image;

      const productId =
        button.dataset.product;

      if (
        !confirm(
          "Delete this product image?"
        )
      ) {
        return;
      }

      const message =
        $("#image-message-" + productId);

      button.disabled = true;

      const {
        data: image
      } =
        await client
          .from("product_images")
          .select(
            "id,is_main"
          )
          .eq(
            "id",
            imageId
          )
          .single();

      const {
        error
      } =
        await client
          .from("product_images")
          .delete()
          .eq(
            "id",
            imageId
          );

      if (error) {

        msg(
          message,
          "Delete failed: " +
            error.message,
          "error"
        );

        button.disabled = false;

        return;
      }

      /*
       * If the deleted image was Main,
       * automatically promote the first
       * remaining image.
       */

      if (image?.is_main) {

        const {
          data: remaining
        } =
          await client
            .from("product_images")
            .select(
              "id"
            )
            .eq(
              "product_id",
              productId
            )
            .order(
              "sort_order",
              {
                ascending: true
              }
            )
            .limit(1);

        if (remaining?.[0]) {

          await client
            .from("product_images")
            .update({
              is_main: true,
              sort_order: 0
            })
            .eq(
              "id",
              remaining[0].id
            );
        }
      }

      msg(
        message,
        "Image deleted.",
        "success"
      );

      await loadProductEditor(
        productId
      );
    }
  );


  /* =========================================================
     MOVE IMAGE UP / DOWN
  ========================================================= */

  document.addEventListener(
    "click",
    async function (e) {

      const up =
        e.target.closest(
          ".move-image-up"
        );

      const down =
        e.target.closest(
          ".move-image-down"
        );

      if (!up && !down) return;

      const button =
        up || down;

      const imageId =
        button.dataset.image;

      const productId =
        button.dataset.product;

      const {
        data: images,
        error
      } =
        await client
          .from("product_images")
          .select(
            "id,sort_order,is_main"
          )
          .eq(
            "product_id",
            productId
          )
          .order(
            "sort_order",
            {
              ascending: true
            }
          );

      if (error) {

        alert(error.message);
        return;
      }

      const index =
        images.findIndex(
          x =>
            x.id === imageId
        );

      if (index < 0) return;

      const newIndex =
        up
          ? index - 1
          : index + 1;

      if (
        newIndex < 0 ||
        newIndex >= images.length
      ) {
        return;
      }

      /*
       * Swap order values.
       */

      const current =
        images[index];

      const target =
        images[newIndex];

      await client
        .from("product_images")
        .update({
          sort_order:
            target.sort_order
        })
        .eq(
          "id",
          current.id
        );

      await client
        .from("product_images")
        .update({
          sort_order:
            current.sort_order
        })
        .eq(
          "id",
          target.id
        );

      /*
       * Keep exactly one Main image.
       * If the main image is moved,
       * its main status remains.
       */

      await loadProductEditor(
        productId
      );
    }
  );


  /* =========================================================
     ADD PRODUCT
  ========================================================= */

  const toggleAddProduct =
    $("#toggleAddProduct");

  const addProductCard =
    $("#addProductCard");

  const cancelAddProduct =
    $("#cancelAddProduct");

  const addProductForm =
    $("#addProductForm");


  toggleAddProduct?.addEventListener(
    "click",
    () => {

      addProductCard
        .classList
        .toggle("hidden");
    }
  );


  cancelAddProduct?.addEventListener(
    "click",
    () => {

      addProductCard
        .classList
        .add("hidden");

      addProductForm.reset();

      $("#newMoq").value = 1;

      $("#newActive")
        .checked = true;

      msg(
        $("#addProductMessage"),
        ""
      );
    }
  );


  function slugify(value) {

    return String(
      value || ""
    )
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );
  }


  function numOrNull(value) {

    const text =
      String(
        value ?? ""
      ).trim();

    if (!text) {
      return null;
    }

    const n =
      Number(text);

    return Number.isFinite(n)
      ? n
      : null;
  }


  addProductForm?.addEventListener(
    "submit",
    async function (e) {

      e.preventDefault();

      const message =
        $("#addProductMessage");

      msg(
        message,
        "Adding product…"
      );

      const code =
        $("#newCode")
          .value
          .trim()
          .toUpperCase();

      const name =
        $("#newName")
          .value
          .trim();

      const category =
        $("#newCategory")
          .value
          .trim();

      const price =
        Number(
          $("#newPrice")
            .value
        );

      const moq =
        Math.max(
          0,
          parseInt(
            $("#newMoq")
              .value || 1,
            10
          )
        );

      if (
        !code ||
        !name ||
        !category ||
        !Number.isFinite(price)
      ) {

        msg(
          message,
          "Please complete product code, name, category and price.",
          "error"
        );

        return;
      }

      const payload = {

        product_code:
          code,

        name:
          name,

        slug:
          slugify(
            code +
            "-" +
            name
          ),

        category:
          category,

        description:
          $("#newDescription")
            .value
            .trim() || null,

        price:
          price,

        moq:
          moq,

        fabric:
          $("#newFabric")
            .value
            .trim() || null,

        color:
          $("#newColor")
            .value
            .trim() || null,

        pattern:
          $("#newPattern")
            .value
            .trim() || null,

        is_active:
          $("#newActive")
            .checked,

        is_featured:
          $("#newFeatured")
            .checked
      };

      const {
        data: product,
        error
      } =
        await client
          .from("products")
          .insert(payload)
          .select("id")
          .single();

      if (error) {

        msg(
          message,
          "Product failed: " +
            error.message,
          "error"
        );

        return;
      }

      try {

        /*
         * Images
         */

        const urls =
          $("#newImages")
            .value
            .split(/\r?\n/)
            .map(
              x => x.trim()
            )
            .filter(Boolean);

        if (urls.length) {

          const rows =
            urls.map(
              (url, i) => ({

                product_id:
                  product.id,

                image_url:
                  url,

                alt_text:
                  name,

                sort_order:
                  i,

                is_main:
                  i === 0
              })
            );

          const {
            error:
              imageError
          } =
            await client
              .from(
                "product_images"
              )
              .insert(rows);

          if (imageError) {
            throw imageError;
          }
        }


        /*
         * Sizes
         */

        const sizeRows =
          $("#newSizes")
            .value
            .split(/\r?\n/)
            .map(
              x => x.trim()
            )
            .filter(Boolean)
            .map(
              line =>
                line
                  .split(",")
                  .map(
                    x =>
                      x.trim()
                  )
            );

        if (sizeRows.length) {

          const rows =
            sizeRows
              .map(
                r => {

                  /*
                   * 10-column variant format:
                   * size,color,bust,waist,hip,shoulder,
                   * top_length,bottom_length,dupatta_length,stock
                   *
                   * 9-column legacy format:
                   * size,bust,waist,hip,shoulder,top_length,
                   * bottom_length,dupatta_length,stock
                   */

                  const variantFormat =
                    r.length >= 10;

                  const offset =
                    variantFormat
                      ? 2
                      : 1;

                  const stockIndex =
                    variantFormat
                      ? 9
                      : 8;

                  return {

                    product_id:
                      product.id,

                    size:
                      r[0] || null,

                    color:
                      variantFormat
                        ? (r[1] || null)
                        : null,

                    bust:
                      numOrNull(
                        r[offset]
                      ),

                    waist:
                      numOrNull(
                        r[offset + 1]
                      ),

                    hip:
                      numOrNull(
                        r[offset + 2]
                      ),

                    shoulder:
                      numOrNull(
                        r[offset + 3]
                      ),

                    top_length:
                      numOrNull(
                        r[offset + 4]
                      ),

                    bottom_length:
                      numOrNull(
                        r[offset + 5]
                      ),

                    dupatta_length:
                      numOrNull(
                        r[offset + 6]
                      ),

                    unit:
                      "in",

                    stock:
                      Math.max(
                        0,
                        parseInt(
                          r[stockIndex] || 0,
                          10
                        )
                      ),

                    is_active:
                      true
                  };
                }
              )
              .filter(
                r =>
                  Boolean(r.size) ||
                  Boolean(r.color) ||
                  r.stock > 0
              );

          if (rows.length) {

            const {
              error:
                sizeError
            } =
              await client
                .from(
                  "product_sizes"
                )
                .insert(rows);

            if (sizeError) {
              throw sizeError;
            }
          }
        }

      } catch (err) {

        /*
         * Roll product back if image
         * or size insertion fails.
         */

        await client
          .from("products")
          .delete()
          .eq(
            "id",
            product.id
          );

        msg(
          message,
          "Product was rolled back because image/size data failed: " +
            err.message,
          "error"
        );

        return;
      }

      msg(
        message,
        "Product added successfully.",
        "success"
      );

      addProductForm.reset();

      $("#newMoq")
        .value = 1;

      $("#newActive")
        .checked = true;

      await loadProducts();
    }
  );


  /* =========================================================
     INVENTORY
  ========================================================= */

  async function loadInventory(){
  const {data,error}=await client
    .from('products')
    .select('id,product_code,name,product_sizes(id,size,color,stock,is_active)')
    .order('product_code');

  if(error){
    $('#inventoryGrid').innerHTML=
      `<div class="card">
        <p class="message error">${esc(error.message)}</p>
      </div>`;
    return;
  }

  const sizeOrder={
    'XS':1,
    'S':2,
    'M':3,
    'L':4,
    'XL':5,
    'XXL':6,
    'XXXL':7,
    'XXXXL':8
  };

  $('#inventoryGrid').innerHTML=(data||[]).map(p=>{

    const sizes=(p.product_sizes||[])
      .sort((a,b)=>{
        const aSize=String(a.size||'').trim().toUpperCase();
        const bSize=String(b.size||'').trim().toUpperCase();

        return (sizeOrder[aSize]||999)-(sizeOrder[bSize]||999);
      });

    return `
      <div class="card">
        <h3>${esc(p.product_code)} — ${esc(p.name)}</h3>

        <div class="stock-list">

          ${
            sizes.map(s=>`
              <div class="stock-row">

                <span>
                  <b>${esc(s.size || '—')}</b>
                  ${
                    s.color
                      ? `<small class="stock-color">${esc(s.color)}</small>`
                      : ""
                  }
                </span>

                <input
                  type="number"
                  min="0"
                  value="${s.stock}"
                  data-stock="${s.id}"
                  data-old="${s.stock}"
                >

                <button
                  class="primary save-stock"
                  data-id="${s.id}"
                  data-product="${p.id}"
                >
                  Save
                </button>

              </div>
            `).join('')
          || '<p class="subscriber-count">No sizes configured.</p>'}

        </div>
      </div>
    `;
  }).join('');
}


  /* =========================================================
     SAVE STOCK
  ========================================================= */

  document.addEventListener(
    "click",
    async function (e) {

      const button =
        e.target.closest(
          ".save-stock"
        );

      if (!button) return;

      const input =
        document.querySelector(
          `[data-stock="${button.dataset.id}"]`
        );

      const old =
        Number(
          input.dataset.old
        );

      const stock =
        Math.max(
          0,
          parseInt(
            input.value || 0,
            10
          )
        );

      const {
        error
      } =
        await client
          .from(
            "product_sizes"
          )
          .update({
            stock
          })
          .eq(
            "id",
            button.dataset.id
          );

      if (error) {

        alert(
          error.message
        );

        return;
      }

      const diff =
        stock - old;

      if (diff) {

        await client
          .from(
            "inventory_movements"
          )
          .insert({

            product_id:
              button.dataset.product,

            size_id:
              button.dataset.id,

            quantity_change:
              diff,

            reason:
              "admin_stock_adjustment"
          });
      }

      input.dataset.old =
        stock;

      button.textContent =
        "Saved";

      setTimeout(
        () =>
          button.textContent =
            "Save",
        1000
      );
    }
  );



  /* =========================================================
     INITIAL START
  ========================================================= */

  start();

});
/* =====================================================
   CUSTOMER MANAGEMENT
===================================================== */

let customerRows = [];


/* =====================================================
   LOAD CUSTOMERS
===================================================== */

async function loadCustomers() {

  const table = document.getElementById(
    "customersTable"
  );

  if (table) {

    table.innerHTML = `
      <div class="loading">
        Loading customers...
      </div>
    `;

  }

  const {
    data,
    error
  } = await client
    .from("customers")
    .select(`
      id,
      auth_user_id,
      name,
      phone,
      email,
      address,
      city,
      district,
      province,
      postal_code,
      is_active,
      created_at
    `)
    .order(
      "created_at",
      {
        ascending: false
      }
    );

  if (error) {

    if (table) {

      table.innerHTML = `
        <div class="error">
          ${error.message}
        </div>
      `;

    }

    console.error(
      "Customer loading error:",
      error
    );

    return;
  }

  customerRows =
    data || [];

  renderCustomers();
}


/* =====================================================
   RENDER CUSTOMER LIST
===================================================== */

function renderCustomers() {

  const container =
    document.getElementById(
      "customersTable"
    );

  if (!container) {
    return;
  }

  const search =
    (
      document.getElementById(
        "customerSearch"
      )?.value || ""
    )
      .trim()
      .toLowerCase();

  const status =
    document.getElementById(
      "customerStatusFilter"
    )?.value || "all";


  const rows =
    customerRows.filter(
      customer => {

        const searchable = [

          customer.name,

          customer.phone,

          customer.email,

          customer.city,

          customer.district

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


        const matchesSearch =
          !search ||
          searchable.includes(
            search
          );


        const matchesStatus =
          status === "all" ||

          (
            status === "active" &&
            customer.is_active
          ) ||

          (
            status === "inactive" &&
            !customer.is_active
          );


        return (
          matchesSearch &&
          matchesStatus
        );

      }
    );


  if (!rows.length) {

    container.innerHTML = `
      <div class="empty">
        No customers found.
      </div>
    `;

    return;
  }


  container.innerHTML = `

    <div class="table-wrap">

      <table class="data-table">

        <thead>

          <tr>

            <th>Name</th>

            <th>Phone</th>

            <th>Location</th>

            <th>Status</th>

            <th>Joined</th>

            <th>Actions</th>

          </tr>

        </thead>

        <tbody>

          ${rows.map(customer => `

            <tr>

              <td>

                <strong>
                  ${escapeHtml(
                    customer.name ||
                    "—"
                  )}
                </strong>

              </td>


              <td>

                ${escapeHtml(
                  customer.phone ||
                  "—"
                )}

              </td>


              <td>

                ${
                  [
                    customer.city,
                    customer.district
                  ]
                    .filter(Boolean)
                    .map(escapeHtml)
                    .join(", ") ||
                  "—"
                }

              </td>


              <td>

                <span class="status-badge">

                  ${
                    customer.is_active
                      ? "Active"
                      : "Inactive"
                  }

                </span>

              </td>


              <td>

                ${
                  customer.created_at
                    ? new Date(
                        customer.created_at
                      ).toLocaleDateString()
                    : "—"
                }

              </td>


              <td>

                <div class="table-actions">

                  <button
                    class="secondary customer-view"
                    data-id="${customer.id}"
                  >
                    View
                  </button>


                  <button
                    class="danger customer-toggle"
                    data-id="${customer.id}"
                  >

                    ${
                      customer.is_active
                        ? "Deactivate"
                        : "Activate"
                    }

                  </button>

                </div>

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>

  `;
}


/* =====================================================
   CUSTOMER DETAILS
===================================================== */

async function showCustomer(id) {

  const customer =
    customerRows.find(
      item =>
        item.id === id
    );

  if (!customer) {
    return;
  }


  const card =
    document.getElementById(
      "customerDetailsCard"
    );

  if (!card) {
    return;
  }


  card.hidden = false;

  card.innerHTML = `
    <div class="card">

      <div class="card-header">

        <div>

          <h3>
            ${escapeHtml(
              customer.name ||
              "Customer"
            )}
          </h3>

          <p>
            Customer details
          </p>

        </div>

        <button
          class="secondary"
          id="closeCustomerDetails"
        >
          Close
        </button>

      </div>


      <div class="customer-profile-grid">

        <div>

          <b>Name</b>

          <span>
            ${escapeHtml(
              customer.name ||
              "—"
            )}
          </span>

        </div>


        <div>

          <b>Phone</b>

          <span>
            ${escapeHtml(
              customer.phone ||
              "—"
            )}
          </span>

        </div>


        <div>

          <b>Email</b>

          <span>
            ${escapeHtml(
              customer.email ||
              "—"
            )}
          </span>

        </div>


        <div>

          <b>Status</b>

          <span>
            ${
              customer.is_active
                ? "Active"
                : "Inactive"
            }
          </span>

        </div>


        <div>

          <b>Address</b>

          <span>
            ${escapeHtml(
              customer.address ||
              "—"
            )}
          </span>

        </div>


        <div>

          <b>City</b>

          <span>
            ${escapeHtml(
              customer.city ||
              "—"
            )}
          </span>

        </div>


        <div>

          <b>District</b>

          <span>
            ${escapeHtml(
              customer.district ||
              "—"
            )}
          </span>

        </div>


        <div>

          <b>Province</b>

          <span>
            ${escapeHtml(
              customer.province ||
              "—"
            )}
          </span>

        </div>


        <div>

          <b>Postal Code</b>

          <span>
            ${escapeHtml(
              customer.postal_code ||
              "—"
            )}
          </span>

        </div>


        <div>

          <b>Joined</b>

          <span>
            ${
              customer.created_at
                ? new Date(
                    customer.created_at
                  ).toLocaleString()
                : "—"
            }
          </span>

        </div>

      </div>


      <h3 class="customer-orders-heading">
        Order History
      </h3>

      <div id="customerOrders">
        Loading orders...
      </div>

    </div>
  `;


  document
    .getElementById(
      "closeCustomerDetails"
    )
    ?.addEventListener(
      "click",
      () => {

        card.hidden = true;

        card.innerHTML = "";

      }
    );


  /* =====================================================
     LOAD CUSTOMER ORDERS
  ===================================================== */

  const {
    data: orders,
    error
  } = await client
    .from("orders")
    .select(`
      id,
      order_number,
      total,
      payment_method,
      payment_status,
      order_status,
      created_at
    `)
    .eq(
      "customer_id",
      customer.id
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  const ordersContainer =
    document.getElementById(
      "customerOrders"
    );


  if (!ordersContainer) {
    return;
  }


  if (error) {

    ordersContainer.innerHTML = `
      <div class="error">
        ${escapeHtml(
          error.message
        )}
      </div>
    `;

    return;
  }


  if (!orders?.length) {

    ordersContainer.innerHTML = `
      <p>
        No orders found for this customer.
      </p>
    `;

    return;
  }


  const totalSpent =
    orders.reduce(
      (
        total,
        order
      ) =>
        total +
        Number(
          order.total || 0
        ),
      0
    );


  ordersContainer.innerHTML = `

    <div class="stats-grid">

      <div class="stat-card">

        <span>
          Total Orders
        </span>

        <strong>
          ${orders.length}
        </strong>

      </div>


      <div class="stat-card">

        <span>
          Total Spent
        </span>

        <strong>
          NPR ${totalSpent.toLocaleString(
            "en-IN"
          )}
        </strong>

      </div>

    </div>


    <div class="table-wrap">

      <table class="data-table">

        <thead>

          <tr>

            <th>Order</th>

            <th>Date</th>

            <th>Total</th>

            <th>Payment</th>

            <th>Status</th>

          </tr>

        </thead>


        <tbody>

          ${orders.map(order => `

            <tr>

              <td>
                ${escapeHtml(
                  order.order_number ||
                  "—"
                )}
              </td>

              <td>
                ${
                  order.created_at
                    ? new Date(
                        order.created_at
                      ).toLocaleString()
                    : "—"
                }
              </td>

              <td>
                NPR ${
                  Number(
                    order.total || 0
                  ).toLocaleString(
                    "en-IN"
                  )
                }
              </td>

              <td>

                ${
                  escapeHtml(
                    order.payment_method ||
                    "—"
                  )
                }

                <br>

                <small>
                  ${
                    escapeHtml(
                      order.payment_status ||
                      ""
                    )
                  }
                </small>

              </td>

              <td>
                ${
                  escapeHtml(
                    order.order_status ||
                    "pending"
                  )
                }
              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>

  `;
}


/* =====================================================
   ACTIVATE / DEACTIVATE CUSTOMER
===================================================== */

async function toggleCustomer(id) {

  const customer =
    customerRows.find(
      item =>
        item.id === id
    );

  if (!customer) {
    return;
  }


  const newStatus =
    !customer.is_active;


  const action =
    newStatus
      ? "activate"
      : "deactivate";


  if (
    !confirm(
      `Are you sure you want to ${action} this customer?`
    )
  ) {

    return;

  }


  const {
    error
  } = await client
    .from("customers")
    .update({
      is_active:
        newStatus
    })
    .eq(
      "id",
      id
    );


  if (error) {

    alert(
      "Unable to update customer:\n\n" +
      error.message
    );

    return;
  }


  await loadCustomers();
}


/* =====================================================
   CUSTOMER EVENTS
===================================================== */

document.addEventListener(
  "click",
  async event => {

    const viewButton =
      event.target.closest(
        ".customer-view"
      );

    if (viewButton) {

      await showCustomer(
        viewButton.dataset.id
      );

      return;
    }


    const toggleButton =
      event.target.closest(
        ".customer-toggle"
      );

    if (toggleButton) {

      await toggleCustomer(
        toggleButton.dataset.id
      );

    }

  }
);


/* =====================================================
   CUSTOMER SEARCH
===================================================== */

document
  .getElementById(
    "customerSearch"
  )
  ?.addEventListener(
    "input",
    renderCustomers
  );


/* =====================================================
   CUSTOMER STATUS FILTER
===================================================== */

document
  .getElementById(
    "customerStatusFilter"
  )
  ?.addEventListener(
    "change",
    loadCustomers
  );


/* =====================================================
   HTML ESCAPE HELPER
===================================================== */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}
}


/* HOME / ABOUT / CONTACT / PRODUCTS PRODUCT GRID */
if (document.getElementById("productGrid")) {

(function () {

  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const SUPABASE_URL =
    window.SURU_SUPABASE_URL;

  const SUPABASE_KEY =
    window.SURU_SUPABASE_KEY;


  /* =========================================================
     HELPERS
     ========================================================= */

  function escapeHtml(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  function normalise(value) {

    return String(value ?? "")
      .trim()
      .toLowerCase();

  }


  function money(value) {

    const number =
      Number(value || 0);

    return "NPR " +
      number.toLocaleString(
        "en-IN",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      );

  }


  async function supabaseRequest(
    table,
    query
  ) {

    const response =
      await fetch(
        SUPABASE_URL +
        "/rest/v1/" +
        table +
        "?" +
        query,
        {
          method: "GET",

          headers: {
            apikey:
              SUPABASE_KEY,

            Authorization:
              "Bearer " +
              SUPABASE_KEY,

            Accept:
              "application/json"
          }
        }
      );


    if (!response.ok) {

      let message =
        "Request failed";


      try {

        const error =
          await response.json();

        message =
          error.message ||
          error.hint ||
          message;

      } catch (e) {}


      throw new Error(
        message +
        " (HTTP " +
        response.status +
        ")"
      );

    }


    return response.json();

  }


  /* =========================================================
     MOBILE MENU
     ========================================================= */

  const menuToggle =
    document.getElementById(
      "menuToggle"
    );

  const mainNav =
    document.getElementById(
      "mainNav"
    );


  if (
    menuToggle &&
    mainNav
  ) {

    menuToggle.addEventListener(
      "click",
      function () {

        const open =
          mainNav.classList.toggle(
            "open"
          );


        menuToggle.setAttribute(
          "aria-expanded",
          String(open)
        );

      }
    );


    mainNav
      .querySelectorAll("a")
      .forEach(
        function (link) {

          link.addEventListener(
            "click",
            function () {

              mainNav.classList.remove(
                "open"
              );


              menuToggle.setAttribute(
                "aria-expanded",
                "false"
              );

            }
          );

        }
      );

  }


  /* =========================================================
     YEAR
     ========================================================= */

  const year =
    document.getElementById(
      "year"
    );


  if (year) {

    year.textContent =
      new Date().getFullYear();

  }


  /* =========================================================
     PRODUCT STATE
     ========================================================= */

  let products = [];

  let productImages = [];

  let productVariants = [];

  let currentProduct = null;

  let currentVariants = [];


  /* =========================================================
     UNIQUE VALUES
     ========================================================= */

  function uniqueValues(
    values
  ) {

    const result = [];


    values.forEach(
      function (value) {

        if (
          value === null ||
          value === undefined ||
          String(value).trim() === ""
        ) {

          return;

        }


        const text =
          String(value).trim();


        const exists =
          result.some(
            function (existing) {

              return (
                normalise(existing) ===
                normalise(text)
              );

            }
          );


        if (!exists) {

          result.push(text);

        }

      }
    );


    return result;

  }


  /* =========================================================
     GET PRODUCT VARIANTS
     ========================================================= */

  function getProductVariants(
    product
  ) {

    return productVariants.filter(
      function (variant) {

        return (
          variant.product_id ===
          product.id
        );

      }
    );

  }


  /* =========================================================
     GET COLOURS
     ========================================================= */

  function getColours(
    product,
    variants
  ) {

    const variantColours =
      uniqueValues(
        variants.map(
          function (variant) {

            return variant.color;

          }
        )
      );


    /*
      If variant colours exist,
      they are the source of truth.
    */

    if (
      variantColours.length > 0
    ) {

      return variantColours;

    }


    /*
      If there are no colour variants,
      product.color is treated as a
      fixed/descriptive colour.
    */

    if (
      product.color &&
      String(product.color).trim()
    ) {

      return [
        String(product.color).trim()
      ];

    }


    return [];

  }


  /* =========================================================
     GET SIZES
     ========================================================= */

  function getSizes(
    variants
  ) {

    return uniqueValues(
      variants.map(
        function (variant) {

          return variant.size;

        }
      )
    );

  }


  /* =========================================================
     FIND EXACT VARIANT
     ========================================================= */

  function findVariant(
    product,
    variants,
    size,
    colour
  ) {

    const wantedSize =
      normalise(size);

    const wantedColour =
      normalise(colour);


    /*
      1. Exact size + colour.
    */

    let match =
      variants.find(
        function (variant) {

          return (
            normalise(
              variant.size
            ) === wantedSize &&

            normalise(
              variant.color
            ) === wantedColour
          );

        }
      );


    if (match) {

      return match;

    }


    /*
      2. Legacy fixed-colour product.
      
      Example:
      product.color = "Peach"
      product_sizes.color = NULL
      size = M
    */

    if (wantedColour) {

      match =
        variants.find(
          function (variant) {

            return (
              normalise(
                variant.size
              ) === wantedSize &&

              !normalise(
                variant.color
              ) &&

              normalise(
                product.color
              ) === wantedColour
            );

          }
        );


      if (match) {

        return match;

      }

    }


    /*
      3. Size-only product.
    */

    match =
      variants.find(
        function (variant) {

          return (
            normalise(
              variant.size
            ) === wantedSize &&

            !normalise(
              variant.color
            )
          );

        }
      );


    if (match) {

      return match;

    }


    /*
      4. Colour-only product.
    */

    match =
      variants.find(
        function (variant) {

          return (
            !wantedSize &&

            normalise(
              variant.size
            ) === "" &&

            normalise(
              variant.color
            ) === wantedColour
          );

        }
      );


    return match || null;

  }


  /* =========================================================
     LOAD PRODUCTS
     ========================================================= */

  async function loadProducts() {

    const grid =
      document.getElementById(
        "productGrid"
      );

    if (!grid) {
      return;
    }

    /*
      Load each public dataset independently. Images or variant
      data are optional for rendering the product cards, so a
      failure in one secondary request must not hide all products.
    */
    try {

      products =
        await supabaseRequest(
          "products",
          "select=id,product_code,name,slug,category,description,price,compare_at_price,moq,fabric,color,pattern,is_active&is_active=eq.true&order=created_at.desc"
        );

    } catch (error) {

      console.error(
        "Products request failed:",
        error
      );

      grid.innerHTML = `
        <div class="product-loading">
          Products are temporarily unavailable.
          Please refresh the page and try again.
        </div>
      `;

      return;
    }

    if (!Array.isArray(products) || products.length === 0) {

      grid.innerHTML = `
        <div class="product-loading">
          No products are currently available.
        </div>
      `;

      return;
    }

    /* Secondary requests are isolated so either one can fail safely. */
    try {

      productImages =
        await supabaseRequest(
          "product_images",
          "select=product_id,image_url,alt_text,sort_order,is_main&order=sort_order.asc"
        );

    } catch (error) {

      console.warn(
        "Product images could not be loaded:",
        error
      );

      productImages = [];
    }

    try {

      productVariants =
        await supabaseRequest(
          "product_sizes",
          "select=id,product_id,size,color,stock,is_active&is_active=eq.true&order=size.asc"
        );

    } catch (error) {

      console.warn(
        "Product variants could not be loaded:",
        error
      );

      productVariants = [];
    }

    const imageMap = {};

    productImages.forEach(
      function (image) {

        if (!imageMap[image.product_id]) {
          imageMap[image.product_id] = [];
        }

        imageMap[image.product_id].push(image);
      }
    );

    /*
      Render product cards.
    */
    grid.innerHTML =
      products.map(
        function (product) {

          const images =
            imageMap[product.id] || [];

          const mainImage =
            images.find(
              function (image) {
                return image.is_main;
              }
            ) || images[0];

          const imageUrl =
            mainImage?.image_url || "";

          return `
            <article class="product-card">

              <a
                class="product-image"
                href="product.html?code=${encodeURIComponent(
                  product.product_code
                )}"
              >

                ${
                  imageUrl
                    ? `
                      <img
                        src="${escapeHtml(imageUrl)}"
                        alt="${escapeHtml(
                          mainImage?.alt_text || product.name
                        )}"
                        loading="lazy"
                      >
                    `
                    : `
                      <div class="product-image-placeholder">
                        Suru Collection
                      </div>
                    `
                }

              </a>

              <div class="product-card-content">

                ${
                  product.category
                    ? `
                      <div class="product-category">
                        ${escapeHtml(product.category)}
                      </div>
                    `
                    : ""
                }

                <h3>
                  <a
                    href="product.html?code=${encodeURIComponent(
                      product.product_code
                    )}"
                  >
                    ${escapeHtml(product.name)}
                  </a>
                </h3>

                <div class="product-price">
                  ${money(product.price)}
                  ${
                    product.compare_at_price
                      ? `
                        <span class="compare-price">
                          ${money(product.compare_at_price)}
                        </span>
                      `
                      : ""
                  }
                </div>

                <button
                  type="button"
                  class="add-cart variant-aware-add"
                  data-variant-aware="true"
                  data-code="${escapeHtml(product.product_code)}"
                >
                  Add to Cart
                </button>

              </div>

            </article>
          `;
        }
      ).join("");

    /*
      Attach the variant modal after the cards exist in the DOM.
    */
    grid
      .querySelectorAll(".variant-aware-add")
      .forEach(
        function (button) {

          button.addEventListener(
            "click",
            function () {
              openVariantModal(button.dataset.code);
            }
          );
        }
      );

    if (
      window.SuruShop &&
      typeof window.SuruShop.updateCount === "function"
    ) {
      window.SuruShop.updateCount();
    }

  }

  /* =========================================================
     OPEN MODAL
     ========================================================= */

  function openVariantModal(
    productCode
  ) {

    const product =
      products.find(
        function (item) {

          return (
            normalise(
              item.product_code
            ) ===
            normalise(
              productCode
            )
          );

        }
      );


    if (!product) {

      return;

    }


    currentProduct =
      product;


    currentVariants =
      getProductVariants(
        product
      );


    const modal =
      document.getElementById(
        "variantModal"
      );


    if (!modal) {

      return;

    }


    const name =
      document.getElementById(
        "variantProductName"
      );


    const code =
      document.getElementById(
        "variantProductCode"
      );


    const image =
      document.getElementById(
        "variantProductImage"
      );


    const category =
      document.getElementById(
        "variantProductCategory"
      );


    const price =
      document.getElementById(
        "variantProductPrice"
      );


    const colourField =
      document.getElementById(
        "variantColourField"
      );


    const colourSelect =
      document.getElementById(
        "variantColour"
      );


    const fixedColourField =
      document.getElementById(
        "variantFixedColourField"
      );


    const fixedColour =
      document.getElementById(
        "variantFixedColour"
      );


    const sizeField =
      document.getElementById(
        "variantSizeField"
      );


    const sizeSelect =
      document.getElementById(
        "variantSize"
      );


    const fixedOptionField =
      document.getElementById(
        "variantFixedOptionField"
      );


    const fixedOption =
      document.getElementById(
        "variantFixedOption"
      );


    const quantity =
      document.getElementById(
        "variantQuantity"
      );


    const message =
      document.getElementById(
        "variantModalMessage"
      );


    const addButton =
      document.getElementById(
        "variantAddButton"
      );


    const stockText =
      document.getElementById(
        "variantStock"
      );


    /*
      Basic information.
    */

    name.textContent =
      product.name || "";


    code.textContent =
      product.product_code || "";


    category.textContent =
      product.category || "";


    price.textContent =
      money(product.price);


    const images =
      productImages.filter(
        function (item) {

          return (
            item.product_id ===
            product.id
          );

        }
      );


    const mainImage =
      images.find(
        function (item) {

          return item.is_main;

        }
      ) ||
      images[0];


    image.src =
      mainImage?.image_url ||
      "";


    image.alt =
      product.name || "";


    /*
      Variant data.
    */

    const variants =
      currentVariants;


    const colours =
      getColours(
        product,
        variants
      );


    const sizes =
      getSizes(
        variants
      );


    /*
      Reset modal.
    */

    colourSelect.innerHTML =
      `
        <option value="">
          Select Colour
        </option>
      `;


    sizeSelect.innerHTML =
      `
        <option value="">
          Select Size
        </option>
      `;


    colourField.style.display =
      "none";


    fixedColourField.style.display =
      "none";


    sizeField.style.display =
      "none";


    fixedOptionField.style.display =
      "none";


    fixedColour.textContent =
      "";


    fixedOption.textContent =
      "";


    quantity.value =
      "1";


    quantity.min =
      "1";


    quantity.max =
      "";


    message.textContent =
      "";


    message.className =
      "variant-modal-message";


    /*
      MULTIPLE COLOURS
    */

    if (
      colours.length > 1
    ) {

      colourField.style.display =
        "block";


      colours.forEach(
        function (colour) {

          const option =
            document.createElement(
              "option"
            );


          option.value =
            colour;


          option.textContent =
            colour;


          /*
            A colour is available only
            if at least one variant for
            that colour has stock.
          */

          const available =
            variants.some(
              function (variant) {

                const variantColour =
                  normalise(
                    variant.color
                  );


                return (
                  variantColour ===
                    normalise(colour) &&

                  Number(
                    variant.stock || 0
                  ) > 0
                );

              }
            );


          if (!available) {

            option.disabled =
              true;


            option.textContent =
              colour +
              " — Out of Stock";

          }


          colourSelect.appendChild(
            option
          );

        }
      );

    }


    /*
      ONE FIXED COLOUR
    */

    else if (
      colours.length === 1
    ) {

      fixedColourField.style.display =
        "block";


      fixedColour.textContent =
        colours[0];

    }


    /*
      SIZE SELECTOR
    */

    if (
      sizes.length > 0
    ) {

      sizeField.style.display =
        "block";


      populateSizeOptions();

    }


    /*
      NO SIZE + NO COLOUR
    */

    if (
      sizes.length === 0 &&
      colours.length === 0
    ) {

      const standardVariant =
        variants.find(
          function (variant) {

            return (
              !variant.size &&
              !variant.color
            );

          }
        );


      fixedOptionField.style.display =
        "block";


      fixedOption.textContent =
        "Standard";


      if (!standardVariant) {

        stockText.textContent =
          "Stock information is not configured.";


        stockText.className =
          "variant-stock warning";

      }

    }


    updateModalVariant();


    if (
      typeof modal.showModal ===
      "function"
    ) {

      modal.showModal();

    } else {

      modal.setAttribute(
        "open",
        ""
      );

    }

  }


  /* =========================================================
     POPULATE SIZE OPTIONS
     ========================================================= */

  function populateSizeOptions() {

    if (!currentProduct) {

      return;

    }


    const sizeSelect =
      document.getElementById(
        "variantSize"
      );


    const colourSelect =
      document.getElementById(
        "variantColour"
      );


    if (!sizeSelect) {

      return;

    }


    const variants =
      currentVariants;


    const sizes =
      getSizes(
        variants
      );


    const selectedColour =
      colourSelect
        ? colourSelect.value
        : "";


    const previousSize =
      sizeSelect.value;


    sizeSelect.innerHTML =
      `
        <option value="">
          Select Size
        </option>
      `;


    sizes.forEach(
      function (size) {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          size;


        option.textContent =
          size;


        /*
          Find variants matching this
          size and selected colour.
        */

        const matching =
          variants.filter(
            function (variant) {

              if (
                normalise(
                  variant.size
                ) !==
                normalise(size)
              ) {

                return false;

              }


              /*
                Multiple colour product.
              */

              if (
                selectedColour
              ) {

                const variantColour =
                  normalise(
                    variant.color
                  );


                return (
                  variantColour ===
                  normalise(
                    selectedColour
                  )
                );

              }


              /*
                Fixed colour product.
              */

              if (
                currentProduct.color
              ) {

                return (
                  !normalise(
                    variant.color
                  ) ||

                  normalise(
                    variant.color
                  ) ===
                  normalise(
                    currentProduct.color
                  )
                );

              }


              /*
                Size-only product.
              */

              return (
                !normalise(
                  variant.color
                )
              );

            }
          );


        const available =
          matching.some(
            function (variant) {

              return (
                Number(
                  variant.stock || 0
                ) > 0
              );

            }
          );


        if (!available) {

          option.disabled =
            true;


          option.textContent =
            size +
            " — Out of Stock";

        }


        sizeSelect.appendChild(
          option
        );

      }
    );


    /*
      Restore previous size if
      it is still available.
    */

    if (
      previousSize &&
      Array.from(
        sizeSelect.options
      ).some(
        function (option) {

          return (
            option.value ===
              previousSize &&
            !option.disabled
          );

        }
      )
    ) {

      sizeSelect.value =
        previousSize;

    }

  }


  /* =========================================================
     GET CURRENT SELECTED VARIANT
     ========================================================= */

  function getVariantForSelection() {

    if (!currentProduct) {

      return null;

    }


    const variants =
      currentVariants;


    const colourSelect =
      document.getElementById(
        "variantColour"
      );


    const sizeSelect =
      document.getElementById(
        "variantSize"
      );


    const selectedColour =
      colourSelect
        ? colourSelect.value
        : "";


    const selectedSize =
      sizeSelect
        ? sizeSelect.value
        : "";


    const colours =
      getColours(
        currentProduct,
        variants
      );


    const sizes =
      getSizes(
        variants
      );


    /*
      =======================================================
      CASE 1
      NO SIZE + NO COLOUR
      =======================================================
    */

    if (
      sizes.length === 0 &&
      colours.length === 0
    ) {

      return (
        variants.find(
          function (variant) {

            return (
              !variant.size &&
              !variant.color
            );

          }
        ) ||
        null
      );

    }


    /*
      Effective colour for a fixed
      single-colour product.
    */

    const effectiveColour =
      selectedColour ||
      (
        colours.length === 1
          ? colours[0]
          : ""
      );


    /*
      =======================================================
      CASE 2
      SIZE ONLY
      =======================================================
    */

    if (
      sizes.length > 0 &&
      colours.length === 0
    ) {

      if (!selectedSize) {

        return null;

      }


      return findVariant(
        currentProduct,
        variants,
        selectedSize,
        ""
      );

    }


    /*
      =======================================================
      CASE 3
      COLOUR ONLY
      =======================================================
    */

    if (
      sizes.length === 0 &&
      colours.length > 0
    ) {

      if (
        colours.length > 1 &&
        !selectedColour
      ) {

        return null;

      }


      return findVariant(
        currentProduct,
        variants,
        "",
        effectiveColour
      );

    }


    /*
      =======================================================
      CASE 4
      SIZE + COLOUR
      =======================================================
    */

    if (
      sizes.length > 0 &&
      colours.length > 0
    ) {

      if (
        colours.length > 1 &&
        !selectedColour
      ) {

        return null;

      }


      if (!selectedSize) {

        return null;

      }


      return findVariant(
        currentProduct,
        variants,
        selectedSize,
        effectiveColour
      );

    }


    return null;

  }


  /* =========================================================
     UPDATE MODAL STOCK
     ========================================================= */

  function updateModalVariant() {

    const stockText =
      document.getElementById(
        "variantStock"
      );


    const addButton =
      document.getElementById(
        "variantAddButton"
      );


    const quantity =
      document.getElementById(
        "variantQuantity"
      );


    if (
      !stockText ||
      !addButton ||
      !quantity
    ) {

      return;

    }


    const variant =
      getVariantForSelection();


    if (!variant) {

      stockText.textContent =
        currentVariants.length
          ? "Please select an available option."
          : "Stock information is not configured.";


      stockText.className =
        "variant-stock warning";


      addButton.disabled =
        true;


      quantity.max =
        "";


      return;

    }


    const stock =
      Number(
        variant.stock || 0
      );


    if (stock <= 0) {

      stockText.textContent =
        "Out of Stock";


      stockText.className =
        "variant-stock out";


      addButton.disabled =
        true;


      quantity.max =
        "0";


      return;

    }


    stockText.textContent =
      stock +
      " item(s) available";


    stockText.className =
      "variant-stock";


    quantity.max =
      String(stock);


    let qty =
      parseInt(
        quantity.value,
        10
      ) || 1;


    if (qty < 1) {

      qty = 1;

    }


    if (qty > stock) {

      qty = stock;

    }


    quantity.value =
      String(qty);


    addButton.disabled =
      false;

  }


  /* =========================================================
     COLOUR CHANGE
     ========================================================= */

  const colourSelect =
    document.getElementById(
      "variantColour"
    );


  const sizeSelect =
    document.getElementById(
      "variantSize"
    );


  if (colourSelect) {

    colourSelect.addEventListener(
      "change",
      function () {

        /*
          Rebuild sizes based on
          selected colour.
        */

        populateSizeOptions();


        /*
          Previous size may not exist
          for this colour.
        */

        if (sizeSelect) {

          const option =
            Array.from(
              sizeSelect.options
            ).find(
              function (item) {

                return (
                  item.value ===
                  sizeSelect.value &&
                  !item.disabled
                );

              }
            );


          if (!option) {

            sizeSelect.value =
              "";

          }

        }


        updateModalVariant();

      }
    );

  }


  /* =========================================================
     SIZE CHANGE
     ========================================================= */

  if (sizeSelect) {

    sizeSelect.addEventListener(
      "change",
      updateModalVariant
    );

  }


  /* =========================================================
     QUANTITY
     ========================================================= */

  const quantityInput =
    document.getElementById(
      "variantQuantity"
    );


  if (quantityInput) {

    quantityInput.addEventListener(
      "input",
      function () {

        const variant =
          getVariantForSelection();


        if (!variant) {

          return;

        }


        const stock =
          Number(
            variant.stock || 0
          );


        let qty =
          parseInt(
            quantityInput.value,
            10
          ) || 1;


        if (qty < 1) {

          qty = 1;

        }


        if (
          stock > 0 &&
          qty > stock
        ) {

          qty =
            stock;

        }


        quantityInput.value =
          String(qty);

      }
    );

  }


  /* =========================================================
     ADD TO CART
     ========================================================= */

  const addButton =
    document.getElementById(
      "variantAddButton"
    );


  if (addButton) {

    addButton.addEventListener(
      "click",
      function () {

        if (!currentProduct) {

          return;

        }


        const variant =
          getVariantForSelection();


        if (!variant) {

          showVariantMessage(
            "Please select an available option.",
            true
          );

          return;

        }


        const stock =
          Number(
            variant.stock || 0
          );


        let qty =
          parseInt(
            quantityInput.value,
            10
          ) || 1;


        if (
          stock <= 0 ||
          qty > stock
        ) {

          showVariantMessage(
            "Selected quantity is not available.",
            true
          );

          return;

        }


        if (
          !window.SuruShop ||
          typeof window.SuruShop.addToCart !==
            "function"
        ) {

          showVariantMessage(
            "Shopping cart is unavailable. Please refresh the page.",
            true
          );

          return;

        }


        const mainImage =
          document.getElementById(
            "variantProductImage"
          );


        /*
          IMPORTANT:
          Colour is taken from the actual
          selected variant where available.
        */

        const selectedColour =
          variant.color ||
          (
            document.getElementById(
              "variantColour"
            )?.value
          ) ||
          currentProduct.color ||
          null;


        const success =
          window.SuruShop.addToCart({

            code:
              currentProduct.product_code,

            name:
              currentProduct.name,

            price:
              Number(
                currentProduct.price || 0
              ),

            image:
              mainImage?.src ||
              "",

            size:
              variant.size ||
              null,

            color:
              selectedColour,

            qty:
              qty

          });


        if (success !== false) {

          showVariantMessage(
            "Added to cart successfully.",
            false
          );


          setTimeout(
            function () {

              closeVariantModal();

            },
            700
          );

        } else {

          showVariantMessage(
            "Unable to save your cart. Please try again.",
            true
          );

        }

      }
    );

  }


  /* =========================================================
     CLOSE MODAL
     ========================================================= */

  function closeVariantModal() {

    const modal =
      document.getElementById(
        "variantModal"
      );


    if (!modal) {

      return;

    }


    if (
      typeof modal.close ===
      "function"
    ) {

      modal.close();

    } else {

      modal.removeAttribute(
        "open"
      );

    }


    currentProduct =
      null;


    currentVariants =
      [];

  }


  const closeButton =
    document.getElementById(
      "variantClose"
    );


  const cancelButton =
    document.getElementById(
      "variantCancelButton"
    );


  if (closeButton) {

    closeButton.addEventListener(
      "click",
      closeVariantModal
    );

  }


  if (cancelButton) {

    cancelButton.addEventListener(
      "click",
      closeVariantModal
    );

  }


  const modal =
    document.getElementById(
      "variantModal"
    );


  if (modal) {

    modal.addEventListener(
      "click",
      function (event) {

        if (
          event.target ===
          modal
        ) {

          closeVariantModal();

        }

      }
    );

  }


  /* =========================================================
     MODAL MESSAGE
     ========================================================= */

  function showVariantMessage(
    text,
    isError
  ) {

    const message =
      document.getElementById(
        "variantModalMessage"
      );


    if (!message) {

      return;

    }


    message.textContent =
      text;


    message.className =
      "variant-modal-message show";


    if (isError) {

      message.classList.add(
        "error"
      );

    }


    clearTimeout(
      window.__suruVariantMessageTimer
    );


    window.__suruVariantMessageTimer =
      setTimeout(
        function () {

          message.classList.remove(
            "show"
          );

        },
        3000
      );

  }


  /* =========================================================
     NEWSLETTER
     ========================================================= */

  const newsletterForm =
    document.getElementById(
      "newsletterForm"
    );


  if (newsletterForm) {

    newsletterForm.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();


        const emailInput =
          document.getElementById(
            "newsletterEmail"
          );


        const message =
          document.getElementById(
            "newsletterMessage"
          );


        const email =
          String(
            emailInput.value || ""
          )
          .trim()
          .toLowerCase();


        if (!email) {

          return;

        }


        try {

          const response =
            await fetch(
              SUPABASE_URL +
              "/rest/v1/newsletter_subscribers",
              {
                method: "POST",

                headers: {
                  apikey:
                    SUPABASE_KEY,

                  Authorization:
                    "Bearer " +
                    SUPABASE_KEY,

                  "Content-Type":
                    "application/json",

                  Prefer:
                    "return=minimal"
                },

                body:
                  JSON.stringify({
                    email:
                      email
                  })
              }
            );


          if (!response.ok) {

            let errorText =
              "Unable to subscribe.";


            try {

              const error =
                await response.json();

              errorText =
                error.message ||
                error.hint ||
                errorText;

            } catch (e) {}


            throw new Error(
              errorText
            );

          }


          message.textContent =
            "Thank you for subscribing!";


          message.className =
            "newsletter-message success";


          emailInput.value =
            "";

        } catch (error) {

          console.error(
            "Newsletter error:",
            error
          );


          message.textContent =
            "Unable to subscribe right now. Please try again.";


          message.className =
            "newsletter-message error";

        }

      }
    );

  }


  /* =========================================================
     START
     ========================================================= */

  loadProducts();

})();

}


/* ORDER / CHECKOUT PAGE */
if (document.getElementById("placeOrder") || document.getElementById("payment") || document.getElementById("cartItems")) {


(function () {

  "use strict";


  const WHATSAPP =
    "9779740381427";

  const paymentSelect =
  document.getElementById("payment");

const onlinePaymentBox =
  document.getElementById("onlinePaymentBox");

const paymentReference =
  document.getElementById("paymentReference");

const paymentScreenshot =
  document.getElementById("paymentScreenshot");

const paymentScreenshotPreview =
  document.getElementById(
    "paymentScreenshotPreview"
  );

const paymentScreenshotImage =
  document.getElementById(
    "paymentScreenshotImage"
  );

const removePaymentScreenshot =
  document.getElementById(
    "removePaymentScreenshot"
  );


/* =====================================================
   ONLINE PAYMENT DISPLAY
===================================================== */

function updatePaymentSection() {

  const isOnline =
    paymentSelect &&
    paymentSelect.value ===
      "Online Payment — confirm with Suru Collection";

  if (onlinePaymentBox) {

    onlinePaymentBox.hidden =
      !isOnline;

  }

}


if (paymentSelect) {

  paymentSelect.addEventListener(
    "change",
    updatePaymentSection
  );

  updatePaymentSection();

}


/* =====================================================
   PAYMENT SCREENSHOT PREVIEW
===================================================== */

if (paymentScreenshot) {

  paymentScreenshot.addEventListener(
    "change",
    function () {

      const file =
        paymentScreenshot.files &&
        paymentScreenshot.files[0];

      if (!file) {

        paymentScreenshotPreview.hidden =
          true;

        paymentScreenshotImage.src =
          "";

        return;

      }


      if (!file.type.startsWith("image/")) {

        alert(
          "Please select an image file."
        );

        paymentScreenshot.value =
          "";

        return;

      }


      /*
         Keep the screenshot reasonably small.
         This is only a browser-side check.
      */

      if (
        file.size >
        10 * 1024 * 1024
      ) {

        alert(
          "Please select an image smaller than 10 MB."
        );

        paymentScreenshot.value =
          "";

        return;

      }


      const reader =
        new FileReader();


      reader.onload =
        function (event) {

          paymentScreenshotImage.src =
            event.target.result;

          paymentScreenshotPreview.hidden =
            false;

        };


      reader.readAsDataURL(file);

    }
  );

}


if (removePaymentScreenshot) {

  removePaymentScreenshot.addEventListener(
    "click",
    function () {

      paymentScreenshot.value =
        "";

      paymentScreenshotImage.src =
        "";

      paymentScreenshotPreview.hidden =
        true;

    }
  );

}


  /* =====================================================
     HELPERS
  ===================================================== */

  /*
     IMPORTANT:
     The cart is now controlled by shop.js.

     This means order.html uses the exact same
     storage system as the product pages.

     shop.js will use localStorage when available
     and automatically fall back to cookies when
     localStorage is blocked or unavailable.
  */

  function getCart() {

    if (
      window.SuruShop &&
      typeof window.SuruShop.getCart === "function"
    ) {

      return window.SuruShop.getCart();

    }

    return [];

  }


  function money(value) {

    return (
      "NPR " +
      Number(value || 0)
        .toLocaleString("en-IN")
    );

  }


  /* =====================================================
     RENDER CART
  ===================================================== */

  function renderCart() {

    const cart =
      getCart();


    const items =
      document.getElementById(
        "cartItems"
      );


    const empty =
      document.getElementById(
        "cartEmpty"
      );


    const checkout =
      document.getElementById(
        "checkout"
      );


    if (!cart.length) {

      empty.hidden = false;

      checkout.style.display =
        "none";

      return;

    }


    empty.hidden = true;

    checkout.style.display =
      "grid";


    let total = 0;


    items.innerHTML =
      cart.map(
        function (item, index) {

          const itemQty =
  Number(
    item.quantity ??
    item.qty ??
    0
  );

const lineTotal =
  Number(item.price || 0) *
  itemQty;


          total += lineTotal;


          return `

            <article class="cart-item">

              ${
                item.image

                  ? `

                    <img
                      src="${item.image}"
                      alt="${item.name || "Product"}"
                      onerror="
                        this.style.display='none'
                      "
                    >

                  `

                  : ""
              }


              <div>

                <small>
                  ${item.code || ""}
                </small>

                <h3>
                  ${item.name || ""}
                </h3>

                <p>

                  ${
                    item.color
                      ? "Colour: " +
                        item.color +
                        " · "
                      : ""
                  }

                  ${
                    item.size
                      ? "Size: " +
                        item.size +
                        " · "
                      : ""
                  }

                  Qty:
                  ${item.quantity ?? item.qty ?? 0}
                  

                </p>

                <strong>
                  ${money(lineTotal)}
                </strong>


                <button
                  class="remove-item"
                  data-index="${index}"
                  type="button"
                >
                  Remove
                </button>

              </div>

            </article>

          `;

        }
      ).join("");


    document.getElementById(
      "cartTotal"
    ).textContent =
      money(total);


    document.getElementById(
      "cartCount"
    ).textContent =
      cart.reduce(
        function (total, item) {

          return (
            total +
            Number(item.qty || 0)
          );

        },
        0
      );

  }


  /* =====================================================
     BUTTONS
  ===================================================== */

  document.addEventListener(
    "click",
    function (event) {


      /* -----------------------------
         REMOVE ITEM
      ----------------------------- */

      const remove =
        event.target.closest(
          ".remove-item"
        );


      if (remove) {

        const cart =
          getCart();


        cart.splice(
          Number(
            remove.dataset.index
          ),
          1
        );


        /*
           Save through shop.js so the same
           localStorage/cookie system is used.
        */

        if (
          window.SuruShop &&
          typeof window.SuruShop.saveCart ===
            "function"
        ) {

          window.SuruShop.saveCart(cart);

        }


        renderCart();


        if (
          window.SuruShop &&
          typeof window.SuruShop.updateCount ===
            "function"
        ) {

          window.SuruShop.updateCount();

        }

        return;

      }


      /* -----------------------------
         CLEAR CART
      ----------------------------- */

      if (
        event.target.id ===
        "clearCart"
      ) {


        if (
          window.SuruShop &&
          typeof window.SuruShop.clear ===
            "function"
        ) {

          window.SuruShop.clear();

        }


        renderCart();


        if (
          window.SuruShop &&
          typeof window.SuruShop.updateCount ===
            "function"
        ) {

          window.SuruShop.updateCount();

        }

      }

    }
  );


  /* =====================================================
     PLACE ORDER
  ===================================================== */

  const placeOrder =
    document.getElementById(
      "placeOrder"
    );


  if (placeOrder) {

    placeOrder.addEventListener(
      "click",
      async function () {


        const cart =
          getCart();


        if (!cart.length) {

          alert(
            "Your cart is empty."
          );

          return;

        }


        const name =
          document
            .getElementById(
              "customerName"
            )
            .value
            .trim();


        const phone =
          document
            .getElementById(
              "customerPhone"
            )
            .value
            .trim();


        const address =
          document
            .getElementById(
              "customerAddress"
            )
            .value
            .trim();


        const city =
          document
            .getElementById(
              "customerCity"
            )
            .value
            .trim();


        const payment =
          document
            .getElementById(
              "payment"
            )
            .value;


        if (
          !name ||
          !phone ||
          !address ||
          !city
        ) {

          alert(
            "Please fill in all delivery details."
          );

          return;

        }


        let total = 0;


        const lines =
          cart.map(
            function (item) {

              const lineTotal =
                Number(
                  item.price || 0
                ) *
                Number(
                  item.qty || 0
                );


              total +=
                lineTotal;


              return (
                "• " +
                item.code +
                " — " +
                item.name +
                (
                  item.color
                    ? " | Colour: " +
                      item.color
                    : ""
                ) +
                (
                  item.size
                    ? " | Size: " +
                      item.size
                    : ""
                ) +
                " | Qty: " +
                (item.quantity ?? item.qty ?? 0) +
                " | " +
                money(lineTotal)
              );

            }
          );


        const paymentRef =
  document
    .getElementById(
      "paymentReference"
    )
    .value
    .trim();


const screenshotInput =
  document.getElementById(
    "paymentScreenshot"
  );


const screenshotFile =
  screenshotInput &&
  screenshotInput.files &&
  screenshotInput.files[0]
    ? screenshotInput.files[0]
    : null;


/* =====================================================
   PAYMENT INFORMATION
===================================================== */

let paymentDetails = "";


if (
  payment ===
  "Online Payment — confirm with Suru Collection"
) {

  paymentDetails =
    [
      "Payment: Online Payment",
      paymentRef
        ? "Payment Reference: " +
          paymentRef
        : "Payment Reference: Not provided",
      screenshotFile
        ? "Payment Screenshot: Attached"
        : "Payment Screenshot: Not provided"
    ].join("\n");

} else {

  paymentDetails =
    "Payment: Cash on Delivery";

}


/* =====================================================
   WHATSAPP MESSAGE
===================================================== */

const message =
  [
    "Hello Suru Collection, I would like to place an order.",
    "",
    lines.join("\n"),
    "",
    "Total: " +
      money(total),
    paymentDetails,
    "",
    "Customer: " +
      name,
    "Phone: " +
      phone,
    "Address: " +
      address +
      ", " +
      city,
    "",
    "Please confirm availability and delivery charges."
  ].join("\n");


/* =====================================================
   SCREENSHOT PRESENT
===================================================== */

if (screenshotFile) {

  /*
     WhatsApp's web link can reliably pre-fill the
     complete order message.

     A normal website cannot force an image attachment
     into a WhatsApp chat together with pre-filled text.
     Therefore we open WhatsApp with the full order
     details and ask the customer to attach the selected
     screenshot.
  */

  const whatsappUrl =
    "https://wa.me/" +
    WHATSAPP +
    "?text=" +
    encodeURIComponent(message);

  window.open(
    whatsappUrl,
    "_blank"
  );

  return;
}
/* =====================================================
   NO SCREENSHOT
   ===================================================== */

window.open(
  "https://wa.me/" +
  WHATSAPP +
  "?text=" +
  encodeURIComponent(
    message
  ),
  "_blank"
);

      }
    );

  }


  /* =====================================================
     NAVIGATION
  ===================================================== */

  const menuButton =
    document.querySelector(
      ".menu-btn"
    );


  const navigation =
    document.querySelector(
      ".main-nav"
    );


  if (
    menuButton &&
    navigation
  ) {

    menuButton.addEventListener(
      "click",
      function () {

        const open =
          navigation.classList.toggle(
            "open"
          );


        menuButton.setAttribute(
          "aria-expanded",
          open
            ? "true"
            : "false"
        );

      }
    );

  }


  /* =====================================================
     YEAR
  ===================================================== */

  const year =
    document.querySelector(
      ".year"
    );


  if (year) {

    year.textContent =
      new Date().getFullYear();

  }


  /* =====================================================
     INITIAL CART LOAD
  ===================================================== */

  renderCart();

  /*
     If the cart had to be recovered from IndexedDB
     or Supabase, render it again when recovery finishes.
  */
  document.addEventListener(
    "suruCartReady",
    renderCart
  );

  if (
    window.SuruShop &&
    window.SuruShop.ready
  ) {
    window.SuruShop.ready.then(
      renderCart
    );
  }


})();


}


/* ACCOUNT LOCATION INITIALISATION */
if (document.getElementById("locationMap") && document.getElementById("saveAccountLocation")) {

document.addEventListener("DOMContentLoaded", function () {
  window.suruAccountLocationPicker =
    window.SuruLocationPicker?.init({
      mapId: "locationMap",
      openButtonId: "setLocationOnMap",
      currentButtonId: "useCurrentLocation",
      statusId: "locationStatus",
      latId: "locationLatitude",
      lngId: "locationLongitude",
      addressId: "locationAddress",
      dialogId: "locationDialog",
      confirmButtonId: "confirmMapLocation",
      closeButtonId: "closeMapLocation"
    });

  document.getElementById("closeMapLocation2")?.addEventListener("click", function () {
    document.getElementById("locationDialog")?.close();
  });
});

}


/* REGISTER LOCATION INITIALISATION */
if (document.getElementById("registerForm") && document.getElementById("locationMap")) {
document.addEventListener("DOMContentLoaded", function(){const picker=window.SuruLocationPicker?.init({mapId:"locationMap",openButtonId:"setLocationOnMap",currentButtonId:"useCurrentLocation",statusId:"locationStatus",latId:"locationLatitude",lngId:"locationLongitude",addressId:"locationAddress",dialogId:"locationDialog",confirmButtonId:"confirmMapLocation",closeButtonId:"closeMapLocation"});document.getElementById("closeMapLocation2")?.addEventListener("click",()=>document.getElementById("locationDialog")?.close());window.suruRegisterLocationPicker=picker;});
}


/* PRODUCT DETAIL MOBILE NAVIGATION */
if (document.getElementById("productRoot")) {


(function () {

  "use strict";


  /* Mobile navigation */

  const menuButton =
    document.querySelector(".menu-btn");

  const navigation =
    document.querySelector(".main-nav");


  if (menuButton && navigation) {

    menuButton.addEventListener(
      "click",
      function () {

        const open =
          navigation.classList.toggle("open");

        menuButton.setAttribute(
          "aria-expanded",
          open ? "true" : "false"
        );

      }
    );


    navigation
      .querySelectorAll("a")
      .forEach(function (link) {

        link.addEventListener(
          "click",
          function () {

            navigation.classList.remove(
              "open"
            );

            menuButton.setAttribute(
              "aria-expanded",
              "false"
            );

          }
        );

      });

  }


  const year =
    document.querySelector(".year");

  if (year) {

    year.textContent =
      new Date().getFullYear();

  }

})();


}
