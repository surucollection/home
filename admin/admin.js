(function () {

  "use strict";


  /* =====================================================
     CONFIGURATION
  ===================================================== */

  if (
    !window.supabase ||
    !window.SURU_SUPABASE_URL ||
    !window.SURU_SUPABASE_KEY
  ) {

    console.error(
      "Admin: Supabase configuration unavailable."
    );

    return;

  }


  const client =
    window.supabase.createClient(
      window.SURU_SUPABASE_URL,
      window.SURU_SUPABASE_KEY
    );


  /* =====================================================
     HELPERS
  ===================================================== */

  function escapeHtml(value) {

    return String(value ?? "")
      .replace(
        /[&<>'"]/g,
        function (char) {

          return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
          }[char];

        }
      );

  }


  function money(value) {

    return (
      "NPR " +
      Number(value || 0)
        .toLocaleString("en-IN")
    );

  }


  function showToast(message) {

    const toast =
      document.getElementById(
        "toast"
      );


    if (!toast) return;


    toast.textContent =
      message;


    toast.classList.add(
      "show"
    );


    clearTimeout(
      window.__toastTimer
    );


    window.__toastTimer =
      setTimeout(
        function () {

          toast.classList.remove(
            "show"
          );

        },
        2500
      );

  }


  /* =====================================================
     ELEMENTS
  ===================================================== */

  const loginScreen =
    document.getElementById(
      "loginScreen"
    );


  const adminApp =
    document.getElementById(
      "adminApp"
    );


  const loginForm =
    document.getElementById(
      "loginForm"
    );


  const loginMessage =
    document.getElementById(
      "loginMessage"
    );


  const loginButton =
    document.getElementById(
      "loginButton"
    );


  /* =====================================================
     CHECK ADMIN
  ===================================================== */

  async function checkAdmin() {

    const {
      data: {
        user
      }
    } =
      await client.auth.getUser();


    if (!user) {

      showLogin();

      return false;

    }


    const result =
      await client
        .from("admin_users")
        .select(
          "id,role,is_active"
        )
        .eq(
          "id",
          user.id
        )
        .maybeSingle();


    if (
      result.error ||
      !result.data ||
      !result.data.is_active ||
      ![
        "admin",
        "manager"
      ].includes(
        result.data.role
      )
    ) {

      await client.auth.signOut();

      showLogin();

      return false;

    }


    showAdmin();

    return true;

  }


  /* =====================================================
     SHOW LOGIN
  ===================================================== */

  function showLogin() {

    loginScreen.hidden =
      false;

    adminApp.hidden =
      true;

  }


  /* =====================================================
     SHOW ADMIN
  ===================================================== */

  async function showAdmin() {

    loginScreen.hidden =
      true;

    adminApp.hidden =
      false;


    await loadDashboard();

  }


  /* =====================================================
     LOGIN
  ===================================================== */

  if (loginForm) {

    loginForm.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();


        loginMessage.textContent =
          "";


        loginButton.disabled =
          true;


        loginButton.textContent =
          "Signing in…";


        const email =
          document
            .getElementById(
              "loginEmail"
            )
            .value
            .trim();


        const password =
          document
            .getElementById(
              "loginPassword"
            )
            .value;


        try {


          const result =
            await client.auth
              .signInWithPassword({
                email,
                password
              });


          if (result.error) {

            throw result.error;

          }


          const user =
            result.data.user;


          const adminResult =
            await client
              .from("admin_users")
              .select(
                "id,role,is_active"
              )
              .eq(
                "id",
                user.id
              )
              .maybeSingle();


          if (
            adminResult.error ||
            !adminResult.data ||
            !adminResult.data.is_active ||
            ![
              "admin",
              "manager"
            ].includes(
              adminResult.data.role
            )
          ) {

            await client.auth.signOut();

            throw new Error(
              "This account is not authorized to access the admin panel."
            );

          }


          loginForm.reset();

          await showAdmin();


        } catch (error) {


          console.error(
            "Admin login failed:",
            error
          );


          loginMessage.textContent =
            error.message ||
            "Unable to sign in.";

        } finally {


          loginButton.disabled =
            false;


          loginButton.textContent =
            "Sign In";

        }

      }
    );

  }


  /* =====================================================
     LOGOUT
  ===================================================== */

  const logoutButton =
    document.getElementById(
      "logoutButton"
    );


  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      async function () {

        await client.auth.signOut();

        showLogin();

      }
    );

  }


  /* =====================================================
     NAVIGATION
  ===================================================== */

  document
    .querySelectorAll(
      ".side-link"
    )
    .forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            const section =
              button.dataset.section;


            document
              .querySelectorAll(
                ".side-link"
              )
              .forEach(
                function (item) {

                  item.classList.remove(
                    "active"
                  );

                }
              );


            button.classList.add(
              "active"
            );


            document
              .querySelectorAll(
                ".admin-section"
              )
              .forEach(
                function (item) {

                  item.hidden =
                    true;

                  item.classList.remove(
                    "active"
                  );

                }
              );


            const target =
              document.getElementById(
                "section-" +
                section
              );


            if (target) {

              target.hidden =
                false;

              target.classList.add(
                "active"
              );

            }


            if (
              section ===
              "dashboard"
            ) {

              loadDashboard();

            } else if (
              section ===
              "orders"
            ) {

              loadOrders();

            } else if (
              section ===
              "products"
            ) {

              loadProducts();

            } else if (
              section ===
              "inventory"
            ) {

              loadInventory();

            } else if (
              section ===
              "subscribers"
            ) {

              loadSubscribers();

            }

          }
        );

      }
    );


  /* =====================================================
     DASHBOARD
  ===================================================== */

  async function loadDashboard() {

    try {


      const [
        orders,
        pending,
        products,
        subscribers
      ] =
        await Promise.all([


          client
            .from("orders")
            .select(
              "id",
              {
                count: "exact",
                head: true
              }
            ),


          client
            .from("orders")
            .select(
              "id",
              {
                count: "exact",
                head: true
              }
            )
            .eq(
              "status",
              "pending"
            ),


          client
            .from("products")
            .select(
              "id",
              {
                count: "exact",
                head: true
              }
            )
            .eq(
              "is_active",
              true
            ),


          client
            .from(
              "newsletter_subscribers"
            )
            .select(
              "id",
              {
                count: "exact",
                head: true
              }
            )
            .eq(
              "is_active",
              true
            )

        ]);


      document.getElementById(
        "statOrders"
      ).textContent =
        orders.count ?? "0";


      document.getElementById(
        "statPending"
      ).textContent =
        pending.count ?? "0";


      document.getElementById(
        "statProducts"
      ).textContent =
        products.count ?? "0";


      document.getElementById(
        "statSubscribers"
      ).textContent =
        subscribers.count ?? "0";


      await loadRecentOrders();


    } catch (error) {

      console.error(
        "Dashboard error:",
        error
      );

    }

  }


  /* =====================================================
     RECENT ORDERS
  ===================================================== */

  async function loadRecentOrders() {

    const container =
      document.getElementById(
        "recentOrders"
      );


    const result =
      await client
        .from("orders")
        .select(`
          id,
          order_number,
          customer_name,
          total,
          status,
          created_at
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(8);


    if (result.error) {

      container.textContent =
        "Unable to load orders.";

      return;

    }


    const orders =
      result.data || [];


    if (!orders.length) {

      container.textContent =
        "No orders yet.";

      return;

    }


    container.innerHTML =
      orders.map(
        function (order) {

          return `

            <div class="order-row">

              <div>

                <strong>
                  ${escapeHtml(
                    order.order_number ||
                    order.id
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    order.customer_name ||
                    "Customer"
                  )}
                </small>

              </div>


              <div>

                <strong>
                  ${money(
                    order.total
                  )}
                </strong>

                <small>

                  <span class="badge ${
                    escapeHtml(
                      order.status ||
                      "pending"
                    )
                  }">

                    ${escapeHtml(
                      order.status ||
                      "pending"
                    )}

                  </span>

                </small>

              </div>

            </div>

          `;

        }
      ).join("");

  }


  /* =====================================================
     ORDERS
  ===================================================== */

  async function loadOrders() {

    const container =
      document.getElementById(
        "ordersTable"
      );


    container.textContent =
      "Loading…";


    const result =
      await client
        .from("orders")
        .select(`
          id,
          order_number,
          customer_name,
          customer_phone,
          city,
          total,
          status,
          payment_method,
          created_at
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (result.error) {

      container.textContent =
        result.error.message;

      return;

    }


    renderOrders(
      result.data || []
    );

  }


  function renderOrders(
    orders
  ) {

    const container =
      document.getElementById(
        "ordersTable"
      );


    const search =
      (
        document.getElementById(
          "orderSearch"
        )?.value ||
        ""
      )
      .trim()
      .toLowerCase();


    const status =
      document.getElementById(
        "orderStatusFilter"
      )?.value ||
      "";


    const filtered =
      orders.filter(
        function (order) {

          const text =
            [
              order.order_number,
              order.customer_name,
              order.customer_phone
            ]
            .join(" ")
            .toLowerCase();


          return (
            (!search ||
              text.includes(search)) &&
            (!status ||
              order.status === status)
          );

        }
      );


    if (!filtered.length) {

      container.innerHTML =
        "<p style='padding:20px'>No orders found.</p>";

      return;

    }


    container.innerHTML = `

      <table>

        <thead>

          <tr>

            <th>
              Order
            </th>

            <th>
              Customer
            </th>

            <th>
              Phone
            </th>

            <th>
              Total
            </th>

            <th>
              Payment
            </th>

            <th>
              Status
            </th>

            <th>
              Date
            </th>

          </tr>

        </thead>


        <tbody>

          ${filtered.map(
            function (order) {

              return `

                <tr>

                  <td>
                    <strong>
                      ${escapeHtml(
                        order.order_number ||
                        order.id
                      )}
                    </strong>
                  </td>

                  <td>
                    ${escapeHtml(
                      order.customer_name ||
                      ""
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      order.customer_phone ||
                      ""
                    )}
                  </td>

                  <td>
                    ${money(
                      order.total
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      order.payment_method ||
                      ""
                    )}
                  </td>

                  <td>

                    <select
                      class="order-status"
                      data-id="${escapeHtml(
                        order.id
                      )}"
                    >

                      ${[
                        "pending",
                        "confirmed",
                        "processing",
                        "shipped",
                        "delivered",
                        "cancelled"
                      ].map(
                        function (value) {

                          return `

                            <option
                              value="${value}"
                              ${
                                order.status ===
                                value
                                  ? "selected"
                                  : ""
                              }
                            >
                              ${value}
                            </option>

                          `;

                        }
                      ).join("")}

                    </select>

                  </td>

                  <td>
                    ${new Date(
                      order.created_at
                    ).toLocaleString()}
                  </td>

                </tr>

              `;

            }
          ).join("")}

        </tbody>

      </table>

    `;

  }


  document.addEventListener(
    "change",
    async function (event) {

      if (
        event.target.matches(
          ".order-status"
        )
      ) {

        const id =
          event.target.dataset.id;


        const status =
          event.target.value;


        const result =
          await client
            .from("orders")
            .update({
              status:
                status
            })
            .eq(
              "id",
              id
            );


        if (result.error) {

          alert(
            result.error.message
          );

        } else {

          showToast(
            "Order status updated."
          );

          loadOrders();

        }

      }

    }
  );


  const searchInput =
    document.getElementById(
      "orderSearch"
    );


  const statusFilter =
    document.getElementById(
      "orderStatusFilter"
    );


  let cachedOrders = [];


  if (searchInput) {

    searchInput.addEventListener(
      "input",
      function () {

        renderOrders(
          cachedOrders
        );

      }
    );

  }


  if (statusFilter) {

    statusFilter.addEventListener(
      "change",
      function () {

        renderOrders(
          cachedOrders
        );

      }
    );

  }


  /* =====================================================
     PRODUCTS
  ===================================================== */

  async function loadProducts() {

    const container =
      document.getElementById(
        "productsTable"
      );


    container.textContent =
      "Loading…";


    const result =
      await client
        .from("products")
        .select(`
          id,
          product_code,
          name,
          category,
          price,
          moq,
          is_active,
          is_featured
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (result.error) {

      container.textContent =
        result.error.message;

      return;

    }


    const products =
      result.data || [];


    if (!products.length) {

      container.innerHTML =
        "<p style='padding:20px'>No products found.</p>";

      return;

    }


    container.innerHTML = `

      <table>

        <thead>

          <tr>

            <th>
              Code
            </th>

            <th>
              Product
            </th>

            <th>
              Category
            </th>

            <th>
              Price
            </th>

            <th>
              MOQ
            </th>

            <th>
              Active
            </th>

            <th>
              Featured
            </th>

            <th>
              Save
            </th>

          </tr>

        </thead>


        <tbody>

          ${products.map(
            function (product) {

              return `

                <tr>

                  <td>
                    ${escapeHtml(
                      product.product_code
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      product.name
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      product.category ||
                      ""
                    )}
                  </td>

                  <td>

                    <input
                      class="product-price"
                      data-id="${product.id}"
                      type="number"
                      min="0"
                      step="0.01"
                      value="${product.price || 0}"
                    >

                  </td>

                  <td>

                    <input
                      class="product-moq"
                      data-id="${product.id}"
                      type="number"
                      min="1"
                      value="${product.moq || 1}"
                    >

                  </td>

                  <td>

                    <input
                      class="product-active"
                      data-id="${product.id}"
                      type="checkbox"
                      ${
                        product.is_active
                          ? "checked"
                          : ""
                      }
                    >

                  </td>

                  <td>

                    <input
                      class="product-featured"
                      data-id="${product.id}"
                      type="checkbox"
                      ${
                        product.is_featured
                          ? "checked"
                          : ""
                      }
                    >

                  </td>

                  <td>

                    <button
                      class="save-product save-button"
                      data-id="${product.id}"
                      type="button"
                    >
                      Save
                    </button>

                  </td>

                </tr>

              `;

            }
          ).join("")}

        </tbody>

      </table>

    `;

  }


  document.addEventListener(
    "click",
    async function (event) {

      const button =
        event.target.closest(
          ".save-product"
        );


      if (!button) {
        return;
      }


      const id =
        button.dataset.id;


      const price =
        Number(
          document.querySelector(
            `.product-price[data-id="${id}"]`
          ).value
        );


      const moq =
        Number(
          document.querySelector(
            `.product-moq[data-id="${id}"]`
          ).value
        );


      const isActive =
        document.querySelector(
          `.product-active[data-id="${id}"]`
        ).checked;


      const isFeatured =
        document.querySelector(
          `.product-featured[data-id="${id}"]`
        ).checked;


      const result =
        await client
          .from("products")
          .update({
            price,
            moq,
            is_active:
              isActive,
            is_featured:
              isFeatured
          })
          .eq(
            "id",
            id
          );


      if (result.error) {

        alert(
          result.error.message
        );

        return;

      }


      showToast(
        "Product updated."
      );

    }
  );


  /* =====================================================
     INVENTORY
  ===================================================== */

  async function loadInventory() {

    const container =
      document.getElementById(
        "inventoryTable"
      );


    container.textContent =
      "Loading…";


    const result =
      await client
        .from("product_sizes")
        .select(`
          id,
          product_id,
          size,
          stock,
          is_active,
          products (
            product_code,
            name
          )
        `)
        .order(
          "created_at",
          {
            ascending: true
          }
        );


    if (result.error) {

      container.textContent =
        result.error.message;

      return;

    }


    const rows =
      result.data || [];


    if (!rows.length) {

      container.innerHTML =
        "<p style='padding:20px'>No size inventory found.</p>";

      return;

    }


    container.innerHTML = `

      <table>

        <thead>

          <tr>

            <th>
              Product
            </th>

            <th>
              Size
            </th>

            <th>
              Stock
            </th>

            <th>
              Active
            </th>

            <th>
              Save
            </th>

          </tr>

        </thead>


        <tbody>

          ${rows.map(
            function (row) {

              return `

                <tr>

                  <td>

                    ${
                      row.products
                        ? escapeHtml(
                            row.products.product_code +
                            " — " +
                            row.products.name
                          )
                        : "Product"
                    }

                  </td>

                  <td>
                    ${escapeHtml(
                      row.size
                    )}
                  </td>

                  <td>

                    <input
                      class="inventory-stock"
                      data-id="${row.id}"
                      type="number"
                      min="0"
                      value="${Number(
                        row.stock || 0
                      )}"
                    >

                  </td>

                  <td>

                    <input
                      class="inventory-active"
                      data-id="${row.id}"
                      type="checkbox"
                      ${
                        row.is_active
                          ? "checked"
                          : ""
                      }
                    >

                  </td>

                  <td>

                    <button
                      class="save-inventory save-button"
                      data-id="${row.id}"
                      type="button"
                    >
                      Save
                    </button>

                  </td>

                </tr>

              `;

            }
          ).join("")}

        </tbody>

      </table>

    `;

  }


  document.addEventListener(
    "click",
    async function (event) {

      const button =
        event.target.closest(
          ".save-inventory"
        );


      if (!button) {
        return;
      }


      const id =
        button.dataset.id;


      const stock =
        Number(
          document.querySelector(
            `.inventory-stock[data-id="${id}"]`
          ).value
        );


      const active =
        document.querySelector(
          `.inventory-active[data-id="${id}"]`
        ).checked;


      const result =
        await client
          .from("product_sizes")
          .update({
            stock,
            is_active:
              active
          })
          .eq(
            "id",
            id
          );


      if (result.error) {

        alert(
          result.error.message
        );

        return;

      }


      showToast(
        "Inventory updated."
      );

    }
  );


  /* =====================================================
     SUBSCRIBERS
  ===================================================== */

  async function loadSubscribers() {

    const container =
      document.getElementById(
        "subscribersTable"
      );


    container.textContent =
      "Loading…";


    const result =
      await client
        .from(
          "newsletter_subscribers"
        )
        .select(`
          id,
          email,
          is_active,
          created_at
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (result.error) {

      container.textContent =
        result.error.message;

      return;

    }


    const subscribers =
      result.data || [];


    if (!subscribers.length) {

      container.innerHTML =
        "<p style='padding:20px'>No subscribers yet.</p>";

      return;

    }


    container.innerHTML = `

      <table>

        <thead>

          <tr>

            <th>
              Email
            </th>

            <th>
              Status
            </th>

            <th>
              Subscribed
            </th>

            <th>
              Action
            </th>

          </tr>

        </thead>


        <tbody>

          ${subscribers.map(
            function (subscriber) {

              return `

                <tr>

                  <td>
                    ${escapeHtml(
                      subscriber.email
                    )}
                  </td>

                  <td>

                    <span class="badge">

                      ${
                        subscriber.is_active
                          ? "Active"
                          : "Inactive"
                      }

                    </span>

                  </td>

                  <td>
                    ${new Date(
                      subscriber.created_at
                    ).toLocaleString()}
                  </td>

                  <td>

                    <button
                      class="subscriber-toggle save-button"
                      data-id="${subscriber.id}"
                      data-active="${
                        subscriber.is_active
                      }"
                      type="button"
                    >

                      ${
                        subscriber.is_active
                          ? "Deactivate"
                          : "Activate"
                      }

                    </button>

                  </td>

                </tr>

              `;

            }
          ).join("")}

        </tbody>

      </table>

    `;

  }


  document.addEventListener(
    "click",
    async function (event) {

      const button =
        event.target.closest(
          ".subscriber-toggle"
        );


      if (!button) {
        return;
      }


      const id =
        button.dataset.id;


      const currentlyActive =
        button.dataset.active ===
        "true";


      const result =
        await client
          .from(
            "newsletter_subscribers"
          )
          .update({
            is_active:
              !currentlyActive
          })
          .eq(
            "id",
            id
          );


      if (result.error) {

        alert(
          result.error.message
        );

        return;

      }


      showToast(
        "Subscriber status updated."
      );


      loadSubscribers();

    }
  );


  /* =====================================================
     REFRESH BUTTONS
  ===================================================== */

  document
    .querySelectorAll(
      "[data-refresh]"
    )
    .forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            const type =
              button.dataset.refresh;


            if (
              type ===
              "dashboard"
            ) {

              loadDashboard();

            } else if (
              type ===
              "orders"
            ) {

              loadOrders();

            } else if (
              type ===
              "products"
            ) {

              loadProducts();

            } else if (
              type ===
              "inventory"
            ) {

              loadInventory();

            } else if (
              type ===
              "subscribers"
            ) {

              loadSubscribers();

            }

          }
        );

      }
    );


  /* =====================================================
     AUTH STATE
  ===================================================== */

  client.auth.onAuthStateChange(
    function (event) {

      if (
        event ===
        "SIGNED_OUT"
      ) {

        showLogin();

      }

    }
  );


  /* =====================================================
     START
  ===================================================== */

  checkAdmin();

})();
