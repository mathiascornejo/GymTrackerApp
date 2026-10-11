// Runs before first paint so the saved theme never flashes. Keep the key in sync with src/app/theme.ts.
try {
  var t = localStorage.getItem("tempered.theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
