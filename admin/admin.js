document.addEventListener("DOMContentLoaded", () => {

  // ==============================
  // SUPABASE
  // ==============================

  const client = window.supabase.createClient(
    window.SURU_SUPABASE_URL,
    window.SURU_SUPABASE_KEY
  );

  // ==============================
  // HELPERS
  // ==============================

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

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

  function showLogin() {
    const loginView = $("#loginView");
    const appView = $("#appView");

    if (loginView) loginView.classList.remove("hidden");
    if (appView) appView.classList.add("hidden");
  }

  function showApp(session) {
    const loginView = $("#loginView");
    const appView = $("#appView");

    if (loginView) loginView.classList.add("hidden");
    if (appView) appView.classList.remove("hidden");

    const userEmail = $("#userEmail");

    if (userEmail && session?.user) {
      userEmail.textContent = session.user.email || "";
    }
  }

  // ==============================
  // ADMIN CHECK
  // ==============================

  async function isAdmin(session) {

    if (!session?.user) {
      return {
        ok: false,
        error: "No active session."
      };
    }

    try {

      const { data, error } = await client.rpc("is_admin");

      if (error) {
        return {
          ok: false,
          error: "Admin check failed: " + error.message
        };
      }

      if (data === true) {
        return {
          ok: true
        };
      }

      return {
        ok: false,
        error: "This account is not authorized for the admin panel."
      };

    } catch (err) {

      return {
        ok: false,
        error: err?.message || String(err)
      };

    }
  }

  // ==============================
  // START APPLICATION
  // ==============================

  let starting = false;

  async function start(sessionOverride = null) {

    if (starting) return false;

    starting = true;

    try {

      let session;

      if (sessionOverride) {

        session = sessionOverride;

      } else {

        const {
          data,
          error
        } = await client.auth.getSession();

        if (error) throw error;

        session = data?.session || null;
      }

      // No login
      if (!session) {

        showLogin();

        msg(
          $("#loginMessage"),
          "",
          ""
        );

        return false;
      }

      // Check admin
      const admin = await isAdmin(session);

      if (!admin.ok) {

        showLogin();

        msg(
          $("#loginMessage"),
          admin.error || "Admin authorization failed.",
          "error"
        );

        return false;
      }

      // Authorized
      showApp(session);

      await loadDashboard();

      return true;

    } catch (err) {

      showLogin();

      msg(
        $("#loginMessage"),
        "Connection error: " + (err?.message || err),
        "error"
      );

      return false;

    } finally {

      starting = false;
    }
  }

  // ==============================
  // LOGIN
  // ==============================

  const loginForm = $("#loginForm");

  if (loginForm) {

    loginForm.addEventListener("submit", async (e) => {

      e.preventDefault();

      const emailInput = $("#loginEmail");
      const passwordInput = $("#loginPassword");

      const email = emailInput?.value.trim() || "";
      const password = passwordInput?.value || "";

      if (!email || !password) {

        msg(
          $("#loginMessage"),
          "Please enter email and password.",
          "error"
        );

        return;
      }

      const button = loginForm.querySelector("button[type='submit']");

      if (button) {
        button.disabled = true;
        button.textContent = "Signing in…";
      }

      msg(
        $("#loginMessage"),
        "Signing in…",
        ""
      );

      try {

        const {
          data,
          error
        } = await client.auth.signInWithPassword({
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

        if (!data?.session) {

          msg(
            $("#loginMessage"),
            "Login succeeded but no session was returned. Please try again.",
            "error"
          );

          return;
        }

        const success = await start(data.session);

        if (success && passwordInput) {
          passwordInput.value = "";
        }

      } catch (err) {

        msg(
          $("#loginMessage"),
          err?.message || String(err),
          "error"
        );

      } finally {

        if (button) {

          button.disabled = false;
          button.textContent = "Sign In";

        }
      }

    });

  }

  // ==============================
  // AUTH STATE
  // ==============================

  client.auth.onAuthStateChange((event, session) => {

    if (event === "SIGNED_OUT") {

      showLogin();

      return;
    }

    // Do not repeatedly restart the application
    // on TOKEN_REFRESHED.
    if (event === "INITIAL_SESSION") {

      setTimeout(() => {
        start(session);
      }, 0);

    }

  });

  // ==============================
  // LOGOUT
  // ==============================

  const logoutBtn = $("#logoutBtn");

  if (logoutBtn) {

    logoutBtn.addEventListener("click", async () => {

      logoutBtn.disabled = true;
      logoutBtn.textContent = "Signing out…";

      await client.auth.signOut();

      location.reload();

    });

  }

  // ==============================
  // SIDEBAR
  // ==============================

  $$(".sidebar button").forEach((button) => {

    button.addEventListener("click", async () => {

      $$(".sidebar button").forEach((b) =>
        b.classList.remove("active")
      );

      button.classList.add("active");

      $$(".view").forEach((view) =>
        view.classList.remove("active")
      );

      const viewName = button.dataset.view;
      const view = $("#" + viewName);

      if (view) {
        view.classList.add("active");
      }

      const loaders = {
        dashboard: loadDashboard,
        orders: loadOrders,
        products: loadProducts,
        inventory: loadInventory,
        subscribers: loadSubscribers
      };

      if (loaders[viewName]) {
        await loaders[viewName]();
      }

    });

  });

  // ==============================
  // DASHBOARD
  // ==============================

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

      if (ordersResult.error) {
        console.error("Orders:", ordersResult.error);
      }

      if (productsResult.error) {
        console.error("Products:", productsResult.error);
      }

      if (subscribersResult.error) {
        console.error("Subscribers:", subscribersResult.error);
      }

      if (pendingResult.error) {
        console.error("Recent orders:", pendingResult.error);
      }

      const statOrders = $("#statOrders");
      const statProducts = $("#statProducts");
      const statSubscribers = $("#statSubscribers");
      const statPending = $("#statPending");

      if (statOrders) {
        statOrders.textContent = ordersResult.count ?? 0;
      }

      if (statProducts) {
        statProducts.textContent = productsResult.count ?? 0;
      }

      if (statSubscribers) {
        statSubscribers.textContent = subscribersResult.count ?? 0;
      }

      const pendingOrders = pendingResult.data || [];

      if (statPending) {
        statPending.textContent =
          pendingOrders.filter(
            (x) => x.order_status === "pending"
          ).length;
      }

      renderOrderTable(
        $("#recentOrders"),
        pendingOrders,
        false
      );

    } catch (err) {

      console.error("Dashboard error:", err);

    }

  }

  // ==============================
  // ORDER TABLE
  // ==============================

  function renderOrderTable(el, rows, full = true) {

    if (!el) return;

    if (!rows.length) {

      el.innerHTML =
        '<p class="subscriber-count">No orders found.</p>';

      return;
    }

    el.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Status</th>
            <th>Date</th>
            ${full ? "<th>Update</th>" : ""}
          </tr>
        </thead>

        <tbody>

          ${rows.map((o) => `

            <tr>

              <td>
                <b>${esc(o.order_number)}</b>

                ${
                  full
                    ? `<div class="order-items" data-items="${esc(o.id)}"></div>`
                    : ""
                }

              </td>

              <td>
                ${esc(o.customer_name)}
                <br>
                <small>${esc(o.customer_phone || "")}</small>
              </td>

              <td>
                ${money(o.total)}
              </td>

              <td>
                <span class="badge">
                  ${esc(o.order_status)}
                </span>
              </td>

              <td>
                ${new Date(o.created_at).toLocaleString()}
              </td>

              ${
                full
                  ? `
                    <td>
                      <select
                        class="status-select"
                        data-id="${o.id}"
                      >

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
                              (s) =>
                                `<option ${
                                  s === o.order_status
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

  // ==============================
  // ORDER ITEMS
  // ==============================

  async function loadOrderItems(rows) {

    if (!rows.length) return;

    const ids = rows.map((x) => x.id);

    const {
      data,
      error
    } = await client
      .from("order_items")
      .select(
        "order_id,product_name,size,quantity"
      )
      .in("order_id", ids);

    if (error) {

      console.error("Order items:", error);

      return;
    }

    (data || []).forEach((item) => {

      const el = document.querySelector(
        `[data-items="${item.order_id}"]`
      );

      if (!el) return;

      const text =
        `${item.product_name}` +
        `${item.size ? " (" + item.size + ")" : ""}` +
        ` × ${item.quantity}`;

      el.textContent +=
        (el.textContent ? ", " : "") + text;

    });

  }

  // ==============================
  // ORDERS
  // ==============================

  async function loadOrders() {

    const search =
      $("#orderSearch")?.value.trim() || "";

    const status =
      $("#orderStatusFilter")?.value || "";

    let query = client
      .from("orders")
      .select("*")
      .order("created_at", {
        ascending: false
      })
      .limit(100);

    if (status) {
      query = query.eq(
        "order_status",
        status
      );
    }

    if (search) {

      query = query.or(
        `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
      );

    }

    const {
      data,
      error
    } = await query;

    if (error) {

      const el = $("#ordersTable");

      if (el) {

        el.innerHTML =
          `<p class="message error">${esc(error.message)}</p>`;

      }

      return;
    }

    renderOrderTable(
      $("#ordersTable"),
      data || [],
      true
    );

  }

  const orderSearch = $("#orderSearch");

  if (orderSearch) {
    orderSearch.addEventListener(
      "input",
      loadOrders
    );
  }

  const orderStatusFilter =
    $("#orderStatusFilter");

  if (orderStatusFilter) {
    orderStatusFilter.addEventListener(
      "change",
      loadOrders
    );
  }

  // ==============================
  // ORDER STATUS
  // ==============================

  document.addEventListener(
    "change",
    async (e) => {

      if (
        !e.target.matches(".status-select")
      ) {
        return;
      }

      const id = e.target.dataset.id;
      const status = e.target.value;

      e.target.disabled = true;

      const {
        error
      } = await client
        .from("orders")
        .update({
          order_status: status
        })
        .eq("id", id);

      e.target.disabled = false;

      if (error) {

        alert(error.message);

        return;
      }

      await loadDashboard();

    }
  );

  // ==============================
  // PRODUCTS
  // ==============================

  async function loadProducts() {

    const {
      data,
      error
    } = await client
      .from("products")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    const grid = $("#productsGrid");

    if (!grid) return;

    if (error) {

      grid.innerHTML =
        `<p class="message error">${esc(error.message)}</p>`;

      return;
    }

    grid.innerHTML = `
      <div class="product-grid">

        ${(data || []).map((p) => `

          <div class="product-card-admin">

            <small>
              ${esc(p.product_code)}
              ·
              ${esc(p.category)}
            </small>

            <h3>
              ${esc(p.name)}
            </h3>

            <label>
              Price

              <input
                type="number"
                step="0.01"
                value="${p.price}"
                data-price="${p.id}"
              >
            </label>

            <label>
              MOQ

              <input
                type="number"
                value="${p.moq}"
                data-moq="${p.id}"
              >
            </label>

            <label>
              <input
                type="checkbox"
                ${p.is_active ? "checked" : ""}
                data-active="${p.id}"
              >
              Active
            </label>

            <label>
              <input
                type="checkbox"
                ${p.is_featured ? "checked" : ""}
                data-featured="${p.id}"
              >
              Featured
            </label>

            <button
              class="primary save-product"
              data-id="${p.id}"
            >
              Save Changes
            </button>

            <span
              class="message"
              id="pm-${p.id}"
            ></span>

          </div>

        `).join("")}

      </div>
    `;

  }

  // ==============================
  // SAVE PRODUCT
  // ==============================

  document.addEventListener(
    "click",
    async (e) => {

      const button =
        e.target.closest(".save-product");

      if (!button) return;

      const id = button.dataset.id;

      const get = (name) =>
        document.querySelector(
          `[data-${name}="${id}"]`
        );

      const priceInput = get("price");
      const moqInput = get("moq");
      const activeInput = get("active");
      const featuredInput = get("featured");

      if (
        !priceInput ||
        !moqInput ||
        !activeInput ||
        !featuredInput
      ) {
        return;
      }

      const payload = {

        price:
          Number(priceInput.value),

        moq:
          Math.max(
            0,
            Number(moqInput.value)
          ),

        is_active:
          activeInput.checked,

        is_featured:
          featuredInput.checked

      };

      button.disabled = true;

      const {
        error
      } = await client
        .from("products")
        .update(payload)
        .eq("id", id);

      button.disabled = false;

      const message =
        $("#pm-" + id);

      if (error) {

        msg(
          message,
          "Save failed: " + error.message,
          "error"
        );

      } else {

        msg(
          message,
          "Saved",
          "success"
        );

      }

    }
  );

  // ==============================
  // INVENTORY
  // ==============================

  async function loadInventory() {

    const {
      data,
      error
    } = await client
      .from("products")
      .select(
        "id,product_code,name,product_sizes(id,size,stock,is_active)"
      )
      .order("product_code");

    const grid = $("#inventoryGrid");

    if (!grid) return;

    if (error) {

      grid.innerHTML = `
        <div class="card">
          <p class="message error">
            ${esc(error.message)}
          </p>
        </div>
      `;

      return;
    }

    grid.innerHTML =
      (data || [])
        .map(
          (p) => `

            <div class="card">

              <h3>
                ${esc(p.product_code)}
                —
                ${esc(p.name)}
              </h3>

              <div class="stock-list">

                ${
                  (p.product_sizes || [])
                    .map(
                      (s) => `

                        <div class="stock-row">

                          <span>
                            <b>
                              ${esc(s.size)}
                            </b>
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

                      `
                    )
                    .join("")
                  ||
                  '<p class="subscriber-count">No sizes configured.</p>'
                }

              </div>

            </div>

          `
        )
        .join("");

  }

  // ==============================
  // SAVE INVENTORY
  // ==============================

  document.addEventListener(
    "click",
    async (e) => {

      const button =
        e.target.closest(".save-stock");

      if (!button) return;

      const input =
        document.querySelector(
          `[data-stock="${button.dataset.id}"]`
        );

      if (!input) return;

      const oldStock =
        Number(input.dataset.old || 0);

      const newStock =
        Math.max(
          0,
          parseInt(input.value || 0, 10)
        );

      button.disabled = true;

      const {
        error
      } = await client
        .from("product_sizes")
        .update({
          stock: newStock
        })
        .eq("id", button.dataset.id);

      if (error) {

        button.disabled = false;

        alert(error.message);

        return;
      }

      const difference =
        newStock - oldStock;

      if (difference !== 0) {

        await client
          .from("inventory_movements")
          .insert({

            product_id:
              button.dataset.product,

            size_id:
              button.dataset.id,

            quantity_change:
              difference,

            reason:
              "admin_stock_adjustment"

          });

      }

      input.dataset.old = newStock;

      button.disabled = false;
      button.textContent = "Saved";

      setTimeout(() => {
        button.textContent = "Save";
      }, 1000);

    }
  );

  // ==============================
  // NEWSLETTER SUBSCRIBERS
  // ==============================

  async function loadSubscribers() {

    const {
      data,
      error
    } = await client
      .from("newsletter_subscribers")
      .select("*")
      .order("subscribed_at", {
        ascending: false
      });

    const table =
      $("#subscribersTable");

    if (!table) return;

    if (error) {

      table.innerHTML =
        `<p class="message error">${esc(error.message)}</p>`;

      return;
    }

    const subscribers =
      data || [];

    const count =
      subscribers.length;

    const countEl =
      $("#subscriberCount");

    if (countEl) {

      countEl.textContent =
        `${count} subscriber${count === 1 ? "" : "s"}`;

    }

    table.innerHTML = `

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

          ${subscribers.map((s) => `

            <tr>

              <td>
                ${esc(s.email)}
              </td>

              <td>
                ${new Date(
                  s.subscribed_at
                ).toLocaleString()}
              </td>

              <td>
                ${s.is_active ? "Active" : "Inactive"}
              </td>

              <td>

                <button
                  class="${
                    s.is_active
                      ? "danger"
                      : "secondary"
                  } toggle-sub"
                  data-id="${s.id}"
                  data-active="${s.is_active}"
                >
                  ${
                    s.is_active
                      ? "Deactivate"
                      : "Activate"
                  }
                </button>

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    `;

  }

  // ==============================
  // TOGGLE SUBSCRIBER
  // ==============================

  document.addEventListener(
    "click",
    async (e) => {

      const button =
        e.target.closest(".toggle-sub");

      if (!button) return;

      const active =
        button.dataset.active !== "true";

      const {
        error
      } = await client
        .from("newsletter_subscribers")
        .update({
          is_active: active
        })
        .eq("id", button.dataset.id);

      if (error) {

        alert(error.message);

        return;
      }

      await loadSubscribers();

    }
  );

  // ==============================
  // INITIAL LOAD
  // ==============================

  start();

});
