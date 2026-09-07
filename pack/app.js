(function () {
  var cfg = window.PACK || {};
  var raw = String(cfg.whatsapp || "").replace(/\D/g, "");
  var ready = /^56\d{9}$/.test(raw) && raw !== "56912345678";
  var text =
    "Hola, vi el Pack 7 días. Quiero una web + bot que cobre reservas. ¿Me mandas el ejemplo de 40 segundos?";
  var href = ready
    ? "https://wa.me/" + raw + "?text=" + encodeURIComponent(text)
    : "#whatsapp-config";

  document.querySelectorAll("[data-wa]").forEach(function (el) {
    el.setAttribute("href", href);
  });

  var warn = document.getElementById("config-warn");
  if (warn && !ready) warn.classList.add("show");

  document.querySelectorAll("[data-price]").forEach(function (el) {
    el.textContent = cfg.priceLabel || "$450.000";
  });
  document.querySelectorAll("[data-adelanto]").forEach(function (el) {
    el.textContent = cfg.adelantoLabel || "$225.000";
  });
})();
