(function () {
  "use strict";

  const CART_KEY = "suruCart";

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch (error) {
      console.error("Cart read error:", error);
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
  }

  function updateCartCount() {
    const cart = getCart();
    const count = cart.reduce(
      (total, item) => total + Number(item.qty || 0),
      0
    );

    document.querySelectorAll("#cartCount").forEach((element) => {
      element.textContent = count;
    });
  }

  function addToCart(item) {
    const cart = getCart();

    const code = item.code;
    const size = item.size || "";

    const existing = cart.find(
      (product) => product.code === code && product.size === size
    );

    if (existing) {
      existing.qty += Number(item.qty || 1);
    } else {
      cart.push({
        code: code,
        name: item.name,
        price: Number(item.price || 0),
        image: item.image || "",
        size: size,
        qty: Number(item.qty || 1)
      });
    }

    saveCart(cart);

    alert("Added to your cart.");
  }

  /*
   * Handle Add to Cart buttons
   */
  document.addEventListener("click", function (event) {
    const button = event.target.closest(".add-cart, .buy-button");

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const isProductPage = button.classList.contains("buy-button");

    const sizeElement = document.querySelector("#size");
    const quantityElement = document.querySelector("#qty");

    const size = isProductPage && sizeElement
      ? sizeElement.value
      : "";

    const quantity = Math.max(
      1,
      parseInt(
        isProductPage && quantityElement
          ? quantityElement.value
          : "1",
        10
      ) || 1
    );

    /*
     * Only require size when the product actually has a size selector.
     */
    if (
      isProductPage &&
      sizeElement &&
      !size
    ) {
      alert("Please select a size first.");
      return;
    }

    addToCart({
      code: button.dataset.code || "",
      name: button.dataset.name || "",
      price: Number(button.dataset.price || 0),
      image: button.dataset.image || "",
      size: size,
      qty: quantity
    });
  });

  window.SuruShop = {
    getCart: getCart,
    saveCart: saveCart,
    add: addToCart,
    updateCount: updateCartCount
  };

  updateCartCount();
})();
