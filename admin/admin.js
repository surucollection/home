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

          if (viewName === "subscribers") {
            await loadSubscribers();
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
        subscribersResult,
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
          .from("newsletter_subscribers")
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

      $("#statSubscribers").textContent =
        subscribersResult.count ?? 0;

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
                ? "<th>Update</th>"
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
     SUBSCRIBERS
  ========================================================= */

  async function loadSubscribers() {

    const {
      data,
      error
    } =
      await client
        .from(
          "newsletter_subscribers"
        )
        .select("*")
        .order(
          "subscribed_at",
          {
            ascending: false
          }
        );

    if (error) {

      $("#subscribersTable")
        .innerHTML =
        `<p class="message error">
          ${esc(error.message)}
        </p>`;

      return;
    }

    const count =
      data?.length || 0;

    $("#subscriberCount")
      .textContent =
      `${count} subscriber${
        count === 1
          ? ""
          : "s"
      }`;

    $("#subscribersTable")
      .innerHTML = `

        <table class="table">

          <thead>
            <tr>
              <th>Email</th>
              <th>Subscribed</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>

            ${
              (data || [])
                .map(
                  s => `

                    <tr>

                      <td>
                        ${esc(
                          s.email
                        )}
                      </td>

                      <td>
                        ${new Date(
                          s.subscribed_at
                        ).toLocaleString()}
                      </td>

                      <td>
                        ${
                          s.is_active
                            ? "Active"
                            : "Inactive"
                        }
                      </td>

                      <td>

                        <button
                          class="${
                            s.is_active
                              ? "danger"
                              : "secondary"
                          } toggle-sub"
                          data-id="${s.id}"
                          data-active="${s.is_active}">

                          ${
                            s.is_active
                              ? "Deactivate"
                              : "Activate"
                          }

                        </button>

                      </td>

                    </tr>

                  `
                )
                .join("")
            }

          </tbody>

        </table>
      `;
  }


  /* =========================================================
     SUBSCRIBER TOGGLE
  ========================================================= */

  document.addEventListener(
    "click",
    async function (e) {

      const button =
        e.target.closest(
          ".toggle-sub"
        );

      if (!button) return;

      const active =
        button.dataset.active !==
        "true";

      const {
        error
      } =
        await client
          .from(
            "newsletter_subscribers"
          )
          .update({
            is_active:
              active
          })
          .eq(
            "id",
            button.dataset.id
          );

      if (error) {

        alert(
          error.message
        );

      } else {

        await loadSubscribers();
      }
    }
  );


  /* =========================================================
     INITIAL START
  ========================================================= */

  start();

});
