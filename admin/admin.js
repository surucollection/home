/* =========================================================
   SURU COLLECTION — ADMIN PANEL
   Supabase Authentication + Admin Dashboard
   ========================================================= */

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
   AUTHENTICATION
   ========================================================= */

async function checkAdmin(user) {
  if (!user) {
    return {
      ok: false,
      error: "No active session."
    };
  }

  /*
    IMPORTANT:
    Check admin_users directly instead of relying on the
    is_admin RPC for the browser login flow.
  */

  const { data, error } = await client
    .from("admin_users")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin check error:", error);

    return {
      ok: false,
      error: error.message
    };
  }

  if (!data) {
    return {
      ok: false,
      error: "This account is not registered as an admin."
    };
  }

  if (!data.is_active) {
    return {
      ok: false,
      error: "This admin account is inactive."
    };
  }

  if (data.role !== "admin" && data.role !== "manager") {
    return {
      ok: false,
      error: "This account does not have admin access."
    };
  }

  return {
    ok: true,
    admin: data
  };
}


/* =========================================================
   SHOW / HIDE VIEWS
   ========================================================= */

function showLogin(message = "", type = "") {
  const login = $("#loginView");
  const app = $("#appView");

  if (login) login.classList.remove("hidden");
  if (app) app.classList.add("hidden");

  if (message && $("#loginMessage")) {
    msg($("#loginMessage"), message, type);
  }
}

function showApp(user) {
  const login = $("#loginView");
  const app = $("#appView");

  if (login) login.classList.add("hidden");
  if (app) app.classList.remove("hidden");

  if ($("#userEmail")) {
    $("#userEmail").textContent = user?.email || "";
  }
}


/* =========================================================
   START APPLICATION
   ========================================================= */

let starting = false;

async function start() {

  /*
    Prevent multiple simultaneous authentication checks.
    This is important because Supabase can fire auth events
    while sign-in is still completing.
  */
  if (starting) return;

  starting = true;

  try {

    const {
      data: { session },
      error
    } = await client.auth.getSession();

    if (error) {
      console.error("Session error:", error);
      showLogin("Unable to check login session: " + error.message, "error");
      return;
    }

    if (!session || !session.user) {
      showLogin();
      return;
    }

    console.log("Logged in user:", session.user.email);
    console.log("User ID:", session.user.id);

    const admin = await checkAdmin(session.user);

    if (!admin.ok) {

      console.error("Admin authorization failed:", admin.error);

      /*
        DO NOT repeatedly call signOut here.
        That can create a login loop when the database/RLS
        temporarily rejects the admin check.
      */

      showLogin(admin.error, "error");
      return;
    }

    console.log("Admin authorization successful:", admin.admin);

    showApp(session.user);

    await loadDashboard();

  } catch (err) {

    console.error("Admin startup error:", err);

    showLogin(
      "Connection error: " + (err?.message || err),
      "error"
    );

  } finally {

    starting = false;

  }
}


/* =========================================================
   LOGIN
   ========================================================= */

const loginForm = $("#loginForm");

if (loginForm) {

  loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = $("#loginEmail")?.value.trim();
    const password = $("#loginPassword")?.value;

    if (!email || !password) {
      msg(
        $("#loginMessage"),
        "Please enter your email and password.",
        "error"
      );
      return;
    }

    msg($("#loginMessage"), "Signing in…");

    const { data, error } =
      await client.auth.signInWithPassword({
        email,
        password
      });

    if (error) {

      console.error("Login error:", error);

      msg(
        $("#loginMessage"),
        error.message,
        "error"
      );

      return;
    }

    console.log(
      "Supabase login successful:",
      data?.user?.email
    );

    /*
      Give Supabase a moment to persist the session,
      then perform exactly one startup check.
    */

    setTimeout(() => {
      start();
    }, 300);

  });

}


/* =========================================================
   LOGOUT
   ========================================================= */

const logoutBtn = $("#logoutBtn");

if (logoutBtn) {

  logoutBtn.addEventListener("click", async () => {

    logoutBtn.disabled = true;

    const { error } = await client.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      logoutBtn.disabled = false;
      alert(error.message);
      return;
    }

    window.location.reload();

  });

}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

