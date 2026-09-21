const client = window.supabase.createClient(
  window.SURU_SUPABASE_URL,
  window.SURU_SUPABASE_KEY
);

const $ = (s) => document.querySelector(s);

function show(text, type = "") {
  const el = $("#loginMessage");

  if (!el) {
    alert(text);
    return;
  }

  el.textContent = text;
  el.className = "message " + type;
}

function showLogin() {
  $("#loginView").classList.remove("hidden");
  $("#appView").classList.add("hidden");
}

function showApp(session) {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");

  if ($("#userEmail")) {
    $("#userEmail").textContent =
      session?.user?.email || "";
  }
}


/* =========================
   LOGIN
========================= */

$("#loginForm").addEventListener("submit", async (e) => {

  e.preventDefault();

  const email =
    $("#loginEmail").value.trim();

  const password =
    $("#loginPassword").value;

  show("Connecting to Supabase…");

  const button =
    $("#loginForm button[type='submit']");

  if (button) {
    button.disabled = true;
    button.textContent = "Signing in…";
  }

  try {

    console.log("STEP 1 - Login started");
    console.log("Email:", email);

    /*
      Give Supabase a maximum of 15 seconds.
      If it hangs, we will actually see an error.
    */

    const loginPromise =
      client.auth.signInWithPassword({
        email,
        password
      });

    const timeoutPromise =
      new Promise((_, reject) => {

        setTimeout(() => {
          reject(
            new Error(
              "Supabase login timed out after 15 seconds. Check your internet connection or Supabase Auth."
            )
          );
        }, 15000);

      });

    const {
      data,
      error
    } = await Promise.race([
      loginPromise,
      timeoutPromise
    ]);

    console.log("STEP 2 - Supabase response");
    console.log(data);
    console.log(error);

    if (error) {
      throw error;
    }

    if (!data?.session) {
      throw new Error(
        "Supabase accepted the login but did not return a session."
      );
    }

    show("Login successful. Checking admin access…");

    console.log(
      "STEP 3 - User ID:",
      data.user.id
    );

    /*
      Check admin_users directly.
    */

    const adminPromise =
      client
        .from("admin_users")
        .select(
          "id, role, is_active"
        )
        .eq(
          "id",
          data.user.id
        )
        .maybeSingle();

    const adminTimeout =
      new Promise((_, reject) => {

        setTimeout(() => {
          reject(
            new Error(
              "Admin verification timed out after 15 seconds."
            )
          );
        }, 15000);

      });

    const {
      data: admin,
      error: adminError
    } = await Promise.race([
      adminPromise,
      adminTimeout
    ]);

    console.log(
      "STEP 4 - Admin response:",
      admin,
      adminError
    );

    if (adminError) {
      throw adminError;
    }

    if (!admin) {
      throw new Error(
        "User is signed in, but no admin_users record was found."
      );
    }

    if (!admin.is_active) {
      throw new Error(
        "Admin account is inactive."
      );
    }

    if (
      admin.role !== "admin" &&
      admin.role !== "manager"
    ) {
      throw new Error(
        "Admin role is not authorized."
      );
    }

    console.log(
      "STEP 5 - ADMIN VERIFIED"
    );

    show(
      "Signed in successfully!"
    );

    showApp(data.session);

    /*
      Load dashboard only AFTER login is confirmed.
      If dashboard has an error, it cannot send us
      back to the login screen.
    */

    if (typeof loadDashboard === "function") {
      await loadDashboard();
    }

  } catch (error) {

    console.error(
      "LOGIN FAILED:",
      error
    );

    show(
      error?.message ||
      String(error),
      "error"
    );

    showLogin();

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = "Sign In";
    }
  }

});


/* =========================
   LOGOUT
========================= */

const logout =
  $("#logoutBtn");

if (logout) {

  logout.addEventListener(
    "click",
    async () => {

      await client.auth.signOut();

      showLogin();

      show("");
    }
  );
}


/* =========================
   INITIAL SESSION
========================= */

(async () => {

  console.log(
    "ADMIN PAGE LOADED"
  );

  try {

    const {
      data,
      error
    } = await client.auth.getSession();

    console.log(
      "Existing session:",
      data,
      error
    );

    if (
      data?.session?.user
    ) {

      const {
        data: admin,
        error: adminError
      } = await client
        .from("admin_users")
        .select(
          "id, role, is_active"
        )
        .eq(
          "id",
          data.session.user.id
        )
        .maybeSingle();

      console.log(
        "Existing admin:",
        admin,
        adminError
      );

      if (
        !adminError &&
        admin &&
        admin.is_active &&
        (
          admin.role === "admin" ||
          admin.role === "manager"
        )
      ) {

        showApp(
          data.session
        );

        if (
          typeof loadDashboard ===
          "function"
        ) {
          await loadDashboard();
        }

        return;
      }
    }

    showLogin();

  } catch (error) {

    console.error(
      "START ERROR:",
      error
    );

    showLogin();

    show(
      error.message,
      "error"
    );
  }

})();
