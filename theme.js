(() => {
  const savedTheme = localStorage.getItem("zp-theme");
  if (savedTheme === "dark" || savedTheme === "light") {
    document.documentElement.dataset.theme = savedTheme;
  }
})();