client.auth.onAuthStateChange((event, session) => {

  console.log(
    "Auth event:",
    event,
    session?.user?.email || "no user"
  );

  /*
    Do not immediately run multiple start() calls for every
    auth event. SIGNED_IN is handled after login and INITIAL_SESSION
    is handled during initial page load.
  */

  if (event === "INITIAL_SESSION") {
    start();
  }

});


/* =========================================================
   SIDEBAR NAVIGATION
   ========================================================= */

$$(".sidebar button").forEach((button) => {

  button.addEventListener("click", () => {

    $$(".sidebar button").forEach((b) =>
      b.classList.remove("active")
    );

    button.classList.add("active");

    $$(".view").forEach((view) =>
      view.classList.remove("active")
    );

    const viewId = button.dataset.view;
    const view = $("#" + viewId);

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

    if (loaders[viewId]) {
      loaders[viewId]();
    }

  });

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

    if ($("#statOrders")) {
      $("#statOrders").textContent =
        ordersResult.count ?? 0;
    }

    if ($("#statProducts")) {
      $("#statProducts").textContent =
        productsResult.count ?? 0;
    }

    if ($("#statSubscribers")) {
      $("#statSubscribers").textContent =
        subscribersResult.count ?? 0;
    }

    const pending = pendingResult.data || [];

    if ($("#statPending")) {
      $("#statPending").textContent =
        pending.filter(
          (x) => x.order_status === "pending"
        ).length;
    }

    if ($("#recentOrders")) {
      renderOrderTable(
        $("#recentOrders"),
        pending,
        false
      );
    }

  } catch (err) {

    console.error("Dashboard error:", err);

  }

}


/* =========================================================
   ORDERS
   ========================================================= */

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
                  ? `<div
                      class="order-items"
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
              ${new Date(o.created_at).toLocaleString()}
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
                            (s) => `
                              <option
                                ${
                                  s === o.order_status
                                    ? "selected"
                                    : ""
                                }>
                                ${s}
                              </option>
                            `
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

  const ids = rows.map((x) => x.id);

  if (!ids.length) return;

  const { data, error } = await client
    .from("order_items")
    .select(
      "order_id,product_name,size,quantity"
    )
    .in("order_id", ids);

  if (error) {
    console.error("Order items error:", error);
    return;
  }

  (data || []).forEach((item) => {

    const el = document.querySelector(
      `[data-items="${item.order_id}"]`
    );

    if (!el) return;

    el.textContent +=
      (el.textContent ? ", " : "") +
      `${item.product_name}` +
      `${item.size ? " (" + item.size + ")" : ""}` +
      ` × ${item.quantity}`;

  });

}


async function loadOrders() {

  const search =
    $("#orderSearch")?.value.trim() || "";

  const status =
    $("#orderStatusFilter")?.value || "";

  let q = client
    .from("orders")
    .select("*")
    .order("created_at", {
      ascending: false
    })
    .limit(100);

  if (status) {
    q = q.eq("order_status", status);
  }

  if (search) {

    q = q.or(
      `order_number.ilike.%${search}%,` +
      `customer_name.ilike.%${search}%,` +
      `customer_phone.ilike.%${search}%`
    );

  }

  const { data, error } = await q;

  if (error) {

    console.error("Orders error:", error);

    if ($("#ordersTable")) {
      $("#ordersTable").innerHTML =
        `<p class="message error">
          ${esc(error.message)}
        </p>`;
    }

    return;
  }

  renderOrderTable(
    $("#ordersTable"),
    data || [],
    true
  );

}


$("#orderSearch")?.addEventListener(
  "input",
  loadOrders
);

$("#orderStatusFilter")?.addEventListener(
  "change",
  loadOrders
);


/* =========================================================
   UPDATE ORDER STATUS
   ========================================================= */

document.addEventListener("change", async (e) => {

  if (!e.target.matches(".status-select")) {
    return;
  }

  const id = e.target.dataset.id;
  const status = e.target.value;

  e.target.disabled = true;

  const { error } = await client
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

  loadOrders();

});


/* =========================================================
   PRODUCTS
   ========================================================= */

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

  if (error) {

    console.error("Products error:", error);

    if ($("#productsGrid")) {
      $("#productsGrid").innerHTML =
        `<p class="message error">
          ${esc(error.message)}
        </p>`;
    }

    return;
  }

  if (!$("#productsGrid")) return;

  $("#productsGrid").innerHTML = `
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
              data-price="${p.id}">
          </label>

          <label>
            MOQ

            <input
              type="number"
              value="${p.moq}"
              data-moq="${p.id}">
          </label>

          <label>
            <input
              type="checkbox"
              ${p.is_active ? "checked" : ""}
              data-active="${p.id}">

            Active
          </label>

          <label>
            <input
              type="checkbox"
              ${p.is_featured ? "checked" : ""}
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

      `).join("")}

    </div>
  `;

}


