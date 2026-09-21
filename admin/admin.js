const client = window.supabase.createClient(
  window.SURU_SUPABASE_URL,
  window.SURU_SUPABASE_KEY
);

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const money = (n) =>
  "NPR " + Number(n || 0).toLocaleString("en-IN");

const esc = (s) =>
  String(s ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));

function msg(text, type = "") {
  const el = $("#loginMessage");
  if (!el) return;

  el.textContent = text;
  el.className = "message " + type;
}


/* =========================
   SHOW LOGIN
========================= */

function showLogin() {
  $("#loginView").classList.remove("hidden");
  $("#appView").classList.add("hidden");
}


/* =========================
   SHOW ADMIN
========================= */

function showAdmin(session) {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");

  if ($("#userEmail")) {
    $("#userEmail").textContent =
      session?.user?.email || "";
  }
}


/* =========================
   CHECK ADMIN
========================= */

async function checkAdmin() {

  const {
    data: { session },
    error
  } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.user) {
    return {
      ok: false,
      message: "No active session."
    };
  }

  console.log("Logged-in user:", session.user.id);

  const { data, error: adminError } =
    await client
      .from("admin_users")
      .select("id, role, is_active")
      .eq("id", session.user.id)
      .maybeSingle();

  if (adminError) {
    console.error("Admin table error:", adminError);

    return {
      ok: false,
      message: "Admin verification failed: " +
        adminError.message
    };
  }

  console.log("Admin record:", data);

  if (!data) {
    return {
      ok: false,
      message: "This account is not registered as an admin."
    };
  }

  if (!data.is_active) {
    return {
      ok: false,
      message: "This admin account is inactive."
    };
  }

  if (
    data.role !== "admin" &&
    data.role !== "manager"
  ) {
    return {
      ok: false,
      message: "This account does not have admin access."
    };
  }

  return {
    ok: true,
    session,
    admin: data
  };
}


/* =========================
   INITIAL LOAD
========================= */

async function initialize() {

  try {

    const result = await checkAdmin();

    if (!result.ok) {
      showLogin();

      if (result.message !== "No active session.") {
        msg(result.message, "error");
      }

      return;
    }

    showAdmin(result.session);

    await loadDashboard();

  } catch (error) {

    console.error("INITIALIZATION ERROR:", error);

    showLogin();

    msg(
      "Connection error: " +
      (error.message || error),
      "error"
    );
  }
}


/* =========================
   LOGIN
========================= */

$("#loginForm").addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();

    const email =
      $("#loginEmail").value.trim();

    const password =
      $("#loginPassword").value;

    if (!email || !password) {
      msg(
        "Please enter email and password.",
        "error"
      );
      return;
    }

    const button =
      $("#loginForm button[type='submit']");

    if (button) {
      button.disabled = true;
      button.textContent = "Signing in…";
    }

    msg("Signing in…");

    try {

      console.log("Attempting Supabase login...");

      const {
        data,
        error
      } = await client.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        console.error("LOGIN ERROR:", error);

        msg(
          error.message,
          "error"
        );

        return;
      }

      console.log(
        "LOGIN SUCCESS:",
        data.user
      );

      if (!data.session) {
        throw new Error(
          "Login succeeded but Supabase did not return a session."
        );
      }

      /*
       IMPORTANT:
       Do NOT call signOut if admin verification
       fails. That was causing the confusing loop.
      */

      const adminResult = await checkAdmin();

      if (!adminResult.ok) {

        msg(
          adminResult.message,
          "error"
        );

        showLogin();

        return;
      }

      console.log(
        "ADMIN VERIFIED:",
        adminResult.admin
      );

      showAdmin(data.session);

      $("#loginPassword").value = "";

      await loadDashboard();

    } catch (error) {

      console.error(
        "LOGIN/ADMIN ERROR:",
        error
      );

      showLogin();

      msg(
        error.message ||
        "Unable to sign in.",
        "error"
      );

    } finally {

      if (button) {
        button.disabled = false;
        button.textContent = "Sign In";
      }
    }
  }
);


/* =========================
   LOGOUT
========================= */

$("#logoutBtn").addEventListener(
  "click",
  async function () {

    await client.auth.signOut();

    showLogin();

    $("#loginEmail").value = "";
    $("#loginPassword").value = "";

    msg("");
  }
);


/* =========================
   AUTH STATE
========================= */

/*
Do NOT call initialize() from
SIGNED_IN.

The login function already handles it.
This prevents duplicate login/start loops.
*/

client.auth.onAuthStateChange(
  (event, session) => {

    console.log(
      "AUTH EVENT:",
      event
    );

    if (event === "SIGNED_OUT") {
      showLogin();
    }
  }
);


/* =========================
   NAVIGATION
========================= */

$$(".sidebar button").forEach(button => {

  button.addEventListener(
    "click",
    async function () {

      $$(".sidebar button")
        .forEach(b =>
          b.classList.remove("active")
        );

      button.classList.add("active");

      $$(".view")
        .forEach(v =>
          v.classList.remove("active")
        );

      const view =
        $("#" + button.dataset.view);

      if (view) {
        view.classList.add("active");
      }

      const functions = {
        dashboard: loadDashboard,
        orders: loadOrders,
        products: loadProducts,
        inventory: loadInventory,
        subscribers: loadSubscribers
      };

      if (functions[button.dataset.view]) {
        await functions[button.dataset.view]();
      }
    }
  );
});


