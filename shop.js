(function () {
  "use strict";

  const CART_KEY = "suruCart";
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

  /* -----------------------------
     Storage helpers
  ----------------------------- */

  function readCookie(name) {
    const prefix = encodeURIComponent(name) + "=";

    const row = document.cookie
      .split("; ")
      .find(function (item) {
        return item.indexOf(prefix) === 0;
      });

    if (!row) return null;

    return decodeURIComponent(row.substring(prefix.length));
  }

  function writeCookie(name, value) {
    document.cookie =
      encodeURIComponent(name) +
      "=" +
      encodeURIComponent(value) +
      "; path=/; max-age=" +
      COOKIE_MAX_AGE +
      "; SameSite=Lax";
  }

  function removeCookie(name) {
    document.cookie =
      encodeURIComponent(name) +
      "=; path=/; max-age=0; SameSite=Lax";
  }

  function readStorage() {
    let localValue = null;

    /* Try localStorage first */
    try {
      localValue = localStorage.getItem(CART_KEY);
    } catch (error) {
      console.warn("Suru Collection: localStorage unavailable.", error);
    }

    /* If localStorage has data, use it */
    if (localValue !== null) {
      return localValue;
    }

    /* Otherwise use cookie fallback */
    return readCookie(CART_KEY);
  }

  function writeStorage(value) {
    let localSaved = false;

    /* Try localStorage */
    try {
      localStorage.setItem(CART_KEY, value);

      /* Verify that it actually saved */
      localSaved = localStorage.getItem(CART_KEY) === value;
    } catch (error) {
      console.warn("Suru Collection: localStorage save failed.", error);
    }

    /* Always keep cookie synchronized */
    try {
      writeCookie(CART_KEY, value);
    } catch (error) {
      console.warn("Suru Collection: cookie save failed.", error);
    }

    /* Verify at least one storage method worked */
    if (localSaved) {
      return true;
    }

    try {
      return readCookie(CART_KEY) === value;
    } catch (error) {
      return false;
    }
  }

  function removeStorage() {
    let success = false;

    try {
      localStorage.removeItem(CART_KEY);
      success = true;
    } catch (error) {
      console.warn("Suru Collection: localStorage remove failed.", error);
    }

    try {
      removeCookie(CART_KEY);
    } catch (error) {
      console.warn("Suru Collection: cookie remove failed.", error);
    }

    return success;
  }

  /* -----------------------------
     Cart
  ----------------------------- */

  function getCart() {
    try {
      const saved = readStorage();

      if (!saved) {
        return [];
      }

      const cart = JSON.parse(saved);

      return Array.isArray(cart) ? cart : [];
    } catch (error) {
      console.error(
        "Suru Collection: Unable to read cart.",
        error
      );

      return [];
    }
  }

  function saveCart(cart) {
    try {
      const json = JSON.stringify(cart);
      const saved = writeStorage(json);

      updateCartCount();

      return saved;
    } catch (error) {
      console.error(
        "Suru Collection: Unable to save cart.",
        error
      );

      return false;
    }
  }

  function updateCartCount() {
    const cart = getCart();

    const count = cart.reduce(function (total, item) {
      return total + Number(item.qty || 0);
    }, 0);

    document
      .querySelectorAll("#cartCount")
      .forEach(function (element) {
        element.textContent = count;
      });
  }

  function addToCart(item) {
    const cart = getCart();

    const code = String(item.code || "");
    const size = String(item.size || "");

    if (!code) {
      console.error("Suru Collection: Product code missing.");
      showCartMessage(
        "Unable to add this product. Product code is missing."
      );
      return false;
    }

    const quantity = Math.max(
      1,
      parseInt(item.qty, 10) || 1
    );

    const existing = cart.find(function (product) {
      return (
        String(product.code) === code &&
        String(product.size || "") === size
      );
    });

    if (existing) {
      existing.qty =
        Number(existing.qty || 0) + quantity;
    } else {
      cart.push({
        code: code,
        name: String(item.name || ""),
        price: Number(item.price || 0),
        image: String(item.image || ""),
        size: size,
        qty: quantity
      });
    }

    const saved = saveCart(cart);

    /* IMPORTANT:
       Only show "added" if storage actually succeeded. */
    if (saved) {
      showCartMessage(
        String(item.name || "Product") +
        " added to your cart."
      );
      return true;
    }

    showCartMessage(
      "Unable to save your cart. Please try again."
    );

    return false;
  }

  function removeFromCart(index) {
    const cart = getCart();

    if (
      index < 0 ||
      index >= cart.length
    ) {
      return;
    }

    cart.splice(index, 1);

    saveCart(cart);
  }

  function updateQuantity(index, quantity) {
    const cart = getCart();

    if (
      index < 0 ||
      index >= cart.length
    ) {
      return;
    }

    const newQuantity = Math.max(
      1,
      parseInt(quantity, 10) || 1
    );

    cart[index].qty = newQuantity;

    saveCart(cart);
  }

  function clearCart() {
    removeStorage();
    updateCartCount();
  }

  /* -----------------------------
     Message
  ----------------------------- */

  function showCartMessage(message) {
    let messageBox =
      document.getElementById("suruCartMessage");

    if (!messageBox) {
      messageBox = document.createElement("div");

      messageBox.id = "suruCartMessage";

      messageBox.style.position = "fixed";
      messageBox.style.left = "50%";
      messageBox.style.bottom = "25px";
      messageBox.style.transform =
        "translateX(-50%)";
      messageBox.style.zIndex = "99999";
      messageBox.style.background = "#5b0f24";
      messageBox.style.color = "#fff";
      messageBox.style.padding = "12px 20px";
      messageBox.style.borderRadius = "8px";
      messageBox.style.fontSize = "14px";
      messageBox.style.boxShadow =
        "0 8px 30px rgba(0,0,0,.18)";
      messageBox.style.maxWidth = "90%";
      messageBox.style.textAlign = "center";

      document.body.appendChild(messageBox);
    }

    messageBox.textContent = message;
    messageBox.style.display = "block";

    clearTimeout(
      window.__suruCartMessageTimer
    );

    window.__suruCartMessageTimer =
      setTimeout(function () {
        messageBox.style.display = "none";
      }, 2200);
  }

  /* -----------------------------
     Add-to-cart click handler
  ----------------------------- */

  document.addEventListener("click", function (event) {
    const button = event.target.closest(
      ".add-cart, .buy-button, [data-add-to-cart]"
    );

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const code =
      button.dataset.code ||
      document.body.dataset.productCode ||
      "";

    const name =
      button.dataset.name ||
      document
        .querySelector("[data-product-name]")
        ?.textContent ||
      "";

    const price = Number(
      button.dataset.price ||
      document.body.dataset.productPrice ||
      0
    );

    const image =
      button.dataset.image ||
      document.querySelector(
        ".product-main-image img"
      )?.src ||
      document.querySelector(
        ".product-img img"
      )?.src ||
      "";

    const sizeElement =
      document.querySelector("#size") ||
      document.querySelector(
        "[name='size']"
      );

    const quantityElement =
      document.querySelector("#qty") ||
      document.querySelector(
        "[name='quantity']"
      );

    const size = sizeElement
      ? String(sizeElement.value || "")
      : "";

    const quantity = quantityElement
      ? Math.max(
          1,
          parseInt(
            quantityElement.value,
            10
          ) || 1
        )
      : 1;

    if (
      sizeElement &&
      sizeElement.options &&
      sizeElement.options.length > 0 &&
      !size
    ) {
      alert("Please select a size first.");
      return;
    }

    addToCart({
      code: code,
      name: name,
      price: price,
      image: image,
      size: size,
      qty: quantity
    });
  });

  /* -----------------------------
     Public API
  ----------------------------- */

  window.SuruShop = {
    getCart: getCart,
    saveCart: saveCart,
    add: addToCart,
    remove: removeFromCart,
    updateQuantity: updateQuantity,
    clear: clearCart,
    updateCount: updateCartCount
  };

  /* -----------------------------
     Initial cart count
  ----------------------------- */

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      updateCartCount
    );
  } else {
    updateCartCount();
  }

})();
