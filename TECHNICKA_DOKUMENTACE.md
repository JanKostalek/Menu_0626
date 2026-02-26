# Technická dokumentace aplikace `menu`

## 1. Přehled systému

Projekt `menu` je jednoduchá webová aplikace (HTML/CSS/vanilla JS) nasazená na Vercelu.

Skládá se ze 2 hlavních částí:
- frontend (statické stránky `index.html`, `admin.html`, `suggest.html`, `viewer.html`)
- backend (Vercel serverless funkce v `api/*.js`)

Hlavní účel:
- agregovat denní menu restaurací z různých zdrojů (HTML/PDF/obrázek),
- zobrazit je na jedné stránce,
- umožnit správu seznamu restaurací přes administraci,
- volitelně dopočítat odhad kcal přes USDA API.

## 2. Technologie

## 2.1 Frontend

- `HTML`
- `CSS`
- `Vanilla JavaScript` (`script.js`, JS inline v `admin.html`)

## 2.2 Backend

- Vercel Serverless Functions (`api/*.js`)
- Node.js runtime (ESM)
- `@vercel/kv` (persistentní uložení dat a cache)
- `cheerio` (parsování HTML)
- `pdf-parse` (v projektu jako dependency; využití dle endpointů)

## 2.3 Hosting / Deploy

- GitHub repo
- Vercel deploy
- Environment Variables (např. `USDA_KEY`)

## 3. Struktura projektu

### Kořen projektu

- `index.html` – hlavní stránka
- `script.js` – hlavní frontend logika
- `style.css` – hlavní styly
- `admin.html` – administrace restaurací a návrhů
- `suggest.html` – formulář pro návrh restaurace
- `viewer.html`, `viewer.js`, `viewer.css` – pomocné zobrazení (pokud používané)
- `restaurants.json` – fallback seznam restaurací
- `vercel.json` – základní Vercel config
- `package.json` – dependencies

### Backend (`api/`)

- `api/getMenus.js` – načtení a parsování menu + cache
- `api/restaurants.js` – CRUD restaurací + reorder
- `api/suggestions.js` – CRUD návrhů restaurací
- `api/recache.js` – invalidace cache
- `api/usda.js` – USDA kcal lookup + cache
- `api/checkEmbed.js` – pomocná kontrola embed (pokud používáno)

## 4. Architektura a datové toky

## 4.1 Hlavní stránka (`index.html` + `script.js`)

Po načtení stránky:
1. frontend načte seznam restaurací z `/api/restaurants`
2. resetuje typový filtr na `Všechny restaurace`
3. vykreslí:
   - horní filtry podle typu restaurace
   - levý seznam restaurací
4. načte menu z `/api/getMenus?type=today`
5. menu se vykresluje až po výběru konkrétní restaurace

### Důležité UX principy

- Typový filtr restaurací = multi-select
- Výběr konkrétní restaurace = single-select
- Po načtení stránky:
  - žádná restaurace není vybraná
  - aktivní je typový filtr `Všechny restaurace`

## 4.2 Administrace (`admin.html`)

Admin stránka je samostatná HTML stránka s inline JS.

Umí:
- přidat restauraci
- mazat restauraci
- měnit režim `parse/embed`
- měnit kategorii restaurace
- měnit pořadí restaurací (šipky)
- dávkově uložit změny (`Uložit změny`)
- zahodit neuložené změny (`Zrušit změny`)
- invalidovat cache (`ReCache`)

Admin používá stejné backend endpointy:
- `/api/restaurants`
- `/api/suggestions`
- `/api/recache`

## 5. Datový model

## 5.1 Restaurace

Normalizovaný objekt restaurace:

```json
{
  "id": "unikatni-id",
  "name": "Salanda",
  "url": "https://...",
  "mode": "parse",
  "category": "ceska"
}
```

### Pole

