(function () {

  "use strict";


  const root =
    document.getElementById("productRoot");


  if (!root) {
    return;
  }


  /* =====================================================
     HELPERS
  ===================================================== */

  function escapeHtml(value) {

    return String(value ?? "")
      .replace(
        /[&<>'"]/g,
        function (char) {

          return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
          }[char];

        }
      );

  }


  function money(value) {

    return (
      "NPR " +
      Number(value || 0)
        .toLocaleString("en-IN")
    );

  }


  function showError(
    title,
    message
  ) {

    root.innerHTML = `

      <div class="product-not-found">

        <h1>
          ${escapeHtml(title)}
        </h1>

        <p>
          ${escapeHtml(message)}
        </p>

        <a
          class="hero-btn"
          href="../index.html#products"
        >
          Back to Products →
        </a>

      </div>

    `;

  }


  /* =====================================================
     GET PRODUCT CODE
  ===================================================== */

  const params =
    new URLSearchParams(
      window.location.search
    );


  const code =
    (
      params.get("code") || ""
    ).trim();


  if (!code) {

    showError(
      "Product not found",
      "Please return to the collection and choose a product."
    );

    return;

  }


  /* =====================================================
     CHECK SUPABASE
  ===================================================== */

  if (
    !window.supabase ||
    !window.SURU_SUPABASE_URL ||
    !window.SURU_SUPABASE_KEY
  ) {

    showError(
      "Product unavailable",
      "The product service could not be loaded. Please refresh the page and try again."
    );

    return;

  }


  const client =
    window.supabase.createClient(
      window.SURU_SUPABASE_URL,
      window.SURU_SUPABASE_KEY
    );


  /* =====================================================
     LOAD PRODUCT
  ===================================================== */

  async function loadProduct() {

    try {

      console.log(
        "Loading product:",
        code
      );


      /* -----------------------------
         Product
      ----------------------------- */

      const productResult =
        await client
          .from("products")
          .select(`
            id,
            product_code,
            name,
            slug,
            category,
            description,
            price,
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


      if (productResult.error) {

        console.error(
          "Product query error:",
          productResult.error
        );

        throw productResult.error;

      }


      const product =
        productResult.data;


      if (!product) {

        showError(
          "Product not found",
          "This product is no longer available."
        );

        return;

      }


      /* -----------------------------
         Images
      ----------------------------- */

      const imageResult =
        await client
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


      if (imageResult.error) {

        console.warn(
          "Product image query error:",
          imageResult.error
        );

      }


      const images =
        (
          imageResult.data || []
        )
        .filter(function (image) {

          return (
            image &&
            image.image_url
          );

        })
        .sort(function (a, b) {

          return (
            Number(a.sort_order || 0) -
            Number(b.sort_order || 0)
          );

        });


      /* -----------------------------
         Sizes
      ----------------------------- */

      const sizeResult =
        await client
          .from("product_sizes")
          .select(`
            size,
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
            "created_at",
            {
              ascending: true
            }
          );


      if (sizeResult.error) {

        console.warn(
          "Product size query error:",
          sizeResult.error
        );

      }


      const sizes =
        sizeResult.data || [];


      /* =================================================
         MAIN IMAGE
      ================================================= */

      const mainImageObject =
        images.find(function (image) {

          return image.is_main === true;

        }) ||
        images[0];


      const mainImage =
        mainImageObject
          ? mainImageObject.image_url
          : "";


      const mainAlt =
        mainImageObject &&
        mainImageObject.alt_text
          ? mainImageObject.alt_text
          : product.name;


      /* =================================================
         META
      ================================================= */

      document.title =
        product.name +
        " | Suru Collection";


      const meta =
        document.getElementById(
          "metaDescription"
        );


      if (meta) {

        meta.content =
          product.description ||
          (
            product.name +
            " from Suru Collection."
          );

      }


      /* =================================================
         SIZE OPTIONS
      ================================================= */

      let sizeHtml = "";


      if (sizes.length) {

        const options =
          sizes.map(
            function (size) {

              const stock =
                Number(
                  size.stock || 0
                );


              return `

                <option
                  value="${escapeHtml(
                    size.size
                  )}"
                  ${
                    stock <= 0
                      ? "disabled"
                      : ""
                  }
                >

                  ${escapeHtml(
                    size.size
                  )}

                  ${
                    stock <= 0
                      ? " — Out of stock"
                      : ""
                  }

                </option>

              `;

            }
          ).join("");


        sizeHtml = `

          <label for="size">
            Select Size
          </label>

          <select
            id="size"
            class="size-select"
          >

            <option value="">
              Choose size
            </option>

            ${options}

          </select>

        `;

      }


      /* =================================================
         PRODUCT DETAILS
      ================================================= */

      const details = [

        [
          "Fabric",
          product.fabric
        ],

        [
          "Color",
          product.color
        ],

        [
          "Pattern",
          product.pattern
        ],

        [
          "MOQ",
          product.moq
        ]

      ].filter(
        function (item) {

          return (
            item[1] !== null &&
            item[1] !== undefined &&
            item[1] !== ""
          );

        }
      );


      const detailsHtml =
        details.length

          ? `

            <ul class="detail-list">

              ${details.map(
                function (item) {

                  return `

                    <li>

                      <span>
                        ${escapeHtml(
                          item[0]
                        )}
                      </span>

                      <strong>
                        ${escapeHtml(
                          item[1]
                        )}
                      </strong>

                    </li>

                  `;

                }
              ).join("")}

            </ul>

          `

          : "";


      /* =================================================
         MAIN IMAGE
      ================================================= */

      const imageHtml =
        mainImage

          ? `

            <img
              id="mainProductImage"
              src="${escapeHtml(
                mainImage
              )}"
              alt="${escapeHtml(
                mainAlt
              )}"
              onerror="
                this.style.display='none';
                this.parentElement.classList.add('image-error');
              "
            >

          `

          : `

            <div class="image-unavailable">
              Product image unavailable
            </div>

          `;


      /* =================================================
         THUMBNAILS
      ================================================= */

      const thumbs =
        images.map(
          function (image, index) {

            return `

              <button
                type="button"
                class="thumb ${
                  index === 0
                    ? "selected"
                    : ""
                }"
                data-src="${escapeHtml(
                  image.image_url
                )}"
                aria-label="View image ${
                  index + 1
                }"
              >

                <img
                  src="${escapeHtml(
                    image.image_url
                  )}"
                  alt="${escapeHtml(
                    image.alt_text ||
                    (
                      product.name +
                      " image " +
                      (index + 1)
                    )
                  )}"
                  loading="lazy"
                >

              </button>

            `;

          }
        ).join("");


      /* =================================================
         WHATSAPP
      ================================================= */

      const whatsappMessage =
        encodeURIComponent(
          "Hello Suru Collection, I am interested in " +
          product.product_code +
          " - " +
          product.name +
          ". Please share availability and ordering details."
        );


      /* =================================================
         RENDER
      ================================================= */

      root.innerHTML = `

        <div class="breadcrumbs">

          <a href="../index.html">
            Home
          </a>

          <span>›</span>

          <a href="../index.html#products">
            ${escapeHtml(
              product.category ||
              "Products"
            )}
          </a>

          <span>›</span>

          <b>
            ${escapeHtml(
              product.product_code
            )}
          </b>

        </div>


        <section class="product-layout">


          <div class="gallery">

            <div class="main-photo">

              ${imageHtml}

            </div>


            ${
              images.length

                ? `

                  <div class="thumbs">

                    ${thumbs}

                  </div>

                `

                : ""
            }

          </div>


          <div class="product-info">

            <p class="eyebrow">

              ${escapeHtml(
                product.category ||
                "SURU COLLECTION"
              )}

            </p>


            <h1>

              ${escapeHtml(
                product.name
              )}

            </h1>


            <div class="price">

              ${money(
                product.price
              )}

            </div>


            <p class="intro">

              ${escapeHtml(
                product.description ||
                "A thoughtfully selected piece from Suru Collection, designed for elegant occasions and effortless traditional style."
              )}

            </p>


            ${detailsHtml}


            <div class="buy-box">

              ${sizeHtml}


              <div class="qty-row">

                <label for="qty">
                  Quantity
                </label>

                <input
                  id="qty"
                  class="qty-input"
                  type="number"
                  min="1"
                  value="1"
                >

              </div>


              <button
                type="button"
                class="buy-button"
                data-code="${escapeHtml(
                  product.product_code
                )}"
                data-name="${escapeHtml(
                  product.name
                )}"
                data-price="${Number(
                  product.price || 0
                )}"
                data-image="${escapeHtml(
                  mainImage
                )}"
              >

                Add to Cart

              </button>

            </div>


            <a
              class="wa-button"
              href="https://wa.me/9779740381427?text=${whatsappMessage}"
              target="_blank"
              rel="noopener"
            >

              Enquire on WhatsApp
              <span>→</span>

            </a>


            <p class="small-note">

              Prices are in Nepalese Rupees.
              Availability is subject to stock.

            </p>

          </div>

        </section>


        ${
          sizes.length

            ? `

              <section class="size-section">

                <p class="eyebrow">
                  SIZE GUIDE
                </p>

                <h2>
                  Measurements
                </h2>


                <div class="table-wrap">

                  <table>

                    <thead>

                      <tr>

                        <th>Size</th>
                        <th>Bust</th>
                        <th>Waist</th>
                        <th>Hip</th>
                        <th>Shoulder</th>
                        <th>Top Length</th>
                        <th>Bottom Length</th>
                        <th>Dupatta</th>
                        <th>Stock</th>

                      </tr>

                    </thead>


                    <tbody>

                      ${sizes.map(
                        function (size) {

                          const unit =
                            escapeHtml(
                              size.unit || ""
                            );


                          const stock =
                            Number(
                              size.stock || 0
                            );


                          return `

                            <tr>

                              <th>
                                ${escapeHtml(
                                  size.size
                                )}
                              </th>

                              <td>
                                ${
                                  size.bust ??
                                  "—"
                                }
                                ${unit}
                              </td>

                              <td>
                                ${
                                  size.waist ??
                                  "—"
                                }
                                ${unit}
                              </td>

                              <td>
                                ${
                                  size.hip ??
                                  "—"
                                }
                                ${unit}
                              </td>

                              <td>
                                ${
                                  size.shoulder ??
                                  "—"
                                }
                                ${unit}
                              </td>

                              <td>
                                ${
                                  size.top_length ??
                                  "—"
                                }
                                ${unit}
                              </td>

                              <td>
                                ${
                                  size.bottom_length ??
                                  "—"
                                }
                                ${unit}
                              </td>

                              <td>
                                ${
                                  size.dupatta_length ??
                                  "—"
                                }
                                ${unit}
                              </td>

                              <td>
                                ${
                                  stock > 0
                                    ? "Available"
                                    : "Out of stock"
                                }
                              </td>

                            </tr>

                          `;

                        }
                      ).join("")}

                    </tbody>

                  </table>

                </div>

              </section>

            `

            : ""
        }

      `;


      /* =================================================
         THUMBNAIL EVENTS
      ================================================= */

      root
        .querySelectorAll(".thumb")
        .forEach(
          function (button) {

            button.addEventListener(
              "click",
              function () {

                const image =
                  root.querySelector(
                    "#mainProductImage"
                  );


                if (image) {

                  image.src =
                    button.dataset.src;

                  image.style.display =
                    "block";

                  image.parentElement
                    .classList
                    .remove(
                      "image-error"
                    );

                }


                root
                  .querySelectorAll(
                    ".thumb"
                  )
                  .forEach(
                    function (item) {

                      item.classList.remove(
                        "selected"
                      );

                    }
                  );


                button.classList.add(
                  "selected"
                );

              }
            );

          }
        );


      console.log(
        "Product loaded successfully:",
        product.product_code
      );


    } catch (error) {

      console.error(
        "Suru Collection product load failed:",
        error
      );


      showError(
        "Product unavailable",
        "We could not load this product right now. Please refresh the page and try again."
      );

    }

  }


  loadProduct();

})();
