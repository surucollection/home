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


  /* -----------------------------
     Helpers
  ----------------------------- */

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function money(value) {
    const n = Number(value || 0);

    return "NPR " + n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }


  function getCode() {
    const params =
      new URLSearchParams(window.location.search);

    return (
      params.get("code") ||
      params.get("product") ||
      ""
    ).trim();
  }


  function normalise(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }


  /* -----------------------------
     Load Product
  ----------------------------- */

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
        .eq("product_code", code)
        .eq("is_active", true)
        .maybeSingle();


      if (productError)
        throw productError;


      if (!product) {

        root.innerHTML = `
          <div class="product-loading-page">
            <h2>Product not found</h2>
            <p>This product is unavailable.</p>
          </div>
        `;

        return;
      }


      /* -----------------------------
         Images
      ----------------------------- */

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
        .eq("product_id", product.id)
        .order("sort_order", {
          ascending: true
        });


      if (imageError)
        throw imageError;


      const productImages =
        Array.isArray(images)
          ? images
          : [];


      /* -----------------------------
         Variants
      ----------------------------- */

      const {
        data: sizes,
        error: sizeError
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
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("size");


      if (sizeError)
        throw sizeError;


      const variants =
        Array.isArray(sizes)
          ? sizes
          : [];


      renderProduct(
        product,
        productImages,
        variants
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
            ${esc(error?.message || "Please try again.")}
          </p>
        </div>
      `;
    }
  }


  /* -----------------------------
     Render Product
  ----------------------------- */

  function renderProduct(
    product,
    images,
    variants
  ) {

    const mainImage =
      images.find(function (img) {
        return img.is_main;
      }) ||
      images[0];


    const mainImageUrl =
      mainImage?.image_url ||
      "";


    /*
      Detect colours.

      If colour is NULL on old rows,
      use the product's main colour.
    */

    const colours = [];

    variants.forEach(function (variant) {

      const colour =
        variant.color ||
        product.color ||
        "";

      if (
        colour &&
        !colours.some(
          c => normalise(c) === normalise(colour)
        )
      ) {
        colours.push(colour);
      }
    });


    /*
      If there are no variant rows but
      product has a colour, treat it as
      a fixed colour.
    */

    if (
      colours.length === 0 &&
      product.color
    ) {
      colours.push(product.color);
    }


    /*
      Determine whether size selection
      is actually required.
    */

    const sizeValues = [];

    variants.forEach(function (variant) {

      if (!variant.size) return;

      if (
        !sizeValues.some(
          s =>
            normalise(s) ===
            normalise(variant.size)
        )
      ) {
        sizeValues.push(variant.size);
      }
    });


    const hasSizes =
      sizeValues.length > 0;


    const hasMultipleColours =
      colours.length > 1;


    /*
      Single fixed colour should not force
      the customer to choose a colour.
    */

    const showColourSelector =
      hasMultipleColours;


    root.innerHTML = `

      <div class="product-layout">

        <!-- IMAGE AREA -->

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

                  ${images.map(function (img, index) {

                    return `
                      <button
                        type="button"
                        class="product-thumb ${
                          index === 0
                            ? "active"
                            : ""
                        }"
                        data-image="${esc(img.image_url)}"
                      >

                        <img
                          src="${esc(img.image_url)}"
                          alt="${esc(
                            img.alt_text ||
                            product.name
                          )}"
                        >

                      </button>
                    `;

                  }).join("")}

                </div>
              `
              : ""
          }

        </div>


        <!-- PRODUCT INFORMATION -->

        <div class="product-info">

          <div class="product-code">
            ${esc(product.product_code)}
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
                  ${esc(product.description)}
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
                    ${esc(product.fabric)}
                  </div>
                `
                : ""
            }


            ${
              product.color &&
              !showColourSelector
                ? `
                  <div>
                    <strong>Colour:</strong>
                    ${esc(product.color)}
                  </div>
                `
                : ""
            }


            ${
              product.pattern
                ? `
                  <div>
                    <strong>Pattern:</strong>
                    ${esc(product.pattern)}
                  </div>
                `
                : ""
            }


            <div>
              <strong>MOQ:</strong>
              ${esc(product.moq)}
            </div>

          </div>


          <!-- COLOUR -->

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

                    ${colours.map(function (colour) {

                      const colourHasStock =
                        variants.some(function (v) {

                          return (
                            normalise(
                              v.color ||
                              product.color
                            ) ===
                            normalise(colour)
                            &&
                            Number(v.stock) > 0
                          );

                        });

                      return `
                        <option
                          value="${esc(colour)}"
                          ${
                            !colourHasStock
                              ? "disabled"
                              : ""
                          }
                        >
                          ${esc(colour)}
                          ${
                            !colourHasStock
                              ? " — Out of Stock"
                              : ""
                          }
                        </option>
                      `;

                    }).join("")}

                  </select>

                </div>
              `
              : ""
          }


          <!-- SIZE -->

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

                    ${sizeValues.map(function (size) {

                      return `
                        <option
                          value="${esc(size)}"
                        >
                          ${esc(size)}
                        </option>
                      `;

                    }).join("")}

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
                >
                  ${
                    variants.length
                      ? "Select your options"
                      : ""
                  }
                </div>
              `
          }


          <!-- QUANTITY -->

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


          <!-- ACTIONS -->

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


          <!-- SIZE GUIDE -->

          ${
            hasSizes
              ? renderSizeGuide(
                  variants,
                  product
                )
              : ""
          }


          <!-- WHATSAPP -->

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
      showColourSelector,
      hasSizes
    );
  }


  /* -----------------------------
     Size Guide
  ----------------------------- */

  function renderSizeGuide(
    variants,
    product
  ) {

    const guideVariants =
      variants.filter(function (v) {

        return (
          v.size &&
          v.size.toLowerCase() !== "one size"
        );

      });


    if (!guideVariants.length)
      return "";


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

              ${guideVariants.map(function (v) {

                return `
                  <tr>

                    <td>
                      ${esc(v.size)}
                    </td>

                    <td>
                      ${v.bust != null
                        ? esc(v.bust)
                        : "—"}
                    </td>

                    <td>
                      ${v.waist != null
                        ? esc(v.waist)
                        : "—"}
                    </td>

                    <td>
                      ${v.hip != null
                        ? esc(v.hip)
                        : "—"}
                    </td>

                    <td>
                      ${v.shoulder != null
                        ? esc(v.shoulder)
                        : "—"}
                    </td>

                    <td>
                      ${v.top_length != null
                        ? esc(v.top_length)
                        : "—"}
                    </td>

                    <td>
                      ${
                        Number(v.stock) > 0
                          ? "Available"
                          : "Out of Stock"
                      }
                    </td>

                  </tr>
                `;

              }).join("")}

            </tbody>

          </table>

        </div>

      </div>

    `;
  }


  /* -----------------------------
     Gallery
  ----------------------------- */

  function setupGallery() {

    const mainImage =
      document.getElementById(
        "productMainImage"
      );


    document
      .querySelectorAll(".product-thumb")
      .forEach(function (button) {

        button.addEventListener(
          "click",
          function () {

            const image =
              button.dataset.image;

            if (mainImage && image) {

              mainImage.src =
                image;

            }


            document
              .querySelectorAll(
                ".product-thumb"
              )
              .forEach(function (item) {

                item.classList.remove(
                  "active"
                );

              });


            button.classList.add(
              "active"
            );

          }
        );

      });

  }


  /* -----------------------------
     Variant Logic
  ----------------------------- */

  function setupVariantLogic(
    product,
    variants,
    showColourSelector,
    hasSizes
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


    function getSelectedVariant() {

      const selectedColour =
        colourSelect
          ? colourSelect.value
          : null;


      const selectedSize =
        sizeSelect
          ? sizeSelect.value
          : null;


      /*
        If there are actual variant rows,
        always use them for stock.
      */

      if (variants.length) {

        let matches =
          variants.filter(function (v) {

            const variantColour =
              v.color ||
              product.color ||
              "";


            const colourMatches =
              !showColourSelector ||
              !selectedColour ||
              normalise(
                variantColour
              ) ===
              normalise(
                selectedColour
              );


            const sizeMatches =
              !hasSizes ||
              !selectedSize ||
              normalise(
                v.size
              ) ===
              normalise(
                selectedSize
              );


            return (
              colourMatches &&
              sizeMatches
            );

          });


        /*
          Do not allow a selection that
          isn't actually complete.
        */

        if (
          showColourSelector &&
          !selectedColour
        ) {
          return null;
        }


        if (
          hasSizes &&
          !selectedSize
        ) {
          return null;
        }


        /*
          If both colour and size exist,
          there should be exactly one row.
        */

        if (matches.length === 1)
          return matches[0];


        /*
          Legacy data may have duplicate
          colour-less rows. If only one
          remains, use it.
        */

        if (matches.length > 0)
          return matches[0];


        return null;
      }


      /*
        No variant rows:
        allow a simple product only.
      */

      if (
        !showColourSelector &&
        !hasSizes
      ) {

        return {
          id: null,
          size: null,
          color: product.color || null,
          stock: 999999
        };

      }


      return null;
    }


    function updateVariantUI() {

      const variant =
        getSelectedVariant();


      if (!variant) {

        if (stockText) {

          stockText.textContent =
            "Please select available options.";

        }


        if (quantityHelp) {

          quantityHelp.textContent =
            "";

        }


        if (addButton)
          addButton.disabled = true;


        if (buyNowButton)
          buyNowButton.disabled = true;


        return;
      }


      const stock =
        Number(variant.stock || 0);


      if (stock <= 0) {

        if (stockText) {

          stockText.textContent =
            "Out of stock";

          stockText.classList.add(
            "out-of-stock"
          );

        }


        if (quantityHelp) {

          quantityHelp.textContent =
            "This variant is currently out of stock.";

        }


        if (addButton)
          addButton.disabled = true;


        if (buyNowButton)
          buyNowButton.disabled = true;


        return;
      }


      if (stockText) {

        stockText.textContent =
          stock +
          " item(s) available";

        stockText.classList.remove(
          "out-of-stock"
        );

      }


      if (quantityHelp) {

        quantityHelp.textContent =
          "Maximum available: " +
          stock;

      }


      if (qtyInput) {

        qtyInput.max =
          String(stock);

        let qty =
          parseInt(
            qtyInput.value,
            10
          ) || 1;

        if (qty < 1)
          qty = 1;

        if (qty > stock)
          qty = stock;

        qtyInput.value =
          String(qty);

      }


      if (addButton)
        addButton.disabled = false;


      if (buyNowButton)
        buyNowButton.disabled = false;
    }


    if (colourSelect) {

      colourSelect.addEventListener(
        "change",
        function () {

          /*
            When colour changes, reset
            size because the available sizes
            may be different.
          */

          if (sizeSelect) {

            sizeSelect.value =
              "";

          }


          updateVariantUI();

        }
      );

    }


    if (sizeSelect) {

      sizeSelect.addEventListener(
        "change",
        updateVariantUI
      );

    }


    if (qtyInput) {

      qtyInput.addEventListener(
        "input",
        function () {

          const variant =
            getSelectedVariant();

          if (!variant)
            return;


          const stock =
            Number(variant.stock || 0);


          let qty =
            parseInt(
              qtyInput.value,
              10
            ) || 1;


          if (qty < 1)
            qty = 1;


          if (
            stock > 0 &&
            qty > stock
          ) {
            qty = stock;
          }


          qtyInput.value =
            String(qty);

        }
      );

    }


    /*
      ADD TO CART
    */

    if (addButton) {

      addButton.addEventListener(
        "click",
        function () {

          const variant =
            getSelectedVariant();


          if (!variant) {

            showMessage(
              "Please select an available option.",
              true
            );

            return;
          }


          const stock =
            Number(variant.stock || 0);


          let qty =
            parseInt(
              qtyInput?.value,
              10
            ) || 1;


          if (
            stock <= 0 ||
            qty > stock
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


          const success =
            window.SuruShop.addToCart({

              code:
                product.product_code,

              name:
                product.name,

              price:
                Number(product.price || 0),

              image:
                document.getElementById(
                  "productMainImage"
                )?.src ||
                "",

              size:
                variant.size ||
                null,

              color:
                variant.color ||
                product.color ||
                null,

              qty:
                qty

            });


          if (success !== false) {

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
      BUY NOW
    */

    if (buyNowButton) {

      buyNowButton.addEventListener(
        "click",
        function () {

          const variant =
            getSelectedVariant();


          if (!variant) {

            showMessage(
              "Please select an available option.",
              true
            );

            return;
          }


          const stock =
            Number(variant.stock || 0);


          let qty =
            parseInt(
              qtyInput?.value,
              10
            ) || 1;


          if (
            stock <= 0 ||
            qty > stock
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


          const success =
            window.SuruShop.addToCart({

              code:
                product.product_code,

              name:
                product.name,

              price:
                Number(product.price || 0),

              image:
                document.getElementById(
                  "productMainImage"
                )?.src ||
                "",

              size:
                variant.size ||
                null,

              color:
                variant.color ||
                product.color ||
                null,

              qty:
                qty

            });


          if (success !== false) {

            window.location.href =
              "../order.html";

          } else {

            showMessage(
              "Unable to save your cart. Please try again.",
              true
            );

          }

        }
      );

    }


    updateVariantUI();


    function showMessage(
      text,
      error
    ) {

      if (!message)
        return;


      message.textContent =
        text;


      message.classList.toggle(
        "error",
        !!error
      );


      message.classList.add(
        "visible"
      );


      window.setTimeout(
        function () {

          message.classList.remove(
            "visible"
          );

        },
        3000
      );

    }

  }


  /* -----------------------------
     Start
  ----------------------------- */

  loadProduct();

})();
