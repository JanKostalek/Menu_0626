/* menu03 - script.js
   - Single selection (vždy jen 1 restaurace)
   - Dnešní / Celé menu
   - Hybrid Parse/Embed per restaurace
*/

const LS_MENU_CACHE_TODAY = "menu03_menu_cache_today";
const LS_MENU_CACHE_ALL = "menu03_menu_cache_all";
const LS_MENU_CACHE_DATE_TODAY = "menu03_menu_cache_date_today";
const LS_MENU_CACHE_DATE_ALL = "menu03_menu_cache_date_all";

let restaurants = [];
let selectedId = null;
let currentType = "today"; // today | all

const filterContainer = document.getElementById("filterContainer");
const menuContainer = document.getElementById("menuContainer");

// ---- UI actions called from HTML ----
window.loadToday = () => {
  currentType = "today";
  refreshMenus();
};

window.loadAll = () => {
  currentType = "all";
  refreshMenus();
};

window.openAdmin = () => openPopup("admin.html", 1150, 850);
window.openSuggestion = () => openPopup("suggest.html", 900, 750);

// ---- Init ----
init().catch((e) => {
  renderError("Chyba inicializace: " + (e?.message || e));
});

async function init() {
  await loadRestaurants();
  renderRestaurantButtons();

  // auto-select první restauraci, pokud nic není vybráno
  if (!selectedId && restaurants.length) {
    setSelected(restaurants[0].id);
  }

  await refreshMenus();
}

async function loadRestaurants() {
  const resp = await fetch("/api/restaurants", { cache: "no-store" });
  if (!resp.ok) throw new Error("GET /api/restaurants " + resp.status);

  const data = await resp.json();
  restaurants = Array.isArray(data) ? data : [];
}

function renderRestaurantButtons() {
  if (!filterContainer) return;

  filterContainer.innerHTML = "";

  if (!restaurants.length) {
    filterContainer.innerHTML = "<div class='small-muted'>Žádné restaurace.</div>";
    return;
  }

  for (const r of restaurants) {
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    btn.textContent = r.name || r.id;
    btn.dataset.id = r.id;

    btn.addEventListener("click", () => {
      setSelected(r.id);
      refreshMenus();
    });

    filterContainer.appendChild(btn);
  }

  updateActiveButton();
}

function setSelected(id) {
  selectedId = id;
  updateActiveButton();
}

function updateActiveButton() {
  const buttons = filterContainer?.querySelectorAll("button.filter-btn") || [];
  buttons.forEach((b) => {
    if (b.dataset.id === selectedId) b.classList.add("active-green");
    else b.classList.remove("active-green");
  });
}

async function refreshMenus() {
  if (!menuContainer) return;

  if (!selectedId) {
    menuContainer.innerHTML = "<div class='small-muted'>Vyber restauraci vlevo.</div>";
    return;
  }

  const selected = restaurants.find((r) => r.id === selectedId);
  if (!selected) {
    menuContainer.innerHTML = "<div class='small-muted'>Vyber restauraci vlevo.</div>";
    return;
  }

  // PDF/obrázek nebo embed: zobrazit zdroj (iframe/img + popup)
  if (looksLikePdf(selected.url) || looksLikeImage(selected.url) || String(selected.mode || "").toLowerCase() === "embed") {
    renderSourceOnly(selected);
    return;
  }

  // parse režim: načíst menu přes API (pro všechny) a vybrat jen jednu restauraci
  renderLoading();

  const menus = await loadMenusCached(currentType);
  const menu = Array.isArray(menus) ? menus.find((m) => String(m.id) === String(selectedId)) : null;

  if (!menu) {
    renderError("Menu se nepodařilo načíst (restaurace nenalezena v datech).");
    return;
  }

  renderParsedMenu(menu);
}

function renderLoading() {
  menuContainer.innerHTML = "<div class='small-muted'>Načítám…</div>";
}