/* =========================================================
   SAVE PRODUCT
   ========================================================= */

document.addEventListener("click", async (e) => {

  const button =
    e.target.closest(".save-product");

  if (!button) return;

  const id = button.dataset.id;

  const get = (name) =>
    document.querySelector(
      `[data-${name}="${id}"]`
    );

  const payload = {

    price: Number(
      get("price").value
    ),

    moq: Math.max(
      0,
      Number(get("moq").value)
    ),

    is_active:
      get("active").checked,

    is_featured:
      get("featured").checked

  };

  button.disabled = true;

  const { error } = await client
    .from("products")
    .update(payload)
    .eq("id", id);

  button.disabled = false;

  msg(
    $("#pm-" + id),
    error
      ? "Save failed: " + error.message
      : "Saved",
    error
      ? "error"
      : "success"
  );

});


/* =========================================================
   INVENTORY
   ========================================================= */

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

    console.error("Inventory error:", error);

    if ($("#inventoryGrid")) {
      $("#inventoryGrid").innerHTML =
        `<div class="card">
          <p class="message error">
            ${esc(error.message)}
          </p>
        </div>`;
    }

    return;
  }

  if (!$("#inventoryGrid")) return;

  $("#inventoryGrid").innerHTML =
    (data || []).map((p) => `

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

    `).join("");

}


/* =========================================================
   SAVE INVENTORY
   ========================================================= */

document.addEventListener("click", async (e) => {

  const button =
    e.target.closest(".save-stock");

  if (!button) return;

  const input =
    document.querySelector(
      `[data-stock="${button.dataset.id}"]`
    );

  if (!input) return;

  const old =
    Number(input.dataset.old || 0);

  const stock =
    Math.max(
      0,
      parseInt(input.value || 0, 10)
    );

  button.disabled = true;

  const { error } = await client
    .from("product_sizes")
    .update({
      stock
    })
    .eq("id", button.dataset.id);

  button.disabled = false;

  if (error) {

    alert(error.message);

    return;
  }

  const diff = stock - old;

  if (diff !== 0) {

    const { error: movementError } =
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

    if (movementError) {
      console.error(
        "Inventory movement error:",
        movementError
      );
    }

  }

  input.dataset.old = stock;

  button.textContent = "Saved";

  setTimeout(() => {
    button.textContent = "Save";
  }, 1000);

});


/* =========================================================
   NEWSLETTER SUBSCRIBERS
   ========================================================= */

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

  if (error) {

    console.error(
      "Subscribers error:",
      error
    );

    if ($("#subscribersTable")) {
      $("#subscribersTable").innerHTML =
        `<p class="message error">
          ${esc(error.message)}
        </p>`;
    }

    return;
  }

  const subscribers = data || [];

  if ($("#subscriberCount")) {
    $("#subscriberCount").textContent =
      `${subscribers.length} subscriber` +
      `${subscribers.length === 1 ? "" : "s"}`;
  }

  if (!$("#subscribersTable")) return;

  $("#subscribersTable").innerHTML = `

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
              ${s.is_active
                ? "Active"
                : "Inactive"}
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

        `).join("")}

      </tbody>

    </table>

  `;

}


/* =========================================================
   TOGGLE SUBSCRIBER
   ========================================================= */

document.addEventListener("click", async (e) => {

  const button =
    e.target.closest(".toggle-sub");

  if (!button) return;

  const active =
    button.dataset.active !== "true";

  button.disabled = true;

  const { error } = await client
    .from("newsletter_subscribers")
    .update({
      is_active: active
    })
    .eq("id", button.dataset.id);

  button.disabled = false;

  if (error) {

    alert(error.message);

    return;
  }

  loadSubscribers();

});


/* =========================================================
   INITIALIZE
   ========================================================= */

start();
