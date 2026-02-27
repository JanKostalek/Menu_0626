let restaurantsList = [];
let menusCache = [];
let currentType = "today";
let menuLoading = false;
let menuError = "";
const kcalCache = new Map();
const kcalPending = new Map();

const COOKIE_FILTERS = "menu03_filters";
const COOKIE_CATEGORY_FILTERS = "menu03_category_filters";

const LS_MENU_CACHE_TODAY = "menu03_menu_cache_today";
const LS_MENU_CACHE_ALL = "menu03_menu_cache_all";
const LS_MENU_CACHE_DATE_TODAY = "menu03_menu_cache_date_today";
const LS_MENU_CACHE_DATE_ALL = "menu03_menu_cache_date_all";

const LS_RESTAURANTS_SIG = "menu03_restaurants_sig";

/**
 * Domény, které typicky blokují vložení do iframe (X-Frame-Options / CSP).
 */
const EMBED_BLOCKED_DOMAINS = [
  "holidayinn.cz",
];

const RESTAURANT_CATEGORY_META = {
  ceska: { label: "Česká", icon: "/icons/ceska.png" },
  cina: { label: "Čína", icon: "/icons/cina.png" },
  italska: { label: "Italská", icon: "/icons/italska.png" },
  mexicka: { label: "Mexická", icon: "/icons/mexicka.png" },
  burger: { label: "Burger", icon: "/icons/burger.png" },
  kavarna: { label: "Kavárna", icon: "/icons/kavarna.png" },
};
const VEG_ICON_YES = "/icons/vegetarian-yes.png";
const VEG_ICON_NO = "/icons/vegetarian-no.png";

/* ===== COOKIES HELPERS ===== */

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie =
    encodeURIComponent(name) +
    "=" +
    encodeURIComponent(value) +
    "; expires=" +
    expires +
    "; path=/; SameSite=Lax";
}

function getCookie(name) {
  const target = encodeURIComponent(name) + "=";
  const parts = document.cookie.split("; ");
  for (const p of parts) {
    if (p.startsWith(target)) return decodeURIComponent(p.substring(target.length));
  }
  return null;
}

/* ===== DATE ===== */

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ===== URL HELPERS ===== */