function renderError(msg) {
  menuContainer.innerHTML = "<div class='source-note source-note--warn'>" + escapeHtml(msg) + "</div>";
}

function renderSourceOnly(r) {
  const url = r.url || "";
  const name = r.name || "";

  const openLabel = looksLikePdf(url) ? "Otevřít PDF" : "Otevřít zdroj";

  let body = "";

  if (looksLikeImage(url)) {
    body = `
      <div class="img-wrap">
        <img class="menu-image" src="${escapeAttr(url)}" alt="${escapeAttr(name)}" />
      </div>
    `;
  } else {
    // PDF nebo web embed
    const cls = looksLikePdf(url) ? "pdf-frame" : "web-frame";
    body = `
      <div class="${looksLikePdf(url) ? "pdf-wrap" : "web-wrap"}">
        <iframe class="${cls}" src="${escapeAttr(url)}" loading="lazy"></iframe>
      </div>
    `;
  }

  menuContainer.innerHTML = `
    <div class="source-block">
      <div class="source-actions">
        <a class="btn-action" href="${escapeAttr(url)}" target="_blank" rel="noopener">${openLabel}</a>
        <button class="btn-action" type="button" id="btnPopup">Otevřít v okně</button>
      </div>
      <div class="source-note">Pokud se náhled nezobrazí (blokace embed), použij tlačítko „Otevřít v okně“.</div>
      ${body}
    </div>
  `;

  const btnPopup = document.getElementById("btnPopup");
  btnPopup?.addEventListener("click", () => openPopup(url, 1200, 900));
}

function renderParsedMenu(menu) {
  const name = menu.name || "Restaurace";
  const url = menu.url || "";
  const err = menu.error ? String(menu.error) : "";
  const meals = Array.isArray(menu.meals) ? menu.meals : [];

  let html = `
    <div class="restaurant">
      <h2>${escapeHtml(name)}</h2>
      <div class="small-muted">${escapeHtml(url)}</div>
  `;

  if (err) {
    html += `<div class="source-note source-note--warn">Chyba načítání: ${escapeHtml(err)}</div>`;
  }

  if (!meals.length) {
    html += `<div class="small-muted">Menu se nepodařilo vyčíst. Pokud je to web s blokací/dynamikou, zvaž v administraci přepnout na „Embed“.</div>`;
  } else {
    for (const m of meals) {
      const title = m.title || m.name || "";
      const price = m.price ? ` – ${m.price}` : "";
      html += `<div class="meal">${escapeHtml(title)}${escapeHtml(price)}</div>`;
    }
  }

  html += `</div>`;
  menuContainer.innerHTML = html;
}

async function loadMenusCached(type) {
  const isAll = type === "all";

  const keyData = isAll ? LS_MENU_CACHE_ALL : LS_MENU_CACHE_TODAY;
  const keyDate = isAll ? LS_MENU_CACHE_DATE_ALL : LS_MENU_CACHE_DATE_TODAY;

  const today = todayISO();

  try {
    const cachedDate = localStorage.getItem(keyDate);
    const cachedJson = localStorage.getItem(keyData);
    if (cachedDate === today && cachedJson) {
      const parsed = JSON.parse(cachedJson);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  const url = `/api/getMenus?type=${isAll ? "all" : "today"}`;
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error("GET " + url + " " + resp.status);

  const data = await resp.json();

  try {
    localStorage.setItem(keyDate, today);
    localStorage.setItem(keyData, JSON.stringify(data));
  } catch {}

  return data;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function openPopup(url, w, h) {
  try {
    window.open(url, "_blank", `popup=yes,noopener,noreferrer,width=${w},height=${h}`);
  } catch {
    window.open(url, "_blank");
  }
}

function looksLikePdf(url) {
  return /\.pdf(\?|#|$)/i.test(String(url || ""));
}

function looksLikeImage(url) {
  return /\.(png|jpg|jpeg|webp|gif)(\?|#|$)/i.test(String(url || ""));
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}