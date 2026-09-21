(function () {

  "use strict";


  function initializeNewsletter() {

    const form =
      document.getElementById(
        "newsletterForm"
      );


    if (!form) {
      return;
    }


    if (
      !window.supabase ||
      !window.SURU_SUPABASE_URL ||
      !window.SURU_SUPABASE_KEY
    ) {

      console.error(
        "Newsletter: Supabase configuration unavailable."
      );

      return;

    }


    const client =
      window.supabase.createClient(
        window.SURU_SUPABASE_URL,
        window.SURU_SUPABASE_KEY
      );


    const emailInput =
      document.getElementById(
        "newsletterEmail"
      );


    const button =
      document.getElementById(
        "newsletterButton"
      );


    const status =
      document.getElementById(
        "newsletterStatus"
      );


    form.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();


        const email =
          emailInput.value
            .trim()
            .toLowerCase();


        if (
          !emailInput.checkValidity()
        ) {

          status.textContent =
            "Please enter a valid email address.";

          status.className =
            "newsletter-status error";

          emailInput.focus();

          return;

        }


        button.disabled = true;

        button.textContent =
          "Subscribing…";


        status.textContent =
          "";

        status.className =
          "newsletter-status";


        try {


          const result =
            await client
              .from(
                "newsletter_subscribers"
              )
              .insert({
                email: email
              });


          if (result.error) {


            if (
              result.error.code ===
              "23505"
            ) {

              status.textContent =
                "You are already subscribed. Thank you!";

              status.className =
                "newsletter-status success";

            } else {

              throw result.error;

            }


          } else {


            status.textContent =
              "Thank you! You are now subscribed to Suru Collection updates.";

            status.className =
              "newsletter-status success";


            form.reset();

          }


        } catch (error) {


          console.error(
            "Newsletter subscription failed:",
            error
          );


          status.textContent =
            "Something went wrong. Please try again in a moment.";


          status.className =
            "newsletter-status error";


        } finally {


          button.disabled =
            false;


          button.textContent =
            "Subscribe";

        }

      }
    );

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initializeNewsletter
    );

  } else {

    initializeNewsletter();

  }

})();
