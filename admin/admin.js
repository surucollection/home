(function () {

  "use strict";

  function boot() {

    console.log("Suru Admin: booting...");

    if (!window.supabase) {
      showError("Supabase library did not load.");
      return;
    }

    if (
      !window.SURU_SUPABASE_URL ||
      !window.SURU_SUPABASE_KEY
    ) {
      showError("Supabase configuration is missing.");
      return;
    }

    const supabase = window.supabase.createClient(
      window.SURU_SUPABASE_URL,
      window.SURU_SUPABASE_KEY
    );

    const loginView =
      document.getElementById("loginView");

    const appView =
      document.getElementById("appView");

    const loginForm =
      document.getElementById("loginForm");

    const loginEmail =
      document.getElementById("loginEmail");

    const loginPassword =
      document.getElementById("loginPassword");

    const loginButton =
      document.getElementById("loginButton");

    const loginMessage =
      document.getElementById("loginMessage");

    const logoutBtn =
      document.getElementById("logoutBtn");

    console.log("Suru Admin elements:", {
      loginView,
      appView,
      loginForm,
      loginEmail,
      loginPassword,
      loginButton,
      loginMessage,
      logoutBtn
    });


    if (!loginView || !appView || !loginForm) {

      showError(
        "Admin HTML is incomplete. Missing login elements."
      );

      return;
    }


    function setMessage(text, type) {

      if (!loginMessage) return;

      loginMessage.textContent = text;

      loginMessage.className =
        "message " + (type || "");

    }


    function showLogin() {

      loginView.classList.remove("hidden");

      appView.classList.add("hidden");

    }


    function showApp(session) {

      loginView.classList.add("hidden");

      appView.classList.remove("hidden");

      const userEmail =
        document.getElementById("userEmail");

      if (userEmail) {

        userEmail.textContent =
          session?.user?.email || "";

      }

    }


    function showError(text) {

      console.error("Suru Admin:", text);

      const box =
        document.getElementById("loginMessage");

      if (box) {

        box.textContent = text;

        box.className =
          "message error";

      } else {

        alert(text);

      }

    }


    async function adminCheck(session) {

      if (!session?.user) {

        return {
          ok: false,
          error: "No authenticated user."
        };

      }

      console.log(
        "Suru Admin: checking admin permission..."
      );


      /*
       * Use RPC instead of directly querying
       * admin_users. This avoids the RLS
       * chicken-and-egg problem.
       */

      const result =
        await Promise.race([

          supabase.rpc("is_admin"),

          new Promise((_, reject) => {

            setTimeout(() => {

              reject(
                new Error(
                  "Admin permission check timed out."
                )
              );

            }, 15000);

          })

        ]);


      if (result.error) {

        return {
          ok: false,
          error:
            "Admin check failed: " +
            result.error.message
        };

      }


      if (result.data === true) {

        return {
          ok: true
        };

      }


      return {
        ok: false,
        error:
          "This account is not authorized for the admin panel."
      };

    }


    async function openAdmin(session) {

      try {

        const admin =
          await adminCheck(session);

        if (!admin.ok) {

          showLogin();

          setMessage(
            admin.error,
            "error"
          );

          return false;
        }


        showApp(session);

        console.log(
          "Suru Admin: authorization successful."
        );


        loadDashboard();

        return true;

      } catch (error) {

        console.error(
          "Suru Admin authorization error:",
          error
        );

        showLogin();

        setMessage(
          error.message ||
          String(error),
          "error"
        );

        return false;
      }

    }


    /*
     * LOGIN
     */

    loginForm.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        console.log(
          "Suru Admin: login submitted."
        );


        const email =
          loginEmail.value.trim();

        const password =
          loginPassword.value;


        if (!email || !password) {

          setMessage(
            "Please enter your email and password.",
            "error"
          );

          return;
        }


        loginButton.disabled = true;

        loginButton.textContent =
          "Connecting…";

        setMessage(
          "Connecting to Supabase…",
          ""
        );


        try {

          console.log(
            "Suru Admin: calling signInWithPassword..."
          );


          const result =
            await Promise.race([

              supabase.auth.signInWithPassword({
                email: email,
                password: password
              }),

              new Promise((_, reject) => {

                setTimeout(() => {

                  reject(
                    new Error(
                      "Supabase login timed out after 15 seconds. Check your internet connection or Supabase access."
                    )
                  );

                }, 15000);

              })

            ]);


          console.log(
            "Suru Admin: signIn result:",
            result
          );


          if (result.error) {

            setMessage(
              result.error.message,
              "error"
            );

            return;
          }


          if (!result.data?.session) {

            setMessage(
              "Supabase accepted the login but did not return a session.",
              "error"
            );

            return;
          }


          setMessage(
            "Login successful. Checking admin access…",
            ""
          );


          const success =
            await openAdmin(
              result.data.session
            );


          if (success) {

            loginPassword.value = "";

          }


        } catch (error) {

          console.error(
            "Suru Admin login error:",
            error
          );


          setMessage(
            error.message ||
            String(error),
            "error"
          );

        } finally {

          loginButton.disabled = false;

          loginButton.textContent =
            "Sign In";

        }

      }
    );


    /*
     * LOGOUT
     */

    if (logoutBtn) {

      logoutBtn.addEventListener(
        "click",
        async function () {

          await supabase.auth.signOut();

          showLogin();

        }
      );

    }


    /*
     * SIDEBAR
     */

    document
      .querySelectorAll(".sidebar button")
      .forEach(function (button) {

        button.addEventListener(
          "click",
          function () {

            document
              .querySelectorAll(".sidebar button")
              .forEach(function (b) {

                b.classList.remove(
                  "active"
                );

              });


            button.classList.add(
              "active"
            );


            document
              .querySelectorAll(".view")
              .forEach(function (view) {

                view.classList.remove(
                  "active"
                );

              });


            const target =
              document.getElementById(
                button.dataset.view
              );


            if (target) {

              target.classList.add(
                "active"
              );

            }


            const name =
              button.dataset.view;


            if (name === "dashboard")
              loadDashboard();

            if (name === "orders")
              loadOrders();

            if (name === "products")
              loadProducts();

            if (name === "inventory")
              loadInventory();

            if (name === "subscribers")
              loadSubscribers();

          }

        );

      });


    /*
     * INITIAL SESSION
     */

    supabase.auth
      .getSession()
      .then(async function (result) {

        console.log(
          "Suru Admin: initial session:",
          result
        );


        if (result.error) {

          showLogin();

          setMessage(
            result.error.message,
            "error"
          );

          return;
        }


        if (!result.data.session) {

          showLogin();

          return;
        }


        await openAdmin(
          result.data.session
        );

      })
      .catch(function (error) {

        showLogin();

        setMessage(
          error.message ||
          String(error),
          "error"
        );

      });


    /*
     * IMPORTANT:
     * We deliberately do NOT call openAdmin()
     * on every TOKEN_REFRESHED event.
     */

    supabase.auth.onAuthStateChange(
      function (event, session) {

        console.log(
          "Suru Admin auth event:",
          event
        );


        if (event === "SIGNED_OUT") {

          showLogin();

        }

      }
    );


    /*
     * DASHBOARD
     */

    async function loadDashboard() {

      try {

        const results =
          await Promise.all([

            supabase
              .from("orders")
              .select("*", {
                count: "exact",
                head: true
              }),

            supabase
              .from("products")
              .select("*", {
                count: "exact",
                head: true
              })
              .eq("is_active", true),

            supabase
              .from("newsletter_subscribers")
              .select("*", {
                count: "exact",
                head: true
              })
              .eq("is_active", true),

            supabase
              .from("orders")
              .select(
                "id,order_number,customer_name,total,order_status,created_at"
              )
              .order(
                "created_at",
                {
                  ascending: false
                }
              )
              .limit(5)

          ]);


        const statOrders =
          document.getElementById(
            "statOrders"
          );

        const statProducts =
          document.getElementById(
            "statProducts"
          );

        const statSubscribers =
          document.getElementById(
            "statSubscribers"
          );

        const statPending =
          document.getElementById(
            "statPending"
          );


        if (statOrders)
          statOrders.textContent =
            results[0].count ?? 0;

        if (statProducts)
          statProducts.textContent =
            results[1].count ?? 0;

        if (statSubscribers)
          statSubscribers.textContent =
            results[2].count ?? 0;


        const recent =
          results[3].data || [];


        if (statPending) {

          statPending.textContent =
            recent.filter(
              x =>
                x.order_status ===
                "pending"
            ).length;

        }


        const recentOrders =
          document.getElementById(
            "recentOrders"
          );


        if (recentOrders) {

          if (!recent.length) {

            recentOrders.innerHTML =
              "<p>No orders yet.</p>";

          } else {

            recentOrders.innerHTML =
              recent
                .map(function (o) {

                  return `
                    <div style="
                      padding:12px 0;
                      border-bottom:1px solid #eee
                    ">

                      <strong>
                        ${escapeHtml(
                          o.order_number
                        )}
                      </strong>

                      <br>

                      ${escapeHtml(
                        o.customer_name
                      )}

                      ·

                      NPR ${Number(
                        o.total || 0
                      ).toLocaleString("en-IN")}

                      <br>

                      <small>
                        ${escapeHtml(
                          o.order_status
                        )}
                      </small>

                    </div>
                  `;

                })
                .join("");

          }

        }


      } catch (error) {

        console.error(
          "Dashboard:",
          error
        );

      }

    }


    /*
     * ORDERS
     */

    async function loadOrders() {

      const table =
        document.getElementById(
          "ordersTable"
        );

      if (!table) return;


      const search =
        document
          .getElementById(
            "orderSearch"
          )
          ?.value
          ?.trim() || "";


      const status =
        document
          .getElementById(
            "orderStatusFilter"
          )
          ?.value || "";


      let query =
        supabase
          .from("orders")
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          )
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

        table.innerHTML =
          `<p class="message error">
            ${escapeHtml(error.message)}
          </p>`;

        return;
      }


      if (!data?.length) {

        table.innerHTML =
          "<p>No orders found.</p>";

        return;
      }


      table.innerHTML = `

        <table class="table">

          <thead>

            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
            </tr>

          </thead>

          <tbody>

            ${data.map(function (o) {

              return `

                <tr>

                  <td>
                    <strong>
                      ${escapeHtml(
                        o.order_number
                      )}
                    </strong>
                  </td>

                  <td>
                    ${escapeHtml(
                      o.customer_name
                    )}

                    <br>

                    <small>
                      ${escapeHtml(
                        o.customer_phone ||
                        ""
                      )}
                    </small>
                  </td>

                  <td>
                    NPR ${Number(
                      o.total || 0
                    ).toLocaleString("en-IN")}
                  </td>

                  <td>
                    ${escapeHtml(
                      o.order_status
                    )}
                  </td>

                  <td>
                    ${new Date(
                      o.created_at
                    ).toLocaleString()}
                  </td>

                </tr>

              `;

            }).join("")}

          </tbody>

        </table>

      `;

    }


    /*
     * PRODUCTS
     */

    async function loadProducts() {

      const grid =
        document.getElementById(
          "productsGrid"
        );

      if (!grid) return;


      const {
        data,
        error
      } = await supabase
        .from("products")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        );


      if (error) {

        grid.innerHTML =
          `<p class="message error">
            ${escapeHtml(error.message)}
          </p>`;

        return;
      }


      grid.innerHTML = `

        <div class="product-grid">

          ${(data || [])
            .map(function (p) {

              return `

                <div class="product-card-admin">

                  <small>
                    ${escapeHtml(
                      p.product_code
                    )}
                    ·
                    ${escapeHtml(
                      p.category
                    )}
                  </small>

                  <h3>
                    ${escapeHtml(
                      p.name
                    )}
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
                      ${
                        p.is_active
                          ? "checked"
                          : ""
                      }
                      data-active="${p.id}"
                    >

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

                </div>

              `;

            })
            .join("")}

        </div>

      `;

    }


    /*
     * INVENTORY
     */

    async function loadInventory() {

      const grid =
        document.getElementById(
          "inventoryGrid"
        );

      if (!grid) return;


      const {
        data,
        error
      } = await supabase
        .from("products")
        .select(
          "id,product_code,name,product_sizes(id,size,stock,is_active)"
        )
        .order(
          "product_code"
        );


      if (error) {

        grid.innerHTML =
          `<div class="card">
            <p class="message error">
              ${escapeHtml(
                error.message
              )}
            </p>
          </div>`;

        return;
      }


      grid.innerHTML =
        (data || [])
          .map(function (p) {

            return `

              <div class="card">

                <h3>
                  ${escapeHtml(
                    p.product_code
                  )}
                  —
                  ${escapeHtml(
                    p.name
                  )}
                </h3>

                ${
                  (p.product_sizes || [])
                    .map(function (s) {

                      return `

                        <div
                          style="
                            display:flex;
                            gap:10px;
                            align-items:center;
                            margin:10px 0
                          "
                        >

                          <strong>
                            ${escapeHtml(
                              s.size
                            )}
                          </strong>

                          <input
                            type="number"
                            min="0"
                            value="${s.stock}"
                            data-stock="${s.id}"
                          >

                          <button
                            class="primary save-stock"
                            data-id="${s.id}"
                          >
                            Save
                          </button>

                        </div>

                      `;

                    })
                    .join("")
                }

              </div>

            `;

          })
          .join("");

    }


    /*
     * SUBSCRIBERS
     */

    async function loadSubscribers() {

      const table =
        document.getElementById(
          "subscribersTable"
        );

      if (!table) return;


      const {
        data,
        error
      } = await supabase
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

        table.innerHTML =
          `<p class="message error">
            ${escapeHtml(
              error.message
            )}
          </p>`;

        return;
      }


      const subscribers =
        data || [];


      const count =
        document.getElementById(
          "subscriberCount"
        );


      if (count) {

        count.textContent =
          `${subscribers.length} subscriber${
            subscribers.length === 1
              ? ""
              : "s"
          }`;

      }


      if (!subscribers.length) {

        table.innerHTML =
          "<p>No subscribers yet.</p>";

        return;
      }


      table.innerHTML = `

        <table class="table">

          <thead>

            <tr>
              <th>Email</th>
              <th>Subscribed</th>
              <th>Status</th>
            </tr>

          </thead>

          <tbody>

            ${subscribers
              .map(function (s) {

                return `

                  <tr>

                    <td>
                      ${escapeHtml(
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

                  </tr>

                `;

              })
              .join("")}

          </tbody>

        </table>

      `;

    }


    /*
     * SEARCH EVENTS
     */

    const orderSearch =
      document.getElementById(
        "orderSearch"
      );

    if (orderSearch) {

      orderSearch.addEventListener(
        "input",
        loadOrders
      );

    }


    const orderStatus =
      document.getElementById(
        "orderStatusFilter"
      );

    if (orderStatus) {

      orderStatus.addEventListener(
        "change",
        loadOrders
      );

    }


    /*
     * PRODUCT SAVE
     */

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


        const price =
          document.querySelector(
            `[data-price="${id}"]`
          );

        const moq =
          document.querySelector(
            `[data-moq="${id}"]`
          );

        const active =
          document.querySelector(
            `[data-active="${id}"]`
          );

        const featured =
          document.querySelector(
            `[data-featured="${id}"]`
          );


        button.disabled = true;


        const {
          error
        } = await supabase
          .from("products")
          .update({

            price:
              Number(
                price.value
              ),

            moq:
              Number(
                moq.value
              ),

            is_active:
              active.checked,

            is_featured:
              featured.checked

          })
          .eq(
            "id",
            id
          );


        button.disabled = false;


        if (error) {

          alert(
            "Save failed: " +
            error.message
          );

        } else {

          button.textContent =
            "Saved";

          setTimeout(
            function () {

              button.textContent =
                "Save Changes";

            },
            1200
          );

        }

      }
    );


    /*
     * INVENTORY SAVE
     */

    document.addEventListener(
      "click",
      async function (event) {

        const button =
          event.target.closest(
            ".save-stock"
          );

        if (!button) return;


        const id =
          button.dataset.id;


        const input =
          document.querySelector(
            `[data-stock="${id}"]`
          );


        if (!input) return;


        button.disabled = true;


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
        } = await supabase
          .from("product_sizes")
          .update({
            stock: stock
          })
          .eq(
            "id",
            id
          );


        button.disabled = false;


        if (error) {

          alert(
            error.message
          );

          return;
        }


        button.textContent =
          "Saved";


        setTimeout(
          function () {

            button.textContent =
              "Save";

          },
          1000
        );

      }
    );

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      boot
    );

  } else {

    boot();

  }


})();
