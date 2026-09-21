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

  /* =========================
     ADMIN CHECK
  ========================= */

  async function isAdmin(session) {

    if (!session?.user) {
      return {
        ok: false,
        error: "No active session."
      };
    }

    const { data, error } = await client.rpc("is_admin");

    if (error) {
      return {
        ok: false,
        error: "Admin check failed: " + error.message
      };
    }

    return {
      ok: data === true,
      error:
        data === true
          ? ""
          : "This account is not authorized for the admin panel."
    };
  }

  /* =========================
     START
  ========================= */

  async function start(sessionOverride = null) {

    try {

      const sessionResult = sessionOverride
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

      const session = sessionResult.data.session;

      if (!session) {

        $("#loginView").classList.remove("hidden");
        $("#appView").classList.add("hidden");

        return false;
      }

      const admin = await isAdmin(session);

      if (!admin.ok) {

        $("#loginView").classList.remove("hidden");
        $("#appView").classList.add("hidden");

        msg(
          $("#loginMessage"),
          admin.error || "Admin authorization failed.",
          "error"
        );

        return false;
      }

      $("#loginView").classList.add("hidden");
      $("#appView").classList.remove("hidden");

      $("#userEmail").textContent =
        session.user.email || "";

      await loadDashboard();

      return true;

    } catch (err) {

      console.error("Admin start error:", err);

      $("#loginView").classList.remove("hidden");
      $("#appView").classList.add("hidden");

      msg(
        $("#loginMessage"),
        "Connection error: " +
          (err?.message || err),
        "error"
      );

      return false;
    }
  }

  /* =========================
     AUTH EVENTS
  ========================= */

  client.auth.onAuthStateChange(
    (event, session) => {

      if (event === "INITIAL_SESSION") {

        setTimeout(() => {
          start(session);
        }, 0);

      }

      if (event === "SIGNED_OUT") {

        $("#loginView").classList.remove("hidden");
        $("#appView").classList.add("hidden");

      }
    }
  );

  /* =========================
     LOGIN
  ========================= */

  $("#loginForm").addEventListener(
    "submit",
    async function (e) {

      e.preventDefault();

      const email =
        $("#loginEmail").value.trim();

      const password =
        $("#loginPassword").value;

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

        const { data, error } =
          await client.auth.signInWithPassword({
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

        console.error("Login error:", err);

        msg(
          $("#loginMessage"),
          err?.message || "Login failed.",
          "error"
        );
      }
    }
  );

  /* =========================
     LOGOUT
  ========================= */

  $("#logoutBtn").onclick =
    async function () {

      await client.auth.signOut();

      location.reload();
    };

  /* =========================
     SIDEBAR
  ========================= */

  $$(".sidebar button").forEach(
    (button) => {

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
            document.getElementById(viewName);

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
    }
  );

  /* =========================
     DASHBOARD
  ========================= */

  async function loadDashboard() {

    try {

      const results =
        await Promise.all([

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

      const orders = results[0].count;
      const products = results[1].count;
      const subscribers = results[2].count;
      const pending = results[3].data || [];

      $("#statOrders").textContent =
        orders ?? 0;

      $("#statProducts").textContent =
        products ?? 0;

      $("#statSubscribers").textContent =
        subscribers ?? 0;

      $("#statPending").textContent =
        pending.filter(
          (x) => x.order_status === "pending"
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

  /* =========================
     ORDER TABLE
  ========================= */

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
      '<table class="table">' +
      "<thead>" +
      "<tr>" +
      "<th>Order</th>" +
      "<th>Customer</th>" +
      "<th>Total</th>" +
      "<th>Status</th>" +
      "<th>Date</th>" +
      (full ? "<th>Update</th>" : "") +
      "</tr>" +
      "</thead>" +
      "<tbody>" +

      rows.map((o) => {

        return `
          <tr>

            <td>
              <b>${esc(o.order_number)}</b>

              ${
                full
                  ? `<div class="order-items"
                       data-items="${esc(o.id)}">
                     </div>`
                  : ""
              }
            </td>

            <td>
              ${esc(o.customer_name)}
              <br>
              <small>
                ${esc(o.customer_phone || "")}
              </small>
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
        `;

      }).join("") +

      "</tbody></table>";

    if (full) {
      loadOrderItems(rows);
    }
  }

  async function loadOrderItems(rows) {

    const ids =
      rows.map((x) => x.id);

    const { data } =
      await client
        .from("order_items")
        .select(
          "order_id,product_name,size,quantity"
        )
        .in("order_id", ids);

    (data || []).forEach((item) => {

      const el =
        document.querySelector(
          `[data-items="${item.order_id}"]`
        );

      if (el) {

        el.textContent +=
          (el.textContent ? ", " : "") +
          `${item.product_name}` +
          `${item.size ? " (" + item.size + ")" : ""}` +
          ` × ${item.quantity}`;
      }
    });
  }

  /* =========================
     ORDERS
  ========================= */

  async function loadOrders() {

    const search =
      $("#orderSearch").value.trim();

    const status =
      $("#orderStatusFilter").value;

    let query =
      client
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

    const { data, error } =
      await query;

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

  $("#orderSearch").addEventListener(
    "input",
    loadOrders
  );

  $("#orderStatusFilter").addEventListener(
    "change",
    loadOrders
  );

  /* =========================
     ORDER STATUS
  ========================= */

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
            order_status: status
          })
          .eq("id", id);

      e.target.disabled = false;

      if (error) {
        alert(error.message);
      }
    }
  );

  /* =========================
     PRODUCTS
  ========================= */

  async function loadProducts() {

    const container =
      $("#productsGrid");

    if (!container) {
      console.error(
        "productsGrid element not found."
      );
      return;
    }

    container.innerHTML =
      '<p class="subscriber-count">Loading products…</p>';

    try {

      console.log(
        "Loading products from Supabase..."
      );

      const result =
        await Promise.race([

          client
            .from("products")
            .select("*")
            .order("created_at", {
              ascending: false
            }),

          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Product request timed out after 15 seconds."
                  )
                ),
              15000
            )
          )

        ]);

      const {
        data,
        error
      } = result;

      console.log(
        "Products response:",
        data,
        error
      );

      if (error) {

        container.innerHTML =
          `<div class="card">
             <p class="message error">
               Product loading failed:<br>
               ${esc(error.message)}
             </p>
           </div>`;

        return;
      }

      if (!data || data.length === 0) {

        container.innerHTML =
          `<div class="card">
             <p class="subscriber-count">
               No products found.
             </p>
           </div>`;

        return;
      }

      container.innerHTML =
        '<div class="product-grid">' +

        data.map((p) => {

          return `
            <div class="product-card-admin">

              <small>
                ${esc(p.product_code || "")}
                ·
                ${esc(p.category || "")}
              </small>

              <h3>
                ${esc(p.name || "")}
              </h3>

              <label>
                Price
                <input
                  type="number"
                  step="0.01"
                  value="${Number(p.price || 0)}"
                  data-price="${p.id}">
              </label>

              <label>
                MOQ
                <input
                  type="number"
                  min="0"
                  value="${Number(p.moq || 0)}"
                  data-moq="${p.id}">
              </label>

              <label>
                <input
                  type="checkbox"
                  ${
                    p.is_active
                      ? "checked"
                      : ""
                  }
                  data-active="${p.id}">
                Active
              </label>

              <label>
                <input
                  type="checkbox"
                  ${
                    p.is_featured
                      ? "checked"
                      : ""
                  }
                  data-featured="${p.id}">
                Featured
              </label>

              <button
                class="primary save-product"
                data-id="${p.id}">
                Save Changes
              </button>

              <span
                class="message"
                id="pm-${p.id}">
              </span>

            </div>
          `;

        }).join("") +

        "</div>";

    } catch (err) {

      console.error(
        "Products loading error:",
        err
      );

      container.innerHTML =
        `<div class="card">
           <p class="message error">
             Product loading failed:<br>
             ${esc(
               err?.message ||
               "Unknown error"
             )}
           </p>
         </div>`;
    }
  }

  /* =========================
     SAVE PRODUCT
  ========================= */

  document.addEventListener(
    "click",
    async function (e) {

      const button =
        e.target.closest(
          ".save-product"
        );

      if (!button) return;

      const id =
        button.dataset.id;

      const get =
        (name) =>
          document.querySelector(
            `[data-${name}="${id}"]`
          );

      const price =
        Number(
          get("price").value
        );

      const moq =
        Math.max(
          0,
          Number(
            get("moq").value
          )
        );

      const payload = {
        price,
        moq,
        is_active:
          get("active").checked,
        is_featured:
          get("featured").checked
      };

      button.disabled = true;

      const { error } =
        await client
          .from("products")
          .update(payload)
          .eq("id", id);

      button.disabled = false;

      const message =
        $("#pm-" + id);

      if (error) {

        msg(
          message,
          "Save failed: " +
            error.message,
          "error"
        );

      } else {

        msg(
          message,
          "Saved successfully.",
          "success"
        );
      }
    }
  );

  /* =========================
     INVENTORY
  ========================= */

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

    if (error) {

      $("#inventoryGrid").innerHTML =
        `<div class="card">
          <p class="message error">
            ${esc(error.message)}
          </p>
        </div>`;

      return;
    }

    $("#inventoryGrid").innerHTML =
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
                            data-old="${s.stock}">

                          <button
                            class="primary save-stock"
                            data-id="${s.id}"
                            data-product="${p.id}">
                            Save
                          </button>

                        </div>
                      `
                    )
                    .join("") ||
                  '<p class="subscriber-count">No sizes configured.</p>'
                }

              </div>
            </div>
          `
        )
        .join("");
  }

  /* =========================
     SAVE STOCK
  ========================= */

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

      const { error } =
        await client
          .from("product_sizes")
          .update({
            stock
          })
          .eq(
            "id",
            button.dataset.id
          );

      if (error) {

        alert(error.message);
        return;
      }

      const diff =
        stock - old;

      if (diff) {

        await client
          .from("inventory_movements")
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

      setTimeout(() => {
        button.textContent =
          "Save";
      }, 1000);
    }
  );

  /* =========================
     SUBSCRIBERS
  ========================= */

  async function loadSubscribers() {

    const {
      data,
      error
    } = await client
      .from("newsletter_subscribers")
      .select("*")
      .order(
        "subscribed_at",
        {
          ascending: false
        }
      );

    if (error) {

      $("#subscribersTable").innerHTML =
        `<p class="message error">
          ${esc(error.message)}
        </p>`;

      return;
    }

    const count =
      data?.length || 0;

    $("#subscriberCount").textContent =
      `${count} subscriber${
        count === 1 ? "" : "s"
      }`;

    $("#subscribersTable").innerHTML =
      `<table class="table">

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
                (s) => `
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

      </table>`;
  }

  /* =========================
     SUBSCRIBER TOGGLE
  ========================= */

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

      const { error } =
        await client
          .from(
            "newsletter_subscribers"
          )
          .update({
            is_active: active
          })
          .eq(
            "id",
            button.dataset.id
          );

      if (error) {
        alert(error.message);
      } else {
        loadSubscribers();
      }
    }
  );

  /* =========================
     INITIAL LOAD
  ========================= */

  start();

});
