/* menu03 - script.js */

const HERO_MESSAGE = "Máte hlad? A na co dneska máte chuť? Pojďme něco vybrat.";

const els = {
  btnToday: document.getElementById("btnToday"),
  btnAll: document.getElementById("btnAll"),
  btnAdmin: document.getElementById("btnAdmin"),
  btnSuggest: document.getElementById("btnSuggest"),
  btnReloadRestaurants: document.getElementById("btnReloadRestaurants"),

  restaurantsList: document.getElementById("restaurantsList"),
  restaurantsMeta: document.getElementById("restaurantsMeta"),

  selectedRestaurantName: document.getElementById("selectedRestaurantName"),
  selectedRestaurantSub: document.getElementById("selectedRestaurantSub"),

  menuContainer: document.getElementById("menuContainer"),
  sourceLink: document.getElementById("sourceLink"),
};

let restaurants = [];
let selectedRestaurantId = null;
let viewFilter = "today"; // "today" | "all"

init();

function init() {
  wireUi();
  loadRestaurants({ preferCache: true }).catch((e) => {
    showError(`Nepodařilo se načíst restaurace: ${e?.message || e}`);
  });
}

function wireUi() {
  els.btnToday?.addEventListener("click", () => {
    viewFilter = "today";
    setActiveFilterButton();
    if (selectedRestaurantId) loadMenuForSelected();
    else renderEmptyState(HERO_MESSAGE);
  });

  els.btnAll?.addEventListener("click", () => {
    viewFilter = "all";
    setActiveFilterButton();
    if (selectedRestaurantId) loadMenuForSelected();
    else renderEmptyState(HERO_MESSAGE);
  });

  els.btnAdmin?.addEventListener("click", () => openAdmin());
  els.btnSuggest?.addEventListener("click", () => openSuggestion());

  els.btnReloadRestaurants?.addEventListener("click", () => {
    loadRestaurants({ preferCache: false }).catch((e) => {
      showError(`Nepodařilo se obnovit restaurace: ${e?.message || e}`);
    });
  });

  setActiveFilterButton();
}

function setActiveFilterButton() {
  if (!els.btnToday || !els.btnAll) return;
  if (viewFilter === "today") {
    els.btnToday.classList.add("btn-primary");
    els.btnAll.classList.remove("btn-primary");
  } else {
    els.btnAll.classList.add("btn-primary");
    els.btnToday.classList.remove("btn-primary");
  }
}

async function loadRestaurants({ preferCache }) {
  const cacheBuster = preferCache ? "" : `?t=${Date.now()}`;
  const res = await fetch(`/api/restaurants${cacheBuster}`, { method: "GET" });
  if (!res.ok) throw new Error(await safeReadText(res));
  const data = await res.json();

  restaurants = Array.isArray(data?.restaurants) ? data.restaurants : [];
  renderRestaurantsList();

  els.restaurantsMeta.textContent = restaurants.length
    ? `${restaurants.length} položek`
    : `Žádné restaurace`;

  if (selectedRestaurantId && restaurants.some(r => r.id === selectedRestaurantId)) {
    setSelectedRestaurant(selectedRestaurantId, { scrollIntoView: false, loadMenu: true });
  } else {
    selectedRestaurantId = null;
    renderSelectionHeader(null);
    renderEmptyState(HERO_MESSAGE);
    els.sourceLink.style.display = "none";
  }
}

function renderRestaurantsList() {
  if (!els.restaurantsList) return;

  els.restaurantsList.innerHTML = "";

  if (!restaurants.length) {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.textContent = "Žádné restaurace.";
    els.restaurantsList.appendChild(div);
    return;
  }

  restaurants.forEach((r) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "restaurant-item btn btn-block";
    btn.dataset.id = r.id;

    if (r.id === selectedRestaurantId) {
      btn.classList.add("restaurant-selected");
    }

    btn.textContent = r.name || r.id;

    btn.addEventListener("click", () => {
      setSelectedRestaurant(r.id, { scrollIntoView: true, loadMenu: true });
    });

    els.restaurantsList.appendChild(btn);
  });
}