- `id` – string identifikátor
- `name` – název restaurace
- `url` – URL menu / zdroje
- `mode` – `parse` | `embed`
- `category` – typ restaurace:
  - `cina`
  - `italska`
  - `mexicka`
  - `ceska`
  - `burger`
  - `kavarna`

Výchozí hodnoty:
- `mode`: `parse`
- `category`: `ceska`

## 5.2 Návrh restaurace

Objekt návrhu (z `api/suggestions.js`):

```json
{
  "id": "unikatni-id",
  "name": "Název",
  "menuUrl": "https://...",
  "submitter": "Jméno",
  "email": "mail@example.com",
  "createdAt": 1700000000000
}
```

## 5.3 Výstup menu (`/api/getMenus`)

```json
{
  "id": "id-restaurace",
  "name": "Název restaurace",
  "url": "https://...",
  "mode": "parse",
  "meals": [
    {
      "name": "150 g Smažený řízek",
      "price": "179",
      "day": "Čtvrtek"
    }
  ]
}
```

Volitelně může být:
- `error` – text chyby při parsování konkrétní restaurace

## 6. Backend API - detailně

## 6.1 `GET /api/restaurants`

Vrací seznam restaurací.

### Zdroj dat

1. primárně Vercel KV (`restaurants:list`)
2. fallback `restaurants.json`

### Normalizace

Backend při čtení normalizuje:
- `mode`
- `category`
- `name/url`

## 6.2 `POST /api/restaurants` (add)

Přidání nové restaurace.

### Body

```json
{
  "name": "Restaurace",
  "url": "https://...",
  "mode": "parse",
  "category": "ceska"
}
```

### Chování

- vytvoří nový `id`
- uloží do KV
- invaliduje cache menu (`restaurants:updatedAt`, `menus:cacheBuster`)

## 6.3 `POST /api/restaurants` (`action=update`)

Aktualizace jedné restaurace (režim / url / název / kategorie).

### Body

```json
{
  "action": "update",
  "id": "rest-id",
  "mode": "embed",
  "category": "burger"
}
```

Podporuje i změnu:
- `name`
- `url`

## 6.4 `POST /api/restaurants` (`action=reorder`)

Uložení pořadí restaurací.

### Body

```json
{
  "action": "reorder",
  "ids": ["id1", "id2", "id3"]
}
```

### Validace

- počet ID musí sedět
- nesmí být duplicity
- všechna ID musí existovat

## 6.5 `DELETE /api/restaurants?id=...`

Smaže restauraci dle `id`.

## 6.6 `GET/POST/DELETE /api/suggestions`

Správa návrhů restaurací.

### `GET`
- vrací seznam návrhů (nejnovější první)

### `POST`
- ukládá návrh
- validuje email

### `DELETE`
- maže návrh podle `id`

## 6.7 `POST /api/recache`

Invaliduje cache na serveru (přes KV klíče / cache-buster).

Používá se z adminu po změnách.

## 6.8 `GET /api/getMenus?type=today|all`

Hlavní endpoint pro načtení menu.

### Postup

1. načte seznam restaurací (`loadRestaurants()`)
2. sestaví cache key podle:
   - typu (`today` / `all`)
   - data
   - `restaurants:updatedAt`
   - `menus:cacheBuster`
3. zkusí vrátit data z KV cache
4. pokud cache není:
   - projde restaurace
   - dle `mode` a typu URL zvolí strategii
   - uloží výsledek do KV (TTL cca 36h)

### Strategie podle restaurace

- PDF / obrázek:
  - bez parsování, pouze zdroj
- `mode = embed`:
  - bez parsování, pouze zdroj
- `mode = parse`:
  - fetch HTML + parser

## 6.9 `GET /api/usda?query=...`

Kcal lookup přes USDA FoodData Central.

### Vyžaduje

- env `USDA_KEY`

### Chování

1. zkusí KV cache (`usda:kcal:*`)
2. dotáže USDA API
3. vytáhne nutrient `Energy` / `1008`
4. vrátí kcal (typicky na 100 g)
5. uloží výsledek do KV cache

### Možné chyby

- `500 Chybí USDA_KEY...`
- `502 USDA error ...` (např. 403)

## 7. Parsování menu - implementace

## 7.1 Obecný parser (`extractMealsHeuristic`)

Obecný parser pro HTML stránky.

Princip:
- odebere `script/style/nav/header/footer`
- prochází DOM
- hledá texty obsahující cenu (`Kč` / `CZK`)
- heuristicky oddělí název a cenu
- filtruje šum (kontakt, cookies, galerie...)
- deduplikuje výsledky

### Omezení

- nefunguje spolehlivě na všech strukturách
- hůř funguje tam, kde jsou názvy a ceny oddělené v komplexní tabulce nebo dynamickém UI

## 7.2 Speciální parser: `menicka.cz` tiskový náhled

Rozpoznání URL:
- `menicka.cz/tisk-profil.php`

### Specifika

- stránka automaticky volá `window.print()`
- reálný obsah menu je ale přímo v HTML
- kódování může být `windows-1250`

### Implementace

- speciální dekódování response (`windows-1250`)
- parsování sekcí `div.content`
- parsování `table.menu`
- výběr dne podle `type=today`

## 7.3 Speciální parser: `restauracesalanda.cz`

Rozpoznání URL:
- hostname obsahuje `restauracesalanda.cz`

### Implementace

- načte mapování dní z `.daily-menu-days button[data-bs-target]`
- identifikuje aktivní den (`activeButton`)
- parsuje řádky z `#priceTable > div[id^='collapse'] table tr`
- bere název z `<strong>` v první buňce
- cenu z druhé buňky

### Výběr dne

- `today`: preferuje aktivní collapse blok
- fallback: dle českého názvu dne (`Pondělí`, `Úterý`, ...)
- `all`: vrací všechny dny

## 8. Frontend stav a persistence

## 8.1 Cookies

### Výběr konkrétní restaurace

Klíč:
- `menu03_filters`

Obsah:
- mapování `restaurantName -> boolean`

Aktuální chování:
- single-select (vždy max 1 `true`)

### Typové filtry restaurací

Klíč:
- `menu03_category_filters`

Obsah:
- mapování `category -> boolean`

Aktuální chování:
- multi-select
- při načtení stránky se resetuje na `{}` (=> `Všechny restaurace`)

## 8.2 LocalStorage

Používá se pro lokální cache menu a invalidaci:

- `menu03_menu_cache_today`
- `menu03_menu_cache_all`
- `menu03_menu_cache_date_today`
- `menu03_menu_cache_date_all`
- `menu03_restaurants_sig`

### `restaurants_sig`

Fingerprint seznamu restaurací (včetně `id`, `name`, `url`, `mode`, `category`).

Pokud se změní:
- frontend smaže lokální menu cache

## 8.3 Runtime stav ve `script.js`

Hlavní proměnné:
- `restaurantsList`
- `menusCache`
- `currentType`
- `menuLoading`
- `menuError`

Kcal subsystem:
- `kcalCache` – in-memory cache výsledků
- `kcalPending` – in-flight promise cache (deduplikace requestů)

## 9. Kcal odhady - frontend logika

Kcal se řeší na frontendu po vykreslení jídel.

## 9.1 Workflow

1. UI vykreslí jídlo + cenu + placeholder `odhad kcal…`
2. `script.js` vygeneruje dotaz pro USDA
3. proběhne `/api/usda?query=...`
4. UI doplní:
   - kcal odhad na porci
   - nebo `kcal odhad nedostupný`

## 9.2 Překlad CZ -> EN pro USDA

`script.js` generuje více kandidátních dotazů:
- přeložená/normalizovaná varianta (CZ -> EN klíčová slova)
- fallbacky (`dish`, kratší dotaz)
- původní CZ název

UI vždy zachovává český název jídla.

## 9.3 Odhad porce

Frontend používá heuristiku:
- pokud je v názvu gramáž/objem (`150 g`, `0,3 l`) => použije ji
- pokud je uvedena jen gramáž masa => dopočte přílohu
- jinak použije odhad dle typu jídla (polévka / salát / pizza / hlavní jídlo)

Výstup:
- `přibl. XXX kcal / porce (~YYY g)`

## 10. Admin - interní stav a dávkové změny

Admin (`admin.html`) drží změny lokálně a ukládá je dávkově.

### Lokální pending struktury

- `pendingModeById` – neuložené změny režimu
- `pendingCategoryById` – neuložené změny typu restaurace
- `pendingOrderIds` – neuložené pořadí restaurací

### Aktuální stav z backendu

- `currentModeById`
- `currentCategoryById`
- `currentOrderIds`

### Počítadlo `Uložit změny (N)`

Počítá:
- počet změn režimu
- počet změn typu
- +1 při změně pořadí

## 11. Cache a invalidace

## 11.1 KV klíče (hlavní)

Restaurace:
- `restaurants:list`

Návrhy:
- `suggestions:list`

Menu cache:
- `menus:${type}:${date}:u${updatedAt}:b${buster}`

Invalidace:
- `restaurants:updatedAt`
- `menus:cacheBuster`

USDA cache:
- `usda:kcal:${query}`

## 11.2 Kdy se invaliduje menu cache

Automaticky při:
- přidání restaurace
- úpravě restaurace
- změně pořadí
- smazání restaurace

Ručně:
- `ReCache`

## 12. Kategorie restaurací a ikony

## 12.1 Kategorie (interní klíče)

- `ceska`
- `cina`
- `italska`
- `mexicka`
- `burger`
- `kavarna`

## 12.2 Ikony (frontend)

Očekávané soubory:
- `/icons/ceska.png`
- `/icons/cina.png`
- `/icons/italska.png`
- `/icons/mexicka.png`
- `/icons/burger.png`
- `/icons/kavarna.png`

Použití:
- levý seznam restaurací (ikona + název)
- horní typové filtry (ikona + název)

## 13. Bezpečnost / omezení

## 13.1 Admin autentizace

Aktuálně:
- jednoduché heslo přímo v `admin.html` (client-side prompt)

Důsledek:
- není to silné zabezpečení
- vhodné spíše pro interní / low-risk použití

Doporučení (budoucí):
- server-side auth (Vercel Auth / middleware / basic auth / SSO)

## 13.2 Embed omezení

Některé weby nejdou vložit do iframe kvůli:
- `X-Frame-Options`
- CSP (`frame-ancestors`)

Aplikace to částečně řeší:
- varováním
- tlačítkem `Otevřít zdroj`

## 14. Deployment a provoz

## 14.1 Lokální spuštění

Preferovaný způsob:
- `npx vercel dev`

Důvod:
- běží statické stránky i `api/*` endpointy ve stejném prostředí jako na Vercelu

## 14.2 Potřebné env proměnné

- `USDA_KEY` (pro kcal odhady)
- Vercel KV proměnné (pokud používáš KV storage)

## 14.3 Nasazení

1. Commit + push do GitHub
2. Vercel auto deploy (nebo `Redeploy`)
3. Po změnách datových struktur / parserů:
   - otevřít admin
   - kliknout `ReCache`
   - provést smoke test

## 15. Troubleshooting (technické)

## 15.1 `kcal odhad nedostupný` u všech jídel

Ověřit:
- `/api/usda?query=pizza`

Typické příčiny:
- chybí `USDA_KEY`
- neplatný/odmítnutý klíč (403)
- USDA downtime

## 15.2 Restaurace v `parse` vrací prázdné menu

Postup:
1. Ověřit URL v adminu
2. Otevřít zdroj ručně
3. Otestovat `/api/getMenus?type=today`
4. Zkontrolovat, zda:
   - web je dynamický
   - parser neodpovídá struktuře
   - je potřeba special parser
5. Dočasně přepnout restauraci na `embed`