function isPdfUrl(url) {
  return /\.pdf(\?|#|$)/i.test(String(url || ""));
}

function isImageUrl(url) {
  return /\.(png|jpg|jpeg|webp|gif)(\?|#|$)/i.test(String(url || ""));
}

function getHostname(url) {
  try {
    return new URL(String(url), window.location.origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isEmbedBlocked(url) {
  const host = getHostname(url);
  if (!host) return false;

  return EMBED_BLOCKED_DOMAINS.some((d) => {
    const dom = String(d).toLowerCase();
    return host === dom || host.endsWith("." + dom);
  });
}

/* ===== POPUP OPEN ===== */

function openPopup(url) {
  const w = Math.min(1200, window.screen.width - 60);
  const h = Math.min(900, window.screen.height - 80);
  const left = Math.max(0, Math.floor((window.screen.width - w) / 2));
  const top = Math.max(0, Math.floor((window.screen.height - h) / 2));

  const features =
    `popup=yes,` +
    `width=${w},height=${h},left=${left},top=${top},` +
    `toolbar=no,menubar=no,location=no,status=no,` +
    `scrollbars=yes,resizable=yes`;

  const win = window.open(url, "menu_popup", features);
  if (!win) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  win.opener = null;
  win.focus();
}

/* ===== UI ICONS ===== */

function iconExternal() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"></path><path d="M5 5h6v2H7v10h10v-4h2v6H5V5z"></path></svg>`;
}

/* ===== CACHE HELPERS ===== */

function clearLocalMenuCache() {
  try {
    localStorage.removeItem(LS_MENU_CACHE_TODAY);
    localStorage.removeItem(LS_MENU_CACHE_ALL);
    localStorage.removeItem(LS_MENU_CACHE_DATE_TODAY);
    localStorage.removeItem(LS_MENU_CACHE_DATE_ALL);
  } catch {}
}

function normalizeRestaurantCategory(category) {
  const c = String(category || "").toLowerCase();
  return RESTAURANT_CATEGORY_META[c] ? c : "ceska";
}

function computeRestaurantsSig(list) {
  try {
    const slim = (list || []).map(r => ({
      id: r.id || "",
      name: r.name || "",
      url: r.url || "",
      mode: (r.mode || "parse"),
      category: normalizeRestaurantCategory(r.category),
    }));
    return JSON.stringify(slim);
  } catch {
    return "";
  }
}

/* ===== SOURCE BLOCKS ===== */

function buildPdfBlock(url) {
  const wrap = document.createElement("div");
  wrap.className = "source-block";

  const blocked = isEmbedBlocked(url);

  wrap.innerHTML = `
    <div class="source-actions">
      <button type="button" class="btn-action js-open-popup" data-url="${escapeHtmlAttr(url)}">
        ${iconExternal()} <span>Otevřít PDF</span>
      </button>
    </div>

    ${
      blocked
        ? `<div class="source-note source-note--warn">
             Otevření menu je blokováno zdrojovou stránkou. Použijte prosím tlačítko výše k jeho otevření.
           </div>`
        : `<div class="source-note">
             Pokud se náhled nezobrazí, použijte tlačítko <b>Otevřít PDF</b> výše.
           </div>
           <div class="pdf-wrap">
             <iframe class="pdf-frame" src="${escapeHtmlAttr(url)}"></iframe>
           </div>`
    }
  `;
  return wrap;
}

function buildImageBlock(url) {
  const wrap = document.createElement("div");
  wrap.className = "source-block";

  wrap.innerHTML = `
    <div class="source-actions">
      <a class="btn-action" href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">
        ${iconExternal()} <span>Otevřít obrázek</span>
      </a>
    </div>

    <div class="img-wrap">
      <img class="menu-image" src="${escapeHtmlAttr(url)}" alt="Menu" />
    </div>
  `;
  return wrap;
}

function buildWebBlock(url, mode) {
  const wrap = document.createElement("div");
  wrap.className = "source-block";

  const blocked = isEmbedBlocked(url);

  let inner = `
    <div class="source-actions">
      <button type="button" class="btn-action js-open-popup" data-url="${escapeHtmlAttr(url)}">
        ${iconExternal()} <span>Otevřít zdroj</span>
      </button>
    </div>
  `;

  if (String(mode || "").toLowerCase() === "embed") {
    if (blocked) {
      inner += `
        <div class="source-note source-note--warn">
          Otevření menu je blokováno zdrojovou stránkou. Použijte prosím tlačítko výše k jeho otevření.
        </div>
      `;
    } else {
      inner += `
        <div class="source-note">
          Pokud se náhled nezobrazí, použijte tlačítko <b>Otevřít zdroj</b> výše.
        </div>
        <div class="web-wrap">
          <iframe class="web-frame" src="${escapeHtmlAttr(url)}"></iframe>
        </div>
      `;
    }
  }

  wrap.innerHTML = inner;
  return wrap;
}

/* ===== FILTRY ===== */

function loadFilters() {
  try {
    const raw = getCookie(COOKIE_FILTERS);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function saveFilters(filters) {
  setCookie(COOKIE_FILTERS, JSON.stringify(filters), 365);
}

function setFilter(name, enabled) {
  const filters = {};
  const key = String(name).toLowerCase();

  if (enabled) {
    filters[key] = true;
  } else {
    filters[key] = false;
  }

  saveFilters(filters);
}

function loadCategoryFilters() {
  try {
    const raw = getCookie(COOKIE_CATEGORY_FILTERS);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function saveCategoryFilters(filters) {
  setCookie(COOKIE_CATEGORY_FILTERS, JSON.stringify(filters || {}), 365);
}

function getSelectedCategoryKeys() {
  const f = loadCategoryFilters();
  return Object.entries(f)
    .filter(([, v]) => v === true)
    .map(([k]) => normalizeRestaurantCategory(k));
}

function hasAnyCategoryFilterSelected() {
  return getSelectedCategoryKeys().length > 0;
}

function isCategoryFilterEnabled(categoryKey) {
  const key = normalizeRestaurantCategory(categoryKey);
  return loadCategoryFilters()[key] === true;
}

function toggleCategoryFilter(categoryKey) {
  const key = normalizeRestaurantCategory(categoryKey);
  const next = { ...loadCategoryFilters() };
  next[key] = next[key] === true ? false : true;
  saveCategoryFilters(next);
}

function clearCategoryFilters() {
  saveCategoryFilters({});
}

function isRestaurantAllowedByCategory(restaurant) {
  if (!hasAnyCategoryFilterSelected()) return true;
  const key = normalizeRestaurantCategory(restaurant?.category);
  return isCategoryFilterEnabled(key);
}

function renderCategoryFilterBar() {
  const bar = document.getElementById("typeFilterBar");
  if (!bar) return;

  const anySelected = hasAnyCategoryFilterSelected();
  const allBtnClass = anySelected ? "type-filter-btn" : "type-filter-btn active";

  const allHtml = `
    <button type="button" class="${allBtnClass}" data-cat-all="1">
      <span class="type-filter-btn__label">Všechny restaurace</span>
    </button>
  `;

  const orderedCategoryKeys = Object.keys(RESTAURANT_CATEGORY_META)
    .sort((a, b) => RESTAURANT_CATEGORY_META[a].label.localeCompare(RESTAURANT_CATEGORY_META[b].label, "cs"));

  const catsHtml = orderedCategoryKeys.map((key) => {
    const meta = RESTAURANT_CATEGORY_META[key];
    if (!meta) return "";
    const active = isCategoryFilterEnabled(key);
    return `
      <button type="button" class="type-filter-btn ${active ? "active" : ""}" data-cat-key="${escapeHtmlAttr(key)}">
        <img class="type-filter-btn__icon" src="${escapeHtmlAttr(meta.icon)}" alt="" aria-hidden="true" loading="lazy" onerror="this.style.display='none'" />
        <span class="type-filter-btn__label">${escapeHtml(meta.label)}</span>
      </button>
    `;
  }).join("");

  bar.innerHTML = allHtml + catsHtml;

  bar.querySelector('[data-cat-all="1"]')?.addEventListener("click", async () => {
    clearCategoryFilters();
    renderCategoryFilterBar();
    renderFilters();
    renderMenus();
    if (!menuLoading && (!menusCache || menusCache.length === 0)) await loadMenus(currentType);
  });

  bar.querySelectorAll("[data-cat-key]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const key = e.currentTarget.getAttribute("data-cat-key");
      if (!key) return;
      toggleCategoryFilter(key);
      renderCategoryFilterBar();
      renderFilters();
      renderMenus();
      if (!menuLoading && (!menusCache || menusCache.length === 0)) await loadMenus(currentType);
    });
  });
}

function normalizeMealForKcalQuery(name) {
  return String(name || "")
    .replace(/\b\d+[.,]?\d*\s*(g|kg|ml|l)\b/gi, " ")
    .replace(/\b\d+\s*x\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
}

function normalizeForFoodHeuristics(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function estimateVegetarianMeal(mealName) {
  const s = normalizeForFoodHeuristics(mealName);
  const compact = s.replace(/\s+/g, " ");

  const positiveStrong = [
    "vege",
    "vegetarian",
    "veganske",
    "vegansky",
    "vegan",
    "bez masa",
    "tofu",
    "falafel",
  ];
  if (positiveStrong.some((k) => compact.includes(k))) return true;

  const negativeMeat = [
    "kureci", "veprove", "hovezi", "kruti", "kachni", "ryba", "losos", "tunak", "krevet",
    "rizek", "stek", "steak", "burger", "sunka", "slanina", "uzen", "klobas", "parek",
    "salsiccia", "jatra", "drstkov", "gulas", "segedin", "panenka", "krkovice", "vejce se sunkou",
    "maso", "vyvar s masem", "s kurecim", "s veprovym", "s hovezim", "s lososem", "s tunkem"
  ];
  if (negativeMeat.some((k) => compact.includes(k))) return false;

  const likelyVeg = [
    "syr", "hermelin", "brokolice", "kvetak", "spenat", "zelenin", "salat", "cizrna", "cocka",
    "fazole", "houb", "hrib", "kuskus", "cous cous", "gnocchi", "rajcat", "paprika", "tofu"
  ];
  if (likelyVeg.some((k) => compact.includes(k))) return true;

  return false;
}

function renderVegetarianEstimate(el, mealName) {
  if (!el) return;

  const isVeg = estimateVegetarianMeal(mealName);
  const src = isVeg ? VEG_ICON_YES : VEG_ICON_NO;
  const title = isVeg ? "Vegetariánské (odhad)" : "Není vegetariánské (odhad)";

  el.innerHTML = `
    <img
      class="veg-estimate-icon"
      src="${escapeHtmlAttr(src)}"
      alt="${escapeHtmlAttr(title)}"
      title="${escapeHtmlAttr(title)}"
      loading="lazy"
      onerror="this.style.display='none'"
    />
  `;
}

function buildUsdaQueryCandidates(mealName) {
  const original = normalizeMealForKcalQuery(mealName);
  if (!original) return [];

  let q = ` ${original.toLowerCase()} `;

  const phraseReplacements = [
    [/kuřecí\s+vývar/g, " chicken broth soup "],
    [/hovězí\s+vývar/g, " beef broth soup "],
    [/zeleninov[ýá]\s+vývar/g, " vegetable broth soup "],
    [/rajsk[áa]|tomatov[áa]/g, " tomato "],
    [/pol[ée]vka/g, " soup "],
    [/kr[eé]m\b/g, " cream soup "],
    [/řízek|rizek/g, " schnitzel "],
    [/smažen[ýaé]/g, " fried "],
    [/kuřec[íi]/g, " chicken "],
    [/vepřov[éeí]/g, " pork "],
    [/hověz[íi]/g, " beef "],
    [/krůt[íi]/g, " turkey "],
    [/losos/g, " salmon "],
    [/sýr/g, " cheese "],
    [/bramborov[áaéý]/g, " potato "],
    [/brambor/g, " potato "],
    [/kaš[ei]/g, " mash "],
    [/rýže/g, " rice "],
    [/hranolky/g, " french fries "],
    [/těstoviny/g, " pasta "],
    [/gnocchi/g, " gnocchi "],
    [/guláš/g, " goulash "],
    [/svíčková/g, " sirloin cream sauce "],
    [/sekaná/g, " meatloaf "],
    [/salát|salátek/g, " salad "],
    [/cous\s*cous/g, " couscous "],
    [/čočk[ay]/g, " lentils "],
    [/fazolov[áa]/g, " bean "],
    [/cizrnov[áa]/g, " chickpea "],
    [/špenát/g, " spinach "],
    [/brokolice/g, " broccoli "],
    [/květák/g, " cauliflower "],
    [/smetanov[áaé]/g, " cream "],
    [/omáčk[ayou]/g, " sauce "],
    [/knedl[ií]k/g, " dumplings "],
    [/pečen[ýaé]/g, " roasted "],
    [/grilovan[ýaé]/g, " grilled "],
    [/pizza/g, " pizza "],
    [/burger/g, " burger "],
  ];

  for (const [re, rep] of phraseReplacements) {
    q = q.replace(re, rep);
  }

  q = q
    .replace(/[()]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\b(s|se|na|v|ve|u|a|z|do|od)\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const generic = q
    .replace(/\b(menu|daily|lunch)\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 100);

  const candidates = [];
  const add = (x) => {
    const v = String(x || "").trim();
    if (!v) return;
    if (!candidates.includes(v)) candidates.push(v);
  };

  add(generic);
  add(generic + " dish");
  add(original); // fallback na původní CZ název

  // Kratší fallback jen prvních pár slov (často pomůže USDA search)
  const words = generic.split(/\s+/).filter(Boolean);
  if (words.length > 2) add(words.slice(0, 2).join(" "));
  if (words.length > 3) add(words.slice(0, 3).join(" "));

  return candidates.slice(0, 5);
}

function parsePortionEstimate(mealName) {
  const raw = String(mealName || "");
  const s = raw.toLowerCase();

  const isSoup = /pol[eé]v|v[ýy]var|kr[eé]m|minestrone|dr[šs]tkov|bor[šs]č|kulajd|gul[aá]šov[aá]\s+pol/i.test(s);
  const isSalad = /sal[aá]t|caesar|poke|bowl/i.test(s);
  const isDessert = /palačink|l[íi]vanc|buchti|škub[aá]nk|kaše s m[aá]kem|dezert/i.test(s);
  const isPizza = /pizza/i.test(s);

  // "0,3l", "0, 3l", "300 ml"
  const volMatch = raw.match(/(\d+(?:\s*[,\.]\s*\d+)?)\s*(ml|l)\b/i);
  if (volMatch) {
    const num = Number(String(volMatch[1]).replace(/\s+/g, "").replace(",", "."));
    const unit = volMatch[2].toLowerCase();
    if (Number.isFinite(num) && num > 0) {
      const ml = unit === "l" ? Math.round(num * 1000) : Math.round(num);
      return { grams: ml, source: "explicit-volume" };
    }
  }

  // "120g", "250 g", "1 kg"
  const gramMatch = raw.match(/(\d+(?:\s*[,\.]\s*\d+)?)\s*(g|kg)\b/i);
  if (gramMatch) {
    const num = Number(String(gramMatch[1]).replace(/\s+/g, "").replace(",", "."));
    const unit = gramMatch[2].toLowerCase();
    if (Number.isFinite(num) && num > 0) {
      const grams = unit === "kg" ? Math.round(num * 1000) : Math.round(num);

      // U hlavních jídel bývá uvedená jen gramáž masa (např. 120g), přílohu dopočítáme.
      if (!isSoup && grams >= 80 && grams <= 220) {
        const side = isSalad ? 120 : 250;
        return { grams: grams + side, source: "explicit-protein-plus-side" };
      }
      return { grams, source: "explicit-grams" };
    }
  }

  if (isSoup) return { grams: 330, source: "heuristic-soup" };
  if (isSalad) return { grams: 320, source: "heuristic-salad" };
  if (isDessert) return { grams: 250, source: "heuristic-dessert" };
  if (isPizza) return { grams: 450, source: "heuristic-pizza" };
  return { grams: 420, source: "heuristic-main" };
}

function formatKcalEstimateText(mealName, kcalPer100g) {
  if (typeof kcalPer100g !== "number") return " • kcal odhad nedostupný";

  const portion = parsePortionEstimate(mealName);
  const grams = portion?.grams;
  if (!grams || !Number.isFinite(grams) || grams <= 0) {
    return ` • přibl. ${kcalPer100g} kcal / 100 g`;
  }

  const portionKcal = Math.round((kcalPer100g * grams) / 100);
  return ` • přibl. ${portionKcal} kcal / porce (~${grams} g)`;
}

async function fetchApproxKcal(mealName) {
  const mealKey = normalizeMealForKcalQuery(mealName);
  if (!mealKey) return null;

  if (kcalCache.has(mealKey)) return kcalCache.get(mealKey);
  if (kcalPending.has(mealKey)) return kcalPending.get(mealKey);

  const candidates = buildUsdaQueryCandidates(mealName);
  if (!candidates.length) return null;

  const p = (async () => {
    try {
      for (const q of candidates) {
        const resp = await fetch("/api/usda?query=" + encodeURIComponent(q), { cache: "no-store" });
        if (!resp.ok) continue;
        const data = await resp.json().catch(() => ({}));
        const kcal = typeof data?.kcal === "number" ? data.kcal : null;
        if (typeof kcal === "number") {
          kcalCache.set(mealKey, kcal);
          return kcal;
        }
      }

      kcalCache.set(mealKey, null);
      return null;
    } catch {
      kcalCache.set(mealKey, null);
      return null;
    } finally {
      kcalPending.delete(mealKey);
    }
  })();

  kcalPending.set(mealKey, p);
  return p;
}

function scheduleKcalEstimate(el, mealName) {
  if (!el || !mealName) return;
  const mealKey = normalizeMealForKcalQuery(mealName);
  if (!mealKey) return;

  // okamžitě z cache
  if (kcalCache.has(mealKey)) {
    const kcal = kcalCache.get(mealKey);
    el.textContent = formatKcalEstimateText(mealName, kcal);
    return;
  }

  el.textContent = " • odhad kcal…";

  fetchApproxKcal(mealName).then((kcal) => {
    if (!document.body.contains(el)) return;
    el.textContent = formatKcalEstimateText(mealName, kcal);
  });
}

function isEnabledByFilter(name) {
  const filters = loadFilters();
  const key = String(name).toLowerCase();
  return filters[key] === true;
}

function hasAnySelected() {
  const f = loadFilters();
  return Object.values(f).some(v => v === true);
}

function splitNameToTwoLines(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  return words;
}

function measureTextWidthPx(text, font) {
  const canvas = measureTextWidthPx._canvas || (measureTextWidthPx._canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = font || "16px Arial";
  return ctx.measureText(String(text || "")).width;
}

function fitRestaurantButtonLabels(container) {
  if (!container) return;

  const labels = container.querySelectorAll(".filter-btn__label");
  labels.forEach((label) => {
    const fullName = label.getAttribute("data-fullname") || label.textContent || "";
    label.textContent = fullName;

    const words = splitNameToTwoLines(fullName);
    if (!words) return;

    const cs = window.getComputedStyle(label);
    const font = cs.font || `${cs.fontSize} ${cs.fontFamily}`;
    const maxWidth = label.clientWidth;
    if (!maxWidth) return;

    const fullWidth = measureTextWidthPx(fullName, font);
    if (fullWidth <= maxWidth) return;

    // Přeteče-li text do ikonové (bílé) části, rozdělíme název do 2 řádků
    // podle reálně měřené šířky řádků.
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const left = words.slice(0, i).join(" ");
      const right = words.slice(i).join(" ");
      const w1 = measureTextWidthPx(left, font);
      const w2 = measureTextWidthPx(right, font);
      const overPenalty = Math.max(0, w1 - maxWidth) + Math.max(0, w2 - maxWidth);
      const balance = Math.abs(w1 - w2);
      const score = overPenalty * 1000 + balance;

      if (!best || score < best.score) {
        best = { left, right, score };
      }
    }

    if (!best) return;
    label.innerHTML = `${escapeHtml(best.left)}<br>${escapeHtml(best.right)}`;
  });
}

/* ===== UI: FILTRY ===== */

function renderFilters() {
  const container = document.getElementById("filterContainer");
  if (!container) return;

  if (!restaurantsList || restaurantsList.length === 0) {
    container.innerHTML = `<div class="small-muted">Zatím žádné restaurace.</div>`;
    return;
  }

  const visibleRestaurants = restaurantsList.filter((r) => isRestaurantAllowedByCategory(r));
  if (!visibleRestaurants.length) {
    container.innerHTML = `<div class="small-muted">Pro zvolený typ nebyla nalezena žádná restaurace.</div>`;
    return;
  }

  const html = visibleRestaurants.map((r) => {
    const enabled = isEnabledByFilter(r.name);
    const cls = enabled ? "filter-btn active-green" : "filter-btn";
    const category = normalizeRestaurantCategory(r.category);
    const iconSrc = RESTAURANT_CATEGORY_META[category]?.icon || "";
    const iconHtml = iconSrc
      ? `<img class="filter-btn__icon" src="${escapeHtmlAttr(iconSrc)}" alt="" aria-hidden="true" loading="lazy" onerror="this.style.display='none'" />`
      : "";
    return `<button type="button" class="${cls}" data-name="${escapeHtmlAttr(r.name)}">${iconHtml}<span class="filter-btn__label" data-fullname="${escapeHtmlAttr(r.name)}">${escapeHtml(r.name)}</span></button>`;
  }).join("");

  container.innerHTML = html;
  fitRestaurantButtonLabels(container);

  container.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const name = e.currentTarget.getAttribute("data-name");
      const nowEnabled = isEnabledByFilter(name);
      setFilter(name, !nowEnabled);

      renderFilters();
      renderMenus();

      if (!menuLoading && (!menusCache || menusCache.length === 0)) {
        await loadMenus(currentType);
      }
    });
  });
}

function setDefaultFirstVisitState() {
  const f = {};
  restaurantsList.forEach(r => { if (r?.name) f[String(r.name).toLowerCase()] = false; });
  saveFilters(f);
}

/* ===== RESTAURANTS LIST ===== */

async function loadRestaurantsList() {
  // Typový filtr se po načtení stránky vždy resetuje na "Všechny restaurace".
  clearCategoryFilters();

  try {
    const resp = await fetch("/api/restaurants", { cache: "no-store" });
    const data = await resp.json();

    // podporujeme oba formáty:
    // 1) starý: API vrací přímo pole restaurací
    // 2) nový: API vrací objekt { restaurants: [...], updatedAt: ... }
    if (Array.isArray(data)) {
      restaurantsList = data;
    } else if (data && Array.isArray(data.restaurants)) {
      restaurantsList = data.restaurants;
    } else {
      restaurantsList = [];
    }
  } catch {
    restaurantsList = [];
  }

  // pokud se změnil seznam restaurací => vymaž lokální menu cache
  try {
    const sig = computeRestaurantsSig(restaurantsList);
    const prev = localStorage.getItem(LS_RESTAURANTS_SIG) || "";
    if (sig && sig !== prev) {
      clearLocalMenuCache();
      localStorage.setItem(LS_RESTAURANTS_SIG, sig);
    }
  } catch {}

  // Po otevření stránky začíná bez vybrané restaurace.
  setDefaultFirstVisitState();

  renderCategoryFilterBar();
  renderFilters();
}

/* ===== MENU CACHE (LOCALSTORAGE) ===== */

function getCacheKey(type) {
  return type === "all" ? LS_MENU_CACHE_ALL : LS_MENU_CACHE_TODAY;
}
function getDateKey(type) {
  return type === "all" ? LS_MENU_CACHE_DATE_ALL : LS_MENU_CACHE_DATE_TODAY;
}

function loadLocalCache(type) {
  try {
    const raw = localStorage.getItem(getCacheKey(type));
    const date = localStorage.getItem(getDateKey(type));
    if (!raw || !date) return null;
    if (type === "today" && date !== todayISO()) return null;

    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function saveLocalCache(type, data) {
  try {
    localStorage.setItem(getCacheKey(type), JSON.stringify(data || []));
    localStorage.setItem(getDateKey(type), todayISO());
  } catch {}
}

/* ===== LOAD MENUS ===== */

async function loadMenus(type) {
  currentType = type;
  menuLoading = true;
  menuError = "";
  renderMenus();

  const cached = loadLocalCache(type);
  if (cached) {
    menusCache = cached;
    menuLoading = false;
    renderMenus();
    return;
  }

  try {
    const resp = await fetch("/api/getMenus?type=" + encodeURIComponent(type), { cache: "no-store" });
    const data = await resp.json();
    if (!Array.isArray(data)) throw new Error("API vrátilo neočekávaný formát");
    menusCache = data;
    saveLocalCache(type, data);
  } catch (e) {
    menuError = String(e?.message || e);
    menusCache = [];
  } finally {
    menuLoading = false;
    renderMenus();
  }
}

/* ===== RENDER ===== */

function renderEmptySelectionState(container) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__title">Máš hlad? Máš na něco chuť? Tak si pojď něco vybrat.</div>
      <div class="empty-state__subtitle">Pokud tu nevidíš svoji oblíbenou restauraci, pověz nám o ni pomocí tlačítka nahoře.</div>
    </div>
  `;
}

function renderMenus() {
  const container = document.getElementById("menuContainer");
  if (!container) return;

  container.innerHTML = "";

  if (menuLoading) {
    container.innerHTML = `<div class="restaurant"><div class="small-muted">Načítám menu…</div></div>`;
    return;
  }

  if (menuError) {
    container.innerHTML = `<div class="restaurant"><div class="small-muted"><b>Chyba načítání menu:</b><br>${escapeHtml(menuError)}</div></div>`;
    return;
  }

  if (!menusCache || menusCache.length === 0) {
    if (hasAnySelected()) {
      container.innerHTML = `<div class="restaurant"><div class="small-muted">Menu se nepodařilo načíst. Zkus obnovit stránku.</div></div>`;
    } else {
      renderEmptySelectionState(container);
    }
    return;
  }

  const filtered = menusCache.filter(r => {
    const selectedByName = isEnabledByFilter(r.name);
    if (!selectedByName) return false;
    const sourceRestaurant = restaurantsList.find((x) => (x.id && r.id && x.id === r.id) || x.name === r.name);
    return isRestaurantAllowedByCategory(sourceRestaurant || r);
  });

  if (!filtered.length) {
    renderEmptySelectionState(container);
    return;
  }

  filtered.forEach((r) => {
    const div = document.createElement("div");
    div.className = "restaurant";
    div.innerHTML = `<h3>${escapeHtml(r.name)}</h3>`;

    const url = r.url ? String(r.url) : "";
    const mode = String(r.mode || "parse").toLowerCase();

    if (url) {
      if (isPdfUrl(url)) div.appendChild(buildPdfBlock(url));
      else if (isImageUrl(url)) div.appendChild(buildImageBlock(url));
      else div.appendChild(buildWebBlock(url, mode));
    }

    const meals = Array.isArray(r.meals) ? r.meals : [];
    if (meals.length) {
      meals.forEach((m) => {
        const mealDiv = document.createElement("div");
        mealDiv.className = "meal";
        const price = m.price ? `${m.price} Kč` : "—";
        const day = m.day ? `(${m.day})` : "";
        const kcalId = `kcal-${Math.random().toString(36).slice(2, 10)}`;
        const vegId = `veg-${Math.random().toString(36).slice(2, 10)}`;
        mealDiv.innerHTML = `
          <div><b>${escapeHtml(m.name)}</b> ${escapeHtml(day)}</div>
          <div>💰 ${escapeHtml(price)} <span id="${kcalId}" class="small-muted"></span> <span id="${vegId}" class="meal-meta-icon"></span></div>
          <hr>
        `;
        const kcalEl = mealDiv.querySelector(`#${kcalId}`);
        const vegEl = mealDiv.querySelector(`#${vegId}`);
        scheduleKcalEstimate(kcalEl, m.name);
        renderVegetarianEstimate(vegEl, m.name);
        div.appendChild(mealDiv);
      });
    }

    container.appendChild(div);
  });

  container.querySelectorAll(".js-open-popup").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const url = e.currentTarget.getAttribute("data-url");
      if (!url) return;
      openPopup(url);
    });
  });
}

/* ===== TOP-RIGHT BUTTONS (index.html) ===== */

function openSuggestion() {
  // bezpečné (neblokuje popup blocker)
  openPopup("/suggest.html");
}

function openAdmin() {
  // Heslo se řeší až v admin.html (ať se to neptá 2×)
  openPopup("/admin.html");
}

/* ===== ESCAPE ===== */

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeHtmlAttr(str) { return escapeHtml(str); }

/* ===== INIT ===== */
(async function init() {
  await loadRestaurantsList();
  await loadMenus("today");
})();

window.addEventListener("resize", () => {
  const container = document.getElementById("filterContainer");
  fitRestaurantButtonLabels(container);
});
