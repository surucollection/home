const SUPABASE_URL = window.SURU_SUPABASE_URL;
const SUPABASE_KEY = window.SURU_SUPABASE_KEY;

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let loading = false;

/* =========================
   AUTH
========================= */

async function checkAdmin(user) {
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin check error:", error);
    return {
      ok: false,
      message: "Admin verification failed: " + error.message
    };
  }

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

  if (!["admin", "manager"].includes(data.role)) {
    return {
      ok: false,
      message: "This account does not have admin access."
    };
  }

  return {
    ok: true,
    admin: data
  };
}


/* =========================
   SHOW / HIDE
========================= */

function showLogin() {
  const login = $("loginScreen");
  const app = $("adminApp");

  if (login) login.style.display = "";
  if (app) app.style.display = "none";
}

function showApp() {
  const login = $("loginScreen");
  const app = $("adminApp");

  if (login) login.style.display = "none";
  if (app) app.style.display = "";
}


/* =========================
   START
========================= */

async function startAdmin() {
  if (loading) return;

  loading = true;

  try {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error(error);
      showLogin();
      return;
    }

    if (!session || !session.user) {
      currentUser = null;
      showLogin();
      return;
    }

    currentUser = session.user;

    const result = await checkAdmin(currentUser);

    if (!result.ok) {
      console.error(result.message);

      const errorBox = $("loginError");

      if (errorBox) {
        errorBox.textContent = result.message;
        errorBox.style.display = "block";
      }

      showLogin();
      return;
    }

    showApp();

    await loadDashboard();

  } catch (err) {
    console.error("Admin startup error:", err);

    const errorBox = $("loginError");

    if (errorBox) {
      errorBox.textContent = err.message || "Unable to open admin panel.";
      errorBox.style.display = "block";
    }

    showLogin();

  } finally {
    loading = false;
  }
}


/* =========================
   LOGIN
========================= */

async function login(event) {
  event.preventDefault();

  if (loading) return;

  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  const errorBox = $("loginError");
  const button = $("loginButton");

  if (errorBox) {
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }

  if (!email || !password) {
    if (errorBox) {
      errorBox.textContent = "Enter email and password.";
      errorBox.style.display = "block";
    }
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Signing in…";
  }

  loading = true;

  try {

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    if (!data || !data.user) {
      throw new Error("Login succeeded but no user session was returned.");
    }

    currentUser = data.user;

    const result = await checkAdmin(currentUser);

    if (!result.ok) {
      throw new Error(result.message);
    }

    showApp();

    await loadDashboard();

  } catch (err) {

    console.error("Login error:", err);

    if (errorBox) {
      errorBox.textContent = err.message || "Sign in failed.";
      errorBox.style.display = "block";
    }

    showLogin();

  } finally {

    loading = false;

    if (button) {
      button.disabled = false;
      button.textContent = "Sign In";
    }
  }
}


/* =========================
   LOGOUT
========================= */

async function logout() {
  await supabase.auth.signOut();

  currentUser = null;

  showLogin();

  const email = $("email");
  const password = $("password");

  if (email) email.value = "";
  if (password) password.value = "";
}


/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {

  try {

    const [
      ordersResult,
      productsResult,
      subscribersResult
    ] = await Promise.all([

      supabase
        .from("orders")
        .select("id, order_number, customer_name, phone, total, status, created_at")
        .order("created_at", { ascending: false }),

      supabase
        .from("products")
        .select("id, product_code, name, price, active, featured")
        .order("created_at", { ascending: false }),

      supabase
        .from("newsletter_subscribers")
        .select("id, email, is_active, created_at")
        .order("created_at", { ascending: false })

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

    const orders = ordersResult.data || [];
    const products = productsResult.data || [];
    const subscribers = subscribersResult.data || [];

    setText("totalOrders", orders.length);

    setText(
      "pendingOrders",
      orders.filter(x => x.status === "pending").length
    );

    setText(
      "activeProducts",
      products.filter(x => x.active).length
    );

    setText(
      "activeSubscribers",
      subscribers.filter(x => x.is_active).length
    );

    renderRecentOrders(orders.slice(0, 10));

  } catch (err) {

    console.error("Dashboard error:", err);

  }
}


/* =========================
   HELPERS
========================= */

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}


/* =========================
   RECENT ORDERS
========================= */

function renderRecentOrders(orders) {

  const container =
    $("recentOrders") ||
    $("recentOrdersTable") ||
    $("dashboardOrders");

  if (!container) return;

  if (!orders.length) {
    container.innerHTML =
      `<div class="empty">No orders yet.</div>`;
    return;
  }

  container.innerHTML = orders.map(order => `
    <div class="order-row">

      <div>
        <strong>${escapeHtml(order.order_number || "")}</strong>
        <small>${escapeHtml(order.customer_name || "")}</small>
      </div>

      <div>
        ${escapeHtml(order.phone || "")}
      </div>

      <div>
        NPR ${Number(order.total || 0).toLocaleString("en-IN")}
      </div>

      <div>
        <span class="status status-${escapeHtml(order.status || "")}">
          ${escapeHtml(order.status || "")}
        </span>
      </div>

    </div>
  `).join("");
}


/* =========================
   ESCAPE HTML
========================= */

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================
   AUTH STATE
========================= */

supabase.auth.onAuthStateChange((event, session) => {

  console.log("Auth event:", event);

  if (event === "SIGNED_OUT") {
    currentUser = null;
    showLogin();
  }

});


/* =========================
   EVENTS
========================= */

document.addEventListener("DOMContentLoaded", () => {

  const loginForm = $("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", login);
  }

  const logoutButton = $("logoutButton");

  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }

  startAdmin();

});
