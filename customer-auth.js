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
    const { data, error } = await client.rpc("customer_profile");
    return {
      data: data && typeof data === "object" && Object.keys(data).length ? data : null,
      error
    };
  }

  const { data: sessionData } = await client.auth.getSession();
  let session = sessionData?.session || null;

  /* =====================================================
     OTP HELPERS
  ===================================================== */
  function setOtpMode(show) {
    $("otpSection")?.toggleAttribute("hidden", !show);
    $("requestOtpButton")?.toggleAttribute("hidden", show);
    $("sendOtpButton")?.toggleAttribute("hidden", show);
    $("email")?.toggleAttribute("readonly", show);
    $("otp")?.focus();
  }

  function pendingCustomer() {
    try {
      const raw = sessionStorage.getItem("suruPendingCustomer");
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearPendingCustomer() {
    try { sessionStorage.removeItem("suruPendingCustomer"); } catch (_) {}
  }

  async function finishCustomerProfile(user, pending = null) {
    if (!user) return null;

    const existing = await getProfile();
    if (!pending && existing.data) return existing.data;

    const metadata = user.user_metadata || {};
    const p = pending || {};
    const locationData = {
      latitude: p.latitude ?? metadata.latitude ?? null,
      longitude: p.longitude ?? metadata.longitude ?? null,
      location_address: p.location_address || metadata.location_address || null
    };

    const payload = {
      auth_user_id: user.id,
      name: p.name || metadata.name || existing.data?.name || "",
      email: user.email || p.email || existing.data?.email || null,
      phone: p.phone || existing.data?.phone || null,
      address: p.address || existing.data?.address || null,
      city: p.city || existing.data?.city || null,
      district: p.district || existing.data?.district || null,
      province: p.province || existing.data?.province || null,
      postal_code: p.postal_code || existing.data?.postal_code || null,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      location_address: locationData.location_address,
      location_updated_at:
        locationData.latitude != null && locationData.longitude != null
          ? new Date().toISOString()
          : existing.data?.location_updated_at || null,
      is_active: true
    };

    const { data, error } = await client
      .from("customers")
      .upsert(payload, { onConflict: "auth_user_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /* =====================================================
     REDIRECT LOGGED-IN CUSTOMER
  ===================================================== */
  if (session && location.pathname.endsWith("login.html")) {
    location.href = "account.html";
    return;
  }

  /* =====================================================
     LOGIN - PASSWORD OR EMAIL OTP
  ===================================================== */
  $("passwordLoginButton")?.addEventListener("click", async () => {
    const email = $("email")?.value.trim().toLowerCase() || "";
    const password = $("password")?.value || "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMessage("Please enter a valid email address.", "error"); return; }
    if (!password) { showMessage("Please enter your password.", "error"); return; }
    showMessage("Signing in…");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) { showMessage(error.message, "error"); return; }
    if (!data?.session || !data?.user) { showMessage("Sign in was not completed. Please try again.", "error"); return; }
    session = data.session;
    try { await finishCustomerProfile(data.user, null); } catch (e) { showMessage(e.message || "Could not load your customer profile.", "error"); return; }
    location.href = "account.html";
  });

  $("loginForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("email")?.value.trim().toLowerCase() || "";
    const otp = $("otp")?.value.trim() || "";
    if (!email) { showMessage("Please enter your email address.", "error"); return; }
    if (!otp) {
      showMessage("Sending a verification code…");
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) { showMessage(error.message, "error"); return; }
      setOtpMode(true); showMessage("A 6-digit verification code has been sent to your email.", "success"); return;
    }
    if (!/^\d{6}$/.test(otp)) { showMessage("Please enter the 6-digit verification code.", "error"); return; }
    showMessage("Verifying code…");
    const { data, error } = await client.auth.verifyOtp({ email, token: otp, type: "email" });
    if (error) { showMessage(error.message, "error"); return; }
    if (!data?.session || !data?.user) { showMessage("Verification did not create a session. Please request a new code.", "error"); return; }
    session = data.session;
    try { await finishCustomerProfile(data.user, null); } catch (e) { showMessage(e.message || "Could not load your customer profile.", "error"); return; }
    location.href = "account.html";
  });

  /* =====================================================
     REGISTER - PASSWORD + EMAIL OTP VERIFICATION
  ===================================================== */
  $("registerForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("email")?.value.trim().toLowerCase() || "";
    const otp = $("otp")?.value.trim() || "";
    const name = $("name")?.value.trim() || "";
    const phone = $("phone")?.value.trim() || "";
    const password = $("password")?.value || "";
    const confirmPassword = $("confirmPassword")?.value || "";
    const address = $("address")?.value.trim() || "";
    const city = $("city")?.value.trim() || "";
    const district = $("district")?.value.trim() || "";
    const locationData = getLocationFromInputs();
    if (!name) { showMessage("Please enter your name.", "error"); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMessage("Please enter a valid email address.", "error"); return; }
    if (!phone || !/^[+\d][\d\s().-]{6,19}$/.test(phone)) { showMessage("Please enter a valid phone number.", "error"); return; }
    if (password.length < 6) { showMessage("Password must be at least 6 characters.", "error"); return; }
    if (password !== confirmPassword) { showMessage("Passwords do not match.", "error"); return; }
    const pending = { name, email, phone, address, city, district, latitude: locationData.latitude, longitude: locationData.longitude, location_address: locationData.location_address };
    if (!otp) {
      showMessage("Creating your account and sending a verification code…");
      try { sessionStorage.setItem("suruPendingCustomer", JSON.stringify(pending)); } catch (_) {}
      const { error } = await client.auth.signUp({ email, password, options: { data: { name, phone, address, city, district, latitude: locationData.latitude, longitude: locationData.longitude, location_address: locationData.location_address } } });
      if (error) { showMessage(error.message, "error"); return; }
      setOtpMode(true); showMessage("A 6-digit verification code has been sent to your email. Enter it to finish registration.", "success"); return;
    }
    if (!/^\d{6}$/.test(otp)) { showMessage("Please enter the 6-digit verification code.", "error"); return; }
    showMessage("Verifying email and creating your account…");
    let result = await client.auth.verifyOtp({ email, token: otp, type: "signup" });
    if (result.error) { result = await client.auth.verifyOtp({ email, token: otp, type: "email" }); }
    if (result.error) { showMessage(result.error.message, "error"); return; }
    if (!result.data?.session || !result.data?.user) { showMessage("Email verified. Please sign in with your new password.", "success"); location.href = "login.html"; return; }
    session = result.data.session;
    try { await finishCustomerProfile(result.data.user, pendingCustomer() || pending); clearPendingCustomer(); } catch (e) { showMessage(e.message || "Account was verified, but the customer profile could not be saved.", "error"); return; }
    location.href = "account.html";
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
