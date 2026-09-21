(function () {
  "use strict";

  const CART_KEY = "suruCart";
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

  function readCookie(name) {
    const prefix = encodeURIComponent(name) + "=";

    const row = document.cookie
      .split("; ")
      .find(function (item) {
        return item.indexOf(prefix) === 0;
      });

    if (!row) return null;

    try {
      return decodeURIComponent(
        row.substring(prefix.length)
      );
    } catch (e) {
      return null;
    }
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
    try {
      const value = localStorage.getItem(CART_KEY);

      if (value !== null) {
        return value;
      }
    } catch (error) {
      console.warn(
        "Suru Collection: localStorage unavailable.",
        error
      );
    }

    return readCookie(CART_KEY);
  }

  function writeStorage(value) {
    let localSaved = false;

    try {
      localStorage.setItem(CART_KEY, value);

      localSaved =
        localStorage.getItem(CART_KEY) === value;
    } catch (error) {
      console.warn(
        "Suru Collection: localStorage save failed.",
        error
      );
    }

    try {
      writeCookie(CART_KEY, value);
    } catch (error) {
      console.warn(
        "Suru Collection: cookie save failed.",
        error
      );
    }

    if (localSaved) return true;

    try {
      return readCookie(CART_KEY) === value;
    } catch (error) {
      return false;
    }
  }

  function removeStorage() {
    try {
      localStorage.removeItem(CART_KEY);
    } catch (error) {}

    try {
      removeCookie(CART_KEY);
    } catch (error) {}
  }

  function normalise(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getCart() {
    try {
      const saved = readStorage();

      if (!saved) return [];

      const cart = JSON.parse(saved);

      if (!Array.isArray(cart)) return [];

      return cart.map(function (item) {
        return {
          code: String(item.code || ""),
          name: String(item.name || ""),
          price: Number(item.price || 0),
          image: String(item.image || ""),
          size: item.size
            ? String(item.size)
            : "",
          color: item.color
            ? String(item.color)
            : "",
          qty: Math.max(
            1,
            parseInt(item.qty, 10) || 1
          )
        };
      });
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

  function sameVariant(a, b) {
    return (
      normalise(a.code) === normalise(b.code) &&
      normalise(a.size) === normalise(b.size) &&
      normalise(a.color) === normalise(b.color)
    );
  }

  function addToCart(item) {
    const code = String(item.code || "").trim();

    if (!code) {
      showCartMessage(
        "Unable to add this product."
      );

      return false;
    }

    const cart = getCart();

    const newItem = {
      code: code,
      name: String(item.name || ""),
      price: Number(item.price || 0),
      image: String(item.image || ""),
      size: item.size
        ? String(item.size)
        : "",
      color: item.color
        ? String(item.color)
        : "",
      qty: Math.max(
        1,
        parseInt(item.qty, 10) || 1
      )
    };

    const existing = cart.find(function (product) {
      return sameVariant(product, newItem);
    });

    if (existing) {
      existing.qty =
        Number(existing.qty || 0) +
        newItem.qty;
    } else {
      cart.push(newItem);
    }

    const saved = saveCart(cart);

    if (saved) {
      showCartMessage(
        newItem.name +
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
      return false;
    }

    cart.splice(index, 1);

    return saveCart(cart);
  }

  function updateQuantity(index, quantity) {
    const cart = getCart();

    if (
      index < 0 ||
      index >= cart.length
    ) {
      return false;
    }

    const qty = Math.max(
      1,
      parseInt(quantity, 10) || 1
    );

    cart[index].qty = qty;

    return saveCart(cart);
  }

  function clearCart() {
    removeStorage();
    updateCartCount();
  }

  function updateCartCount() {
    const cart = getCart();

    const count = cart.reduce(
      function (total, item) {
        return (
          total +
          Number(item.qty || 0)
        );
      },
      0
    );

    document
      .querySelectorAll("#cartCount")
      .forEach(function (element) {
        element.textContent = count;
      });
  }

  function showCartMessage(message) {
    let box =
      document.getElementById(
        "suruCartMessage"
      );

    if (!box) {
      box = document.createElement("div");

      box.id =
        "suruCartMessage";

      box.style.position =
        "fixed";

      box.style.left =
        "50%";

      box.style.bottom =
        "25px";

      box.style.transform =
        "translateX(-50%)";

      box.style.zIndex =
        "99999";

      box.style.background =
        "#5b0f24";

      box.style.color =
        "#fff";

      box.style.padding =
        "12px 20px";

      box.style.borderRadius =
        "8px";

      box.style.fontSize =
        "14px";

      box.style.boxShadow =
        "0 8px 30px rgba(0,0,0,.18)";

      box.style.maxWidth =
        "90%";

      box.style.textAlign =
        "center";

      document.body.appendChild(box);
    }

    box.textContent = message;
    box.style.display = "block";

    clearTimeout(
      window.__suruCartMessageTimer
    );

    window.__suruCartMessageTimer =
      setTimeout(function () {
        box.style.display =
          "none";
      }, 2200);
  }

  /*
   * Legacy click support.
   *
   * Product pages that explicitly call
   * SuruShop.addToCart() will use the
   * full variant-aware system above.
   */

  document.addEventListener(
    "click",
    function (event) {
      const button =
        event.target.closest(
          ".add-cart, [data-add-to-cart]"
        );

      if (!button) return;

      /*
       * Variant-aware product page buttons
       * handle themselves.
       */
      if (
        button.dataset.variantAware ===
        "true"
      ) {
        return;
      }

      event.preventDefault();

      const code =
        button.dataset.code || "";

      const name =
        button.dataset.name || "";

      const price =
        Number(
          button.dataset.price || 0
        );

      const image =
        button.dataset.image || "";

      const sizeElement =
        document.querySelector(
          "#size, [name='size']"
        );

      const colorElement =
        document.querySelector(
          "#color, #productColor, [name='color']"
        );

      const qtyElement =
        document.querySelector(
          "#qty, #productQty, [name='quantity']"
        );

      const size =
        sizeElement
          ? String(
              sizeElement.value || ""
            )
          : "";

      const color =
        colorElement
          ? String(
              colorElement.value || ""
            )
          : "";

      const qty =
        qtyElement
          ? Math.max(
              1,
              parseInt(
                qtyElement.value,
                10
              ) || 1
            )
          : 1;

      addToCart({
        code: code,
        name: name,
        price: price,
        image: image,
        size: size,
        color: color,
        qty: qty
      });
    }
  );

  window.SuruShop = {
    getCart: getCart,
    saveCart: saveCart,
    addToCart: addToCart,
    add: addToCart,
    remove: removeFromCart,
    updateQuantity: updateQuantity,
    clear: clearCart,
    updateCount: updateCartCount,
    showMessage: showCartMessage
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      updateCartCount
    );
  } else {
    updateCartCount();
  }

})();
