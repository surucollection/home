/* =====================================================
   SURU COLLECTION - CUSTOMER AUTHENTICATION
   Phone + Password Login / Registration / Account
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

  /* =====================================================
     PHONE NORMALIZATION
  ===================================================== */

  function normalizePhone(value) {

    let phone = String(value || "")
      .trim()
      .replace(/[\s-]/g, "");

    // 9812345678
    if (/^9\d{9}$/.test(phone)) {
      return "+977" + phone;
    }

    // 9779812345678
    if (/^9779\d{9}$/.test(phone)) {
      return "+" + phone;
    }

    // +9779812345678
    return phone;
  }

  /* =====================================================
     GET CUSTOMER PROFILE
  ===================================================== */

  async function getProfile() {

    const { data, error } = await client.rpc(
      "customer_profile"
    );

    return {
      data:
        data &&
        typeof data === "object" &&
        Object.keys(data).length
          ? data
          : null,
      error
    };
  }

  /* =====================================================
     CURRENT SESSION
  ===================================================== */

  const {
    data: sessionData
  } = await client.auth.getSession();

  const session = sessionData?.session || null;

  /* =====================================================
     REDIRECT LOGGED-IN CUSTOMER
  ===================================================== */

  if (
    session &&
    location.pathname.endsWith("login.html")
  ) {
    location.href = "account.html";
    return;
  }

  /* =====================================================
     LOGIN
  ===================================================== */

  $("loginForm")?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      showMessage("Signing in…");

      const phone = normalizePhone(
        $("phone")?.value
      );

      const password =
        $("password")?.value || "";

      if (!phone || !password) {
        showMessage(
          "Please enter your phone number and password.",
          "error"
        );
        return;
      }

      const {
        data,
        error
      } = await client.auth.signInWithPassword({
        phone,
        password
      });

      if (error) {

        showMessage(
          error.message,
          "error"
        );

        return;
      }

      if (!data?.session) {

        showMessage(
          "Please complete phone verification before signing in.",
          "error"
        );

        return;
      }

      location.href = "account.html";
    }
  );

  /* =====================================================
     REGISTER
  ===================================================== */

  $("registerForm")?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      showMessage("Creating your account…");

      const name =
        $("name")?.value.trim() || "";

      const phone =
        normalizePhone(
          $("phone")?.value
        );

      const password =
        $("password")?.value || "";

      const confirm =
        $("confirmPassword")?.value || "";

      const address =
        $("address")?.value.trim() || "";

      const city =
        $("city")?.value.trim() || "";

      const district =
        $("district")?.value.trim() || "";

      /* -----------------------------
         VALIDATION
      ----------------------------- */

      if (!name) {

        showMessage(
          "Please enter your name.",
          "error"
        );

        return;
      }

      if (
        !/^\+9779\d{9}$/.test(phone)
      ) {

        showMessage(
          "Please enter a valid Nepal mobile number.",
          "error"
        );

        return;
      }

      if (password.length < 6) {

        showMessage(
          "Password must be at least 6 characters.",
          "error"
        );

        return;
      }

      if (password !== confirm) {

        showMessage(
          "Passwords do not match.",
          "error"
        );

        return;
      }

      /* -----------------------------
         CREATE AUTH USER
      ----------------------------- */

      const {
        data,
        error
      } = await client.auth.signUp({

        phone,

        password,

        options: {
          data: {
            name,
            phone,
            address,
            city,
            district
          }
        }

      });

      if (error) {

        showMessage(
          error.message,
          "error"
        );

        return;
      }

      /* -----------------------------
         CREATE CUSTOMER PROFILE
         IF SESSION EXISTS
      ----------------------------- */

      if (data?.user && data?.session) {

        const {
          error: profileError
        } = await client
          .from("customers")
          .upsert(
            {
              auth_user_id: data.user.id,
              name,
              phone,
              address,
              city,
              district,
              is_active: true
            },
            {
              onConflict: "auth_user_id"
            }
          );

        if (profileError) {

          showMessage(
            profileError.message,
            "error"
          );

          return;
        }

        location.href =
          "account.html";

        return;
      }

      /* -----------------------------
         PHONE VERIFICATION REQUIRED
      ----------------------------- */

      if (data?.user && !data?.session) {

        /*
          Store registration details temporarily.
          They can be used after phone verification.
        */

        try {

          sessionStorage.setItem(
            "suruPendingCustomer",
            JSON.stringify({
              name,
              phone,
              address,
              city,
              district
            })
          );

        } catch (error) {

          console.warn(
            "Could not save pending customer details",
            error
          );

        }

        showMessage(
          "Account created. Please complete phone verification, then sign in.",
          "success"
        );

        setTimeout(() => {

          location.href =
            "login.html";

        }, 1800);

        return;
      }

    }
  );

  /* =====================================================
     LOGOUT
  ===================================================== */

  $("logoutBtn")?.addEventListener(
    "click",
    async () => {

      await client.auth.signOut();

      location.href =
        "login.html";

    }
  );

  /* =====================================================
     ACCOUNT PAGE
  ===================================================== */

  if (
    location.pathname.endsWith(
      "account.html"
    )
  ) {

    if (!session) {

      location.href =
        "login.html";

      return;
    }

    /* -----------------------------
       PROFILE
    ----------------------------- */

    const {
      data: profile,
      error
    } = await getProfile();

    if (error) {

      showMessage(
        error.message,
        "error"
      );

      return;
    }

    if (!profile) {

      showMessage(
        "Customer profile not found.",
        "error"
      );

      return;
    }

    if ($("customerName")) {
      $("customerName").textContent =
        profile.name || "Customer";
    }

    if ($("profileName")) {
      $("profileName").textContent =
        profile.name || "—";
    }

    if ($("profilePhone")) {
      $("profilePhone").textContent =
        profile.phone ||
        session.user.phone ||
        "—";
    }

    if ($("profileAddress")) {
      $("profileAddress").textContent =
        profile.address || "—";
    }

    if ($("profileCity")) {

      $("profileCity").textContent =
        [
          profile.city,
          profile.district
        ]
          .filter(Boolean)
          .join(", ") || "—";
    }

    /* -----------------------------
       ORDERS
    ----------------------------- */

    const {
      data: orders,
      error: orderError
    } = await client
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
      .eq(
        "customer_id",
        profile.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

    if (orderError) {

      if ($("orders")) {

        $("orders").innerHTML =
          `<p class="message error">
            ${orderError.message}
          </p>`;

      }

      return;
    }

    if (!$("orders")) {
      return;
    }

    if (!orders?.length) {

      $("orders").innerHTML =
        "<p>No orders yet.</p>";

    } else {

      $("orders").innerHTML =
        orders
          .map(order => {

            const items =
              order.order_items || [];

            return `
              <article class="order-card">

                <div class="order-head">

                  <strong>
                    ${order.order_number || "Order"}
                  </strong>

                  <span>
                    ${order.order_status || "pending"}
                  </span>

                </div>

                <p>
                  ${new Date(
                    order.created_at
                  ).toLocaleString()}
                </p>

                <div class="order-items">

                  ${items.map(item => `

                    <div>

                      ${item.product_name || ""}

                      ${
                        item.color
                          ? ` · ${item.color}`
                          : ""
                      }

                      ${
                        item.size
                          ? ` · ${item.size}`
                          : ""
                      }

                      × ${item.quantity}

                    </div>

                  `).join("")}

                </div>

                <strong class="order-total">

                  NPR ${
                    Number(
                      order.total || 0
                    ).toLocaleString("en-IN")
                  }

                </strong>

                <small>

                  Payment:
                  ${order.payment_method || "—"}

                  ·

                  ${order.payment_status || "—"}

                </small>

              </article>
            `;

          })
          .join("");
    }

    /* -----------------------------
       CHANGE PASSWORD
    ----------------------------- */

    $("changePasswordForm")
      ?.addEventListener(
        "submit",
        async event => {

          event.preventDefault();

          const password =
            $("newPassword")?.value || "";

          const confirm =
            $("confirmNewPassword")?.value || "";

          if (password.length < 6) {

            showMessage(
              "Password must be at least 6 characters.",
              "error"
            );

            return;
          }

          if (password !== confirm) {

            showMessage(
              "Passwords do not match.",
              "error"
            );

            return;
          }

          const {
            error
          } = await client.auth.updateUser({
            password
          });

          if (error) {

            showMessage(
              error.message,
              "error"
            );

            return;
          }

          showMessage(
            "Password changed successfully.",
            "success"
          );

          event.target.reset();

        }
      );

  }

});