function setSelectedRestaurant(id, { scrollIntoView, loadMenu }) {
  selectedRestaurantId = id;

  const buttons = els.restaurantsList?.querySelectorAll("button.restaurant-item") || [];
  buttons.forEach((b) => {
    if (b.dataset.id === id) b.classList.add("restaurant-selected");
    else b.classList.remove("restaurant-selected");
  });

  const r = restaurants.find(x => x.id === id) || null;
  renderSelectionHeader(r);

  if (scrollIntoView) {
    const active = els.restaurantsList?.querySelector(`button.restaurant-item[data-id="${cssEscape(id)}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }

  if (loadMenu) loadMenuForSelected();
}

function renderSelectionHeader(r) {
  if (!r) {
    els.selectedRestaurantName.textContent = HERO_MESSAGE;
    els.selectedRestaurantSub.textContent = "";
    return;
  }
  els.selectedRestaurantName.textContent = r.name || r.id;
  els.selectedRestaurantSub.textContent = r.url || "";
}

async function loadMenuForSelected() {
  const r = restaurants.find(x => x.id === selectedRestaurantId);
  if (!r) {
    renderEmptyState(HERO_MESSAGE);
    els.sourceLink.style.display = "none";
    return;
  }

  const mode = normalizeMode(r.mode);

  els.sourceLink.href = r.url || "#";
  els.sourceLink.style.display = r.url ? "inline-flex" : "none";

  const isPdf = looksLikePdf(r.url);
  const isImg = looksLikeImage(r.url);

  if (mode === "embed" || isPdf || isImg) {
    renderSource(r);
    return;
  }

  renderLoading();
  try {
    const data = await loadMenusFromApi(viewFilter);
    const menu = Array.isArray(data?.menus) ? data.menus.find(m => m.id === r.id) : null;
    if (!menu) {
      showError("Chyba načítání menu: API vrátilo neočekávaný formát");
      return;
    }
    renderParsedMenu(menu);
  } catch (e) {
    showError(`Chyba načítání menu: ${e?.message || e}`);
  }
}

async function loadMenusFromApi(type) {
  const res = await fetch(`/api/getMenus?type=${encodeURIComponent(type)}`, { method: "GET" });
  if (!res.ok) throw new Error(await safeReadText(res));
  return await res.json();
}

function renderLoading() {
  els.menuContainer.innerHTML = `<div class="empty-state">Načítám…</div>`;
}

function renderEmptyState(msg) {
  const isHero = msg === HERO_MESSAGE;
  els.menuContainer.innerHTML = `<div class="${isHero ? "empty-state hero-empty" : "empty-state"}">${escapeHtml(msg)}</div>`;
}

function renderSource(r) {
  const url = r.url || "";
  const isPdf = looksLikePdf(url);
  const isImg = looksLikeImage(url);

  const openLabel = isPdf ? "Otevřít PDF" : "Otevřít zdroj";

  let preview = "";
  if (isImg) {
    preview = `<div class="img-wrap"><img class="menu-image" src="${escapeHtmlAttr(url)}" alt="${escapeHtmlAttr(r.name || "")}"></div>`;
  } else {
    const cls = isPdf ? "pdf-frame" : "web-frame";
    const wrap = isPdf ? "pdf-wrap" : "web-wrap";
    preview = `<div class="${wrap}"><iframe class="${cls}" src="${escapeHtmlAttr(url)}" loading="lazy"></iframe></div>`;
  }

  els.menuContainer.innerHTML = `
    <div class="source-block">
      <div class="source-actions">
        <a class="btn-action" href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener">${openLabel}</a>
        <button class="btn-action" type="button" id="btnPopup">Otevřít v okně</button>
      </div>
      <div class="source-note">Pokud se náhled nezobrazí (blokace embed), použij tlačítko „Otevřít v okně“.</div>
      ${preview}
    </div>
  `;

  document.getElementById("btnPopup")?.addEventListener("click", () => {
    openMinimalPopup(url);
  });
}

function renderParsedMenu(menu) {
  const err = menu.error ? String(menu.error) : "";
  const meals = Array.isArray(menu.meals) ? menu.meals : [];

  let html = `<div class="restaurant">`;

  if (err) {
    html += `<div class="source-note source-note--warn">Chyba načítání: ${escapeHtml(err)}</div>`;
  }

  if (!meals.length) {
    html += `<div class="empty-state">Menu se nepodařilo vyčíst. Pokud je to web s blokací/dynamikou, zvaž v administraci přepnout na „Embed“.</div>`;
  } else {
    meals.forEach((m) => {
      const title = m.title || m.name || "";
      const price = m.price ? ` – ${m.price}` : "";
      html += `<div class="meal">${escapeHtml(title)}${escapeHtml(price)}</div>`;
    });
  }

  html += `</div>`;
  els.menuContainer.innerHTML = html;
}

function openAdmin() {
  openMinimalPopup("admin.html");
}

function openSuggestion() {
  openMinimalPopup("suggest.html");
}

function openMinimalPopup(url) {
  const w = 1150;
  const h = 850;
  const left = Math.max(0, Math.floor((screen.width - w) / 2));
  const top = Math.max(0, Math.floor((screen.height - h) / 2));
  const features = [
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    "toolbar=no",
    "menubar=no",
    "location=no",
    "status=no",
    "scrollbars=yes",
    "resizable=yes",
    "noopener",
    "noreferrer",
  ].join(",");
  window.open(url, "_blank", features);
}

function normalizeMode(mode) {
  const m = String(mode || "").toLowerCase();
  return m === "embed" ? "embed" : "parse";
}

function looksLikePdf(url) {
  return /\.pdf(\?|#|$)/i.test(String(url || ""));
}

function looksLikeImage(url) {
  return /\.(png|jpg|jpeg|webp|gif)(\?|#|$)/i.test(String(url || ""));
}

function showError(msg) {
  els.menuContainer.innerHTML = `<div class="source-note source-note--warn">${escapeHtml(msg)}</div>`;
}

async function safeReadText(res) {
  try { return await res.text(); } catch { return ""; }
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttr(str) {
  return escapeHtml(str);
}

function cssEscape(str) {
  try { return CSS.escape(str); } catch { return String(str || "").replaceAll('"', '\\"'); }
}