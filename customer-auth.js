/* =====================================================
   SURU COLLECTION - CUSTOMER AUTHENTICATION
   Email OTP Login / Registration / Account
   + Saved delivery map location

   Customers can authenticate with either their email/password or email OTP.
   Phone is NOT used for authentication. A phone number can
   still be collected at checkout because it is useful for delivery.
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const client = window.supabase.createClient(
    window.SURU_SUPABASE_URL,
    window.SURU_SUPABASE_KEY
  );

  const $ = id => document.getElementById(id);

  function showMessage(text, type = "") {
    const el = $("message");
    if (!el) return;
    el.textContent = text;
    el.className = "message " + type;
  }

  function getLocationPicker() {
    return window.suruRegisterLocationPicker ||
      window.suruAccountLocationPicker ||
      window.SuruLocationPickerInstance ||
      null;
  }

  function getLocationFromInputs() {
    const latitude = parseFloat($("locationLatitude")?.value);
    const longitude = parseFloat($("locationLongitude")?.value);
    return {
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      location_address: $("locationAddress")?.value.trim() || null
    };
  }

  /* =====================================================
     MAIN NAVIGATION / YEAR
  ===================================================== */
  const menuToggle = $("menuToggle");
  const mainNav = $("mainNav");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", function () {
      const open = mainNav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(open));
    });

    mainNav.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", function () {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const year = $("year");
  if (year) year.textContent = new Date().getFullYear();

  async function getProfile() {
    const { data, error } = await client.rpc("my_customer_profile");
    let profile = data;
    if (typeof profile === "string") {
      try { profile = JSON.parse(profile); } catch (_) {}
    }
    const hasProfile = profile && typeof profile === "object" && Object.keys(profile).length > 0;
    if (error) return { data: null, error };
    return { data: hasProfile ? profile : null, error: null };
  }

  const { data: sessionData } = await client.auth.getSession();
  let session = sessionData?.session || null;

  /* =====================================================
     LOGIN - EMAIL/PASSWORD ONLY
  ===================================================== */
  $("passwordLoginButton")?.addEventListener("click", async () => {
    const identifier = $("email")?.value.trim().toLowerCase() || "";
    const password = $("password")?.value || "";

    if (!identifier || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      showMessage("Please enter a valid email address.", "error"); return;
    }
    if (!password) { showMessage("Please enter your password.", "error"); return; }

    showMessage("Signing in…");
    const { data, error } = await client.auth.signInWithPassword({
      email: identifier,
      password
    });
    if (error) {
      showMessage(error.message, "error");
      return;
    }
    if (!data?.session || !data?.user) {
      showMessage("Sign in was not completed. Please try again.", "error");
      return;
    }
    session = data.session;
    try {
      await finishCustomerProfile(data.user, null);
    } catch (e) {
      showMessage(e.message || "Could not load your customer profile.", "error");
      return;
    }
    location.href = "account.html";
  });

  /* =====================================================
     REGISTER - PASSWORD (NO EMAIL VERIFICATION)
  ===================================================== */
  $("registerForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("email")?.value.trim().toLowerCase() || "";
    const name = $("name")?.value.trim() || "";
    const password = $("password")?.value || "";
    const confirmPassword = $("confirmPassword")?.value || "";
    const phone = $("phone")?.value.trim() || "";
    const address = $("address")?.value.trim() || "";
    const city = $("city")?.value.trim() || "";
    const district = $("district")?.value.trim() || "";
    const locationData = getLocationFromInputs();

    if (!name) { showMessage("Please enter your name.", "error"); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMessage("Please enter a valid email address.", "error"); return; }
    if (password.length < 6) { showMessage("Password must be at least 6 characters.", "error"); return; }
    if (password !== confirmPassword) { showMessage("Passwords do not match.", "error"); return; }
    if (!phone) { showMessage("Please enter your phone number.", "error"); return; }

    showMessage("Creating your account…");
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          name, phone, address, city, district,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          location_address: locationData.location_address
        }
      }
    });

    if (error) { showMessage(error.message, "error"); return; }

    const user = data?.user;
    if (!user) { showMessage("Account creation did not complete. Please try again.", "error"); return; }

    // With Supabase "Confirm email" disabled, signUp returns an active session.
    // If it is still enabled, Supabase returns no session and the user must
    // confirm their email; show a clear message instead of pretending signup succeeded.
    if (!data?.session) {
      showMessage('Your account was created, but Supabase still requires email confirmation. Please disable "Confirm email" in Authentication → Providers → Email and try again.', "error");
      return;
    }

    session = data.session;
    try {
      await finishCustomerProfile(user, {
        name, email, phone, address, city, district,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        location_address: locationData.location_address
      });
    } catch (e) {
      showMessage(e.message || "Account was created, but the customer profile could not be saved.", "error");
      return;
    }

    showMessage("Account created successfully. Redirecting…", "success");
    setTimeout(() => { location.href = "account.html"; }, 350);
  });

  /* =====================================================
     LOGOUT
  ===================================================== */
  $("logoutBtn")?.addEventListener("click", async () => {
    await client.auth.signOut();
    location.href = "login.html";
  });

  /* =====================================================
     ACCOUNT PAGE
  ===================================================== */
  if (location.pathname.endsWith("account.html")) {
    if (!session) {
      location.href = "login.html";
      return;
    }

    const { data: profile, error } = await getProfile();
    if (error) {
      showMessage(error.message, "error");
      return;
    }
    if (!profile) {
      showMessage("Customer profile not found.", "error");
      return;
    }

    if ($("customerName")) $("customerName").textContent = profile.name || "Customer";
    if ($("profileName")) $("profileName").textContent = profile.name || "—";
    if ($("profileEmail")) $("profileEmail").textContent = profile.email || session.user.email || "—";
    if ($("profilePhone")) $("profilePhone").textContent = profile.phone || "Not added";
    if ($("profileAddress")) $("profileAddress").textContent = profile.address || "—";
    if ($("profileCity")) $("profileCity").textContent = [profile.city, profile.district].filter(Boolean).join(", ") || "—";

    const accountPicker = window.suruAccountLocationPicker;
    if (accountPicker && profile.latitude != null && profile.longitude != null) {
      accountPicker.setLocation(
        profile.latitude,
        profile.longitude,
        profile.location_address || `Saved map pin: ${Number(profile.latitude).toFixed(6)}, ${Number(profile.longitude).toFixed(6)}`
      );
    }

    const locationMissing = profile.latitude == null || profile.longitude == null;
    if ($("accountLocationPrompt") && locationMissing) {
      $("accountLocationPrompt").textContent =
        "Your delivery map location is not saved. Please save it now or it will be requested during checkout.";
    }

    $("saveAccountLocation")?.addEventListener("click", async () => {
      const locationData = accountPicker?.getLocation?.() || getLocationFromInputs();
      if (locationData.latitude == null || locationData.longitude == null) {
        showMessage("Please use your current location or set a pin on the map.", "error");
        return;
      }

      const { error } = await client
        .from("customers")
        .update({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          location_address: locationData.location_address || null,
          location_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("auth_user_id", session.user.id);

      if (error) {
        showMessage(error.message, "error");
        return;
      }

      showMessage("Delivery location saved successfully.", "success");
      if ($("accountLocationPrompt")) {
        $("accountLocationPrompt").textContent =
          "Your delivery location is saved and will be used for future orders.";
      }
    });

    /* -----------------------------
       ORDERS
    ----------------------------- */
    const { data: orders, error: orderError } = await client
      .from("orders")
      .select(`
        id,
        order_number,
        total,
        payment_method,
        payment_status,
        order_status,
        shipping_address,
        city,
        delivery_latitude,
        delivery_longitude,
        created_at,
        order_items(
          product_name,
          size,
          color,
          quantity,
          unit_price,
          total_price
        )
      `)
      .eq("customer_id", profile.id)
      .order("created_at", { ascending: false });

    if (orderError) {
      if ($("orders")) $("orders").innerHTML = `<p class="message error">${orderError.message}</p>`;
      return;
    }
    if (!$("orders")) return;

    if (!orders?.length) {
      $("orders").innerHTML = "<p>No orders yet.</p>";
    } else {
      $("orders").innerHTML = orders.map(order => {
        const items = order.order_items || [];
        const mapLink = order.delivery_latitude != null && order.delivery_longitude != null
          ? `<a class="location-map-link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${encodeURIComponent(order.delivery_latitude + "," + order.delivery_longitude)}">View delivery pin</a>`
          : "";
        return `
          <article class="order-card">
            <div class="order-head"><strong>${order.order_number || "Order"}</strong><span>${order.order_status || "pending"}</span></div>
            <p>${new Date(order.created_at).toLocaleString()}</p>
            <div class="order-items">
              ${items.map(item => `<div>${item.product_name || ""}${item.color ? ` · ${item.color}` : ""}${item.size ? ` · ${item.size}` : ""} × ${item.quantity}</div>`).join("")}
            </div>
            <strong class="order-total">NPR ${Number(order.total || 0).toLocaleString("en-IN")}</strong>
            <small>Payment: ${order.payment_method || "—"} · ${order.payment_status || "—"}</small>
            ${mapLink}
          </article>`;
      }).join("");
    }
  }
});
