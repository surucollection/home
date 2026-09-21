(function () {
  "use strict";

  const CART_KEY = "suruCart";

  /* =========================================================
     CART
  ========================================================= */

  function getCart() {
    try {
      const saved = localStorage.getItem(CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Suru Collection: Unable to read cart", error);
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      updateCartCount();
    } catch (error) {
      console.error("Suru Collection: Unable to save cart", error);
    }
  }

  function updateCartCount() {
    const cart = getCart();

    const count = cart.reduce(function (total, item) {
      return total + Number(item.qty || 0);
    }, 0);

    document.querySelectorAll("#cartCount").forEach(function (element) {
      element.textContent = count;
    });
  }

  function addToCart(item) {
    const cart = getCart();

    const code = String(item.code || "");
    const size = String(item.size || "");

    if (!code) {
      console.error("Suru Collection: Product code missing.");
      return;
    }

    const quantity = Math.max(
      1,
      parseInt(item.qty, 10) || 1
    );

    const existing = cart.find(function (product) {
      return (
        product.code === code &&
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

    saveCart(cart);

    showCartMessage(
      String(item.name || "Product") +
      " added to your cart."
    );
  }

  function removeFromCart(index) {
    const cart = getCart();

    if (index < 0 || index >= cart.length) {
      return;
    }

    cart.splice(index, 1);
    saveCart(cart);
  }

  function updateQuantity(index, quantity) {
    const cart = getCart();

    if (index < 0 || index >= cart.length) {
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
    localStorage.removeItem(CART_KEY);
    updateCartCount();
  }

  /* =========================================================
     CART MESSAGE
  ========================================================= */

  function showCartMessage(message) {
    let messageBox =
      document.getElementById("suruCartMessage");

    if (!messageBox) {
      messageBox = document.createElement("div");

      messageBox.id = "suruCartMessage";

      messageBox.style.position = "fixed";
      messageBox.style.left = "50%";
      messageBox.style.bottom = "25px";
      messageBox.style.transform = "translateX(-50%)";
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

  /* =========================================================
     PRODUCT PAGE ADD TO CART
  ========================================================= */

  document.addEventListener("click", function (event) {

    const button =
      event.target.closest(
        ".add-cart, .buy-button, [data-add-to-cart]"
      );

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const code =
      button.dataset.code ||
      document.body.dataset.productCode ||
      "";

    const name =
      button.dataset.name ||
      document.querySelector(
        "[data-product-name]"
      )?.textContent ||
      "";

    const price =
      Number(
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

    const size =
      sizeElement
        ? String(sizeElement.value || "")
        : "";

    const quantity =
      quantityElement
        ? Math.max(
            1,
            parseInt(
              quantityElement.value,
              10
            ) || 1
          )
        : 1;

    /*
     * Only require size when the page
     * actually provides a size selector.
     */
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

  /* =========================================================
     PUBLIC API
  ========================================================= */

  window.SuruShop = {

    getCart: getCart,

    saveCart: saveCart,

    add: addToCart,

    remove: removeFromCart,

    updateQuantity: updateQuantity,

    clear: clearCart,

    updateCount: updateCartCount

  };

  /* =========================================================
     INITIALIZE
  ========================================================= */

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
