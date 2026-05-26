/* DataRegimen — site interactivity */
(function () {
  "use strict";

  // ---- Year stamp ----
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Mobile navigation ----
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("primary-nav");

  if (toggle && nav) {
    const closeNav = () => {
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
    };
    const openNav = () => {
      toggle.setAttribute("aria-expanded", "true");
      nav.classList.add("is-open");
    };

    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      expanded ? closeNav() : openNav();
    });

    // Close on link click (mobile)
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 720px)").matches) closeNav();
      });
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        closeNav();
        toggle.focus();
      }
    });

    // Close when clicking outside on mobile
    document.addEventListener("click", (e) => {
      if (!window.matchMedia("(max-width: 720px)").matches) return;
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      closeNav();
    });
  }

  // ---- Contact form (Formspree AJAX) ----
  const form = document.querySelector(".contact-form");
  if (form) {
    const status = form.querySelector(".form-status");
    const submitBtn = form.querySelector('button[type="submit"]');

    const setStatus = (msg, kind) => {
      if (!status) return;
      status.textContent = msg;
      status.classList.remove("is-success", "is-error");
      if (kind) status.classList.add("is-" + kind);
    };

    const validate = () => {
      let ok = true;
      form.querySelectorAll("[required]").forEach((field) => {
        const isValid = field.checkValidity();
        field.setAttribute("aria-invalid", isValid ? "false" : "true");
        if (!isValid) ok = false;
      });
      return ok;
    };

    // Live validation feedback
    form.querySelectorAll("[required]").forEach((field) => {
      field.addEventListener("blur", () => {
        field.setAttribute(
          "aria-invalid",
          field.checkValidity() ? "false" : "true"
        );
      });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus("", null);

      if (!validate()) {
        setStatus("Please complete the required fields.", "error");
        const firstInvalid = form.querySelector('[aria-invalid="true"]');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
      setStatus("Sending your message…", null);

      try {
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
          // Do not include the honey pot field in the sheets data if it's empty
          if (key === "_gotcha" && !value) return;
          data[key] = value;
        });

        const response = await fetch(form.action, {
          method: form.method || "POST",
          body: JSON.stringify(data),
          headers: {
            "Content-Type": "text/plain",
            Accept: "application/json",
          },
        });

        if (response.ok) {
          form.reset();
          setStatus(
            "Thank you. Your message has been received, and a member of our team will reach out to you shortly.",
            "success"
          );
          // Reset aria-invalid flags
          form
            .querySelectorAll("[aria-invalid]")
            .forEach((f) => f.setAttribute("aria-invalid", "false"));
        } else {
          let msg = "Something went wrong sending your message. Please try again or email hello@dataregimen.com directly.";
          try {
            const body = await response.json();
            if (body && body.errors && body.errors.length) {
              msg = body.errors.map((er) => er.message).join(" ");
            }
          } catch (_) { /* ignore parse errors */ }
          setStatus(msg, "error");
        }
      } catch (err) {
        setStatus(
          "Network error. Please try again or email hello@dataregimen.com directly.",
          "error"
        );
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
})();