## 15.3 Změny v adminu se neprojeví

Ověřit:
- bylo kliknuto `Uložit změny`
- po změně byl proveden `ReCache`
- byl refresh hlavní stránky (`Ctrl+F5`)

## 15.4 Rozbitá diakritika

Příčina:
- soubor uložený ve špatné znakové sadě

Řešení:
- uložit jako `UTF-8`
- ověřit `<meta charset="UTF-8">`

## 16. Doporučení pro další rozvoj

1. Přesun admin autentizace na backend.
2. Přidání editace názvu/URL v admin UI.
3. Přidání diagnostiky parseru (zobrazení důvodu selhání u konkrétní restaurace).
4. Přidání testovacích fixture HTML pro parsery (`menicka`, `salanda`, další).
5. Automatizované smoke testy (Playwright).
6. Oddělení admin JS z `admin.html` do samostatného souboru.

## 17. Sekvenční diagramy (textový popis)

Níže jsou popsané hlavní scénáře jako sekvenční kroky mezi:
- `Uživatel`
- `Frontend (script.js / admin.html JS)`
- `API (Vercel functions)`
- `KV`
- `Externí web / USDA`

## 17.1 Načtení hlavní stránky

1. `Uživatel` otevře `index.html`.
2. `Frontend` inicializuje runtime stav (`restaurantsList`, `menusCache`, ...).
3. `Frontend` vymaže typový filtr kategorií (`Všechny restaurace` jako default).
4. `Frontend` volá `GET /api/restaurants`.
5. `API /api/restaurants` načte seznam z `KV` (`restaurants:list`), případně fallback `restaurants.json`.
6. `API` vrátí seznam restaurací.
7. `Frontend`:
   - uloží `restaurantsList`
   - spočítá signature seznamu restaurací
   - případně invaliduje localStorage cache menu
   - vykreslí horní typové filtry
   - vykreslí levý seznam restaurací
8. `Frontend` zavolá `GET /api/getMenus?type=today`.
9. `API /api/getMenus`:
   - zkontroluje KV cache podle cache key
   - pokud cache existuje, vrátí ji
   - pokud ne, načte restaurace a sestaví data menu
10. `Frontend` uloží menu do `menusCache`, ale dokud není vybraná restaurace, zobrazí prázdný stav.

## 17.2 Výběr typu restaurace (horní filtry)

1. `Uživatel` klikne na typ (`Čína`, `Česká`, ...).
2. `Frontend` změní cookie `menu03_category_filters`.
3. `Frontend` překreslí:
   - horní typové filtry
   - levý seznam restaurací
   - pravý obsah (pokud aktuálně vybraná restaurace neprojde filtrem, menu se nezobrazí)
4. Pokud menu ještě není načtené, `Frontend` zavolá `/api/getMenus`.

## 17.3 Výběr restaurace (single-select)

1. `Uživatel` klikne na tlačítko restaurace v levém panelu.
2. `Frontend` zapíše výběr do cookie `menu03_filters` (single-select).
3. `Frontend` překreslí levý seznam tlačítek (zeleně označí pouze jednu restauraci).
4. `Frontend` překreslí pravý panel:
   - pokud `menusCache` existuje, vyfiltruje vybranou restauraci a zobrazí její obsah
   - pokud `menusCache` neexistuje, spustí načítání `/api/getMenus`
5. Pokud restaurace obsahuje vyčtené položky, `Frontend`:
   - vykreslí názvy a ceny jídel
   - spustí asynchronní dotazy na kcal odhad

## 17.4 Načtení kcal odhadu pro jídlo

1. `Frontend` po vykreslení jídla zavolá `scheduleKcalEstimate(...)`.
2. `Frontend` znormalizuje název jídla a vygeneruje kandidátní dotazy (CZ -> EN + fallbacky).
3. `Frontend` zavolá `GET /api/usda?query=...`.
4. `API /api/usda`:
   - zkontroluje `USDA_KEY`
   - zkusí KV cache (`usda:kcal:*`)
   - případně zavolá USDA API
   - uloží výsledek do KV cache
