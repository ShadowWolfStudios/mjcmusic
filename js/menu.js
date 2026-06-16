document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.querySelector(".menu-toggle");
  const header = document.querySelector(".site-header");
  const siteNav = document.querySelector(".site-nav");

  if (!menuToggle || !header || !siteNav) return;

  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    header.classList.toggle("open", !expanded);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (header.classList.contains("open")) {
        header.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!header.classList.contains("open")) return;
    if (header.contains(event.target)) return;
    header.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});
