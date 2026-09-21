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
            "../order.html";

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