/* =========================
   DASHBOARD
========================= */

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

    if (ordersResult.error)
      console.error(ordersResult.error);

    if (productsResult.error)
      console.error(productsResult.error);

    if (subscribersResult.error)
      console.error(subscribersResult.error);

    if (pendingResult.error)
      console.error(pendingResult.error);

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
        x => x.order_status === "pending"
      ).length;

    renderOrderTable(
      $("#recentOrders"),
      pending,
      false
    );

  } catch (error) {

    console.error(
      "Dashboard error:",
      error
    );
  }
}


/* =========================
   ORDER TABLE
========================= */

function renderOrderTable(
  element,
  rows,
  full = true
) {

  if (!rows.length) {

    element.innerHTML =
      '<p class="subscriber-count">No orders found.</p>';

    return;
  }

  element.innerHTML = `
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

        ${rows.map(o => `

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
                        ].map(s =>
                          `<option ${
                            s === o.order_status
                              ? "selected"
                              : ""
                          }>${s}</option>`
                        ).join("")
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


/* =========================
   ORDER ITEMS
========================= */

async function loadOrderItems(rows) {

  const ids =
    rows.map(x => x.id);

  if (!ids.length) return;

  const { data, error } =
    await client
      .from("order_items")
      .select(
        "order_id,product_name,size,quantity"
      )
      .in("order_id", ids);

  if (error) {
    console.error(error);
    return;
  }

  (data || []).forEach(item => {

    const el =
      document.querySelector(
        `[data-items="${item.order_id}"]`
      );

    if (!el) return;

    const text =
      `${item.product_name}` +
      `${item.size ? " (" + item.size + ")" : ""}` +
      ` × ${item.quantity}`;

    el.textContent +=
      el.textContent
        ? ", " + text
        : text;
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
    query =
      query.eq(
        "order_status",
        status
      );
  }

  if (search) {

    query =
      query.or(
        `order_number.ilike.%${search}%,` +
        `customer_name.ilike.%${search}%,` +
        `customer_phone.ilike.%${search}%`
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


/* =========================
   CHANGE ORDER STATUS
========================= */

document.addEventListener(
  "change",
  async function (event) {

    if (
      !event.target.matches(
        ".status-select"
      )
    ) return;

    const id =
      event.target.dataset.id;

    const status =
      event.target.value;

    event.target.disabled = true;

    const { error } =
      await client
        .from("orders")
        .update({
          order_status: status
        })
        .eq("id", id);

    event.target.disabled = false;

    if (error) {
      alert(error.message);
    }
  }
);


/* =========================
   PRODUCTS
========================= */

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

    $("#productsGrid").innerHTML =
      `<p class="message error">
        ${esc(error.message)}
      </p>`;

    return;
  }

  $("#productsGrid").innerHTML =
    `<div class="product-grid">

      ${(data || []).map(p => `

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

    </div>`;
}


/* =========================
   SAVE PRODUCT
========================= */

document.addEventListener(
  "click",
  async function (event) {

    const button =
      event.target.closest(
        ".save-product"
      );

    if (!button) return;

    const id =
      button.dataset.id;

    const get =
      name =>
        document.querySelector(
          `[data-${name}="${id}"]`
        );

    const payload = {

      price:
        Number(
          get("price").value
        ),

      moq:
        Math.max(
          0,
          Number(
            get("moq").value
          )
        ),

      is_active:
        get("active").checked,

      is_featured:
        get("featured").checked
    };

    const { error } =
      await client
        .from("products")
        .update(payload)
        .eq("id", id);

    msgProduct(
      id,
      error
        ? "Save failed: " + error.message
        : "Saved",
      error
        ? "error"
        : "success"
    );
  }
);

function msgProduct(
  id,
  text,
  type
) {

  const el =
    $("#pm-" + id);

  if (!el) return;

  el.textContent = text;
  el.className =
    "message " + type;
}


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
    (data || []).map(p => `

      <div class="card">

        <h3>
          ${esc(p.product_code)}
          —
          ${esc(p.name)}
        </h3>

        <div class="stock-list">

          ${
            (p.product_sizes || []).map(s => `

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

            `).join("")
            ||
            "<p class='subscriber-count'>No sizes configured.</p>"
          }

        </div>

      </div>

    `).join("");
}


/* =========================
   SAVE STOCK
========================= */

document.addEventListener(
  "click",
  async function (event) {

    const button =
      event.target.closest(
        ".save-stock"
      );

    if (!button) return;

    const input =
      document.querySelector(
        `[data-stock="${button.dataset.id}"]`
      );

    const old =
      Number(input.dataset.old);

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
        .update({ stock })
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

    input.dataset.old = stock;

    button.textContent = "Saved";

    setTimeout(
      () =>
        button.textContent = "Save",
      1000
    );
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
      { ascending: false }
    );

  if (error) {

    $("#subscribersTable").innerHTML =
      `<p class="message error">
        ${esc(error.message)}
      </p>`;

    return;
  }

  $("#subscriberCount").textContent =
    `${data?.length || 0} subscriber${
      (data?.length || 0) === 1
        ? ""
        : "s"
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

        ${(data || []).map(s => `

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

        `).join("")}

      </tbody>

    </table>`;
}


/* =========================
   TOGGLE SUBSCRIBER
========================= */

document.addEventListener(
  "click",
  async function (event) {

    const button =
      event.target.closest(
        ".toggle-sub"
      );

    if (!button) return;

    const active =
      button.dataset.active !== "true";

    const { error } =
      await client
        .from("newsletter_subscribers")
        .update({
          is_active: active
        })
        .eq(
          "id",
          button.dataset.id
        );

    if (error) {
      alert(error.message);
      return;
    }

    await loadSubscribers();
  }
);


/* =========================
   START
========================= */

initialize();