5. `Frontend` dopočítá kcal na porci podle heuristiky gramáže.
6. `Frontend` aktualizuje text v UI (`přibl. XXX kcal / porce ...` nebo `kcal odhad nedostupný`).

## 17.5 Načítání menu v `parse` režimu

1. `API /api/getMenus` iteruje restaurace.
2. Pro restauraci s `mode=parse` provede HTTP fetch zdrojové URL.
3. `API` rozhodne parser:
   - `menicka.cz/tisk-profil.php` -> special parser `menicka`
   - `restauracesalanda.cz` -> special parser `salanda`
   - jinak heuristický parser
4. `API` vrátí strukturu `meals[]`.
5. `API` uloží výsledek do KV cache.

## 17.6 Načítání menu v `embed` režimu

1. `API /api/getMenus` pro restauraci s `mode=embed` neparsuje HTML.
2. `API` vrátí restauraci s prázdným `meals[]`, ale s URL.
3. `Frontend` zobrazí blok zdroje:
   - `Otevřít zdroj`
   - případně iframe (pokud není doména blokovaná)

## 17.7 Přidání restaurace v adminu

1. `Uživatel` otevře `Administrace` (popup) a zadá heslo.
2. `Uživatel` vyplní formulář:
   - název
   - URL
   - mode
   - category
3. `Frontend (admin)` volá `POST /api/restaurants`.
4. `API /api/restaurants`:
   - vytvoří `id`
   - normalizuje `mode` a `category`
   - uloží do `KV` (`restaurants:list`)
   - invaliduje cache klíče menu
5. `Frontend (admin)` obnoví seznam restaurací.
6. `Frontend (hlavní stránka)` po refreshi načte nový seznam a po `ReCache`/refreshi zobrazí novou restauraci.

## 17.8 Dávkové uložení změn v adminu (`Uložit změny`)

### Lokální příprava změn

1. `Uživatel` v adminu:
   - přepíná `Parse/Embed`
   - mění typ restaurace
   - přesouvá restaurace šipkami
2. `Frontend (admin)` ukládá změny pouze lokálně:
   - `pendingModeById`
   - `pendingCategoryById`
   - `pendingOrderIds`
3. `Frontend (admin)` aktualizuje počítadlo `Uložit změny (N)`.

### Uložení na server

1. `Uživatel` klikne `Uložit změny`.
2. `Frontend (admin)` postupně volá:
   - `POST /api/restaurants` (`action=update`) pro změny režimu
   - `POST /api/restaurants` (`action=update`) pro změny typu
   - `POST /api/restaurants` (`action=reorder`) pro pořadí
3. `API /api/restaurants` po každé změně:
   - uloží změny do `KV`
   - invaliduje cache klíče menu
4. `Frontend (admin)` po úspěchu:
   - vymaže pending změny
   - obnoví seznam restaurací
   - vynuluje počítadlo

## 17.9 Zrušení neuložených změn v adminu (`Zrušit změny`)

1. `Uživatel` klikne `Zrušit změny`.
2. `Frontend (admin)`:
   - vyčistí `pendingModeById`
   - vyčistí `pendingCategoryById`
   - nastaví `pendingOrderIds = null`
3. `Frontend (admin)` překreslí seznam restaurací podle aktuálního stavu ze serveru (bez uploadu).
4. Počítadlo `Uložit změny (N)` se vrátí na `0`.

## 17.10 ReCache z administrace

1. `Uživatel` klikne `ReCache`.
2. `Frontend (admin)` zavolá `POST /api/recache`.
3. `API /api/recache` nastaví nové cache-buster hodnoty v `KV`.
4. `Frontend (admin)` zobrazí status hlášku.
5. `Uživatel` obnoví hlavní stránku.
6. `Frontend (hlavní stránka)` načte čerstvá data přes nový cache key.
