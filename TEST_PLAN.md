# Test Plan `menu`

## 1. Účel

Tento test plan slouží pro:
- smoke test po deployi,
- regresní test po změnách UI/logiky,
- ověření admin funkcí,
- support ověření, zda je chování aplikace v pořádku.

## 2. Rozsah

Testují se tyto části:
- hlavní stránka (filtry typů, výběr restaurace, zobrazení menu)
- popup okna (`Návrh restaurace`, `Administrace`)
- admin (přidání, úpravy, pořadí, dávkové uložení, zrušení změn, ReCache)
- parsování menu (`Parse`)
- embed režim (`Embed`)
- kalorické odhady (USDA)

## 3. Předpoklady před testem

1. Aplikace je nasazená (Vercel deploy hotový).
2. Pokud se testují kalorie, je nastavené `USDA_KEY`.
3. K dispozici je admin heslo.
4. Ikony kategorií existují v `icons/`:
   - `ceska.png`
   - `cina.png`
   - `italska.png`
   - `mexicka.png`
   - `burger.png`
   - `kavarna.png`

## 4. Testovací typy

## 4.1 Smoke Test (po každém deployi)

1. Otevřít hlavní stránku.
2. Ověřit načtení bez JS chyby / bílé stránky.
3. Ověřit, že je aktivní `Všechny restaurace`.
4. Ověřit, že není vybraná žádná restaurace.
5. Ověřit zobrazení prázdného stavu (`Máš hlad?...`) a pozadí obrázku.
6. Ověřit funkčnost popup tlačítek:
   - `Návrh restaurace`
   - `Administrace`
7. Ověřit, že lze vybrat restauraci a zobrazit její obsah.

## 4.2 Regresní Test (po změně funkcionality)

Spustit při změnách:
- filtrů
- adminu
- parserů
- UI seznamu restaurací
- kcal logiky

Minimální regresní sada:
1. Typové filtry nahoře.
2. Single-select restaurace vlevo.
3. Parse + Embed restaurace.
4. Admin dávkové změny.
5. ReCache.

## 5. Test Cases - Hlavní stránka

## 5.1 Načtení výchozího stavu

### Kroky
1. Otevřít hlavní stránku.
2. Obnovit stránku (`Ctrl+F5`).

### Očekávaný výsledek
- Aktivní je `Všechny restaurace`.
- Žádná restaurace není vybraná.
- Vpravo je úvodní text.
- Pozadí obrázku je viditelné, ale slabé (průhledné).

## 5.2 Typové filtry (multi-select)

### Kroky
1. Kliknout `Česká`.
2. Kliknout `Čína`.
3. Kliknout `Všechny restaurace`.

### Očekávaný výsledek
- Po kroku 1 jsou vidět jen české restaurace.
- Po kroku 2 jsou vidět české + čínské restaurace.
- Po kroku 3 jsou vidět všechny restaurace.

## 5.3 Hover filtrů typů

### Kroky
1. Najet myší na neaktivní typový filtr.
2. Najet myší na aktivní (zelený) typový filtr.

### Očekávaný výsledek
- Barva tlačítka se při hover nemění.
- Aktivní filtr zůstává zelený.
- Neaktivní filtr zůstává šedý.

## 5.4 Výběr restaurace (single-select)

### Kroky
1. Kliknout restauraci A.
2. Kliknout restauraci B.

### Očekávaný výsledek
- Po kroku 1 je zelená jen A.
- Po kroku 2 je zelená jen B.
- A se odznačí.

## 5.5 Ikony v tlačítkách restaurací

### Kroky
1. Ověřit více restaurací různých typů.

### Očekávaný výsledek
- Každá restaurace má ikonku odpovídající kategorii.
- Ikona je vlevo od názvu restaurace.
- Chybějící ikona nerozbije rozložení (maximálně se skryje).

## 5.6 Prázdný výsledek po filtrování

### Kroky
1. Vybrat typ filtru, pro který není žádná restaurace (pokud je dostupné).

### Očekávaný výsledek
- V levém panelu se zobrazí text `Pro zvolený typ nebyla nalezena žádná restaurace.`
- Aplikace nespadne.

## 6. Test Cases - Zobrazení menu

## 6.1 Parse restaurace

### Kroky
1. Vybrat restauraci v režimu `Parse`.

### Očekávaný výsledek
- Zobrazí se seznam jídel a ceny.
- U položek se mohou načíst kcal odhady.

## 6.2 Embed restaurace

### Kroky
1. Vybrat restauraci v režimu `Embed`.

### Očekávaný výsledek
- Zobrazí se `Otevřít zdroj`.
- Případně iframe (pokud zdroj neblokuje vložení).
- Pokud iframe blokuje zdroj, zobrazí se varování a tlačítko pro otevření.

## 6.3 PDF / obrázek menu

### Kroky
1. Vybrat restauraci s PDF nebo obrázkem menu.

### Očekávaný výsledek
- Zobrazí se správné tlačítko (`Otevřít PDF` / `Otevřít obrázek`).
- Náhled se zobrazí nebo je dostupné otevření v popupu.

## 6.4 Popup `Otevřít zdroj`

### Kroky
1. Kliknout `Otevřít zdroj`.

### Očekávaný výsledek
- Otevře se popup okno.
- Pokud popup blokuje prohlížeč, otevře se nový tab.

## 7. Test Cases - Kalorické odhady

## 7.1 Funkční USDA endpoint

### Kroky
1. Otevřít `/api/usda?query=pizza`.

### Očekávaný výsledek
- API vrátí JSON s `kcal` nebo `kcal: null`.
- Nesmí vrátit 403 (pokud je `USDA_KEY` správně).

## 7.2 Odhad kcal v UI

### Kroky
1. Otevřít parse restauraci s více jídly.
2. Počkat na načtení odhadu kcal.

### Očekávaný výsledek
- Nejprve se objeví `odhad kcal…`
- Poté:
  - `přibl. XXX kcal / porce (~YYY g)` nebo
  - `kcal odhad nedostupný`

## 7.3 Odolnost při chybě USDA

### Kroky
1. Simulovat nefunkční `USDA_KEY` / chybu endpointu (volitelné v test prostředí).

### Očekávaný výsledek
- Menu se dál zobrazuje.
- Selhání kcal nerozbije ostatní UI.

## 8. Test Cases - Návrh restaurace (popup)

## 8.1 Otevření popupu

### Kroky
1. Kliknout `Návrh restaurace`.

### Očekávaný výsledek
- Otevře se popup okno `suggest.html`.

## 8.2 Odeslání návrhu

### Kroky
1. Vyplnit validní data.
2. Odeslat návrh.
3. Otevřít admin a zkontrolovat sekci návrhů.

### Očekávaný výsledek
- Návrh se uloží a zobrazí v adminu.

## 9. Test Cases - Administrace

## 9.1 Přihlášení do adminu

### Kroky
1. Otevřít `Administrace`.
2. Zadávat heslo.

### Očekávaný výsledek
- Se správným heslem se admin načte.
- Se špatným heslem dojde k návratu na hlavní stránku.

## 9.2 Přidání restaurace

### Kroky
1. Vyplnit:
   - název
   - URL
   - režim
   - typ restaurace
2. Kliknout `Uložit`.

### Očekávaný výsledek
- Restaurace se přidá do seznamu.
- Má správný typ (pill / dropdown).
- Na hlavní stránce má správnou ikonu.

## 9.3 Změna režimu (`Parse/Embed`)

### Kroky
1. Přepnout režim u restaurace.

### Očekávaný výsledek
- Zobrazí se info o připravené změně.
- Zvýší se počítadlo `Uložit změny (N)`.

## 9.4 Změna typu restaurace

### Kroky
1. Změnit typ v dropdownu u řádku restaurace.

### Očekávaný výsledek
- Zobrazí se info o připravené změně.
- Zvýší se počítadlo `Uložit změny (N)`.

## 9.5 Přesun pořadí (šipky)

### Kroky
1. Kliknout `▲` / `▼` u restaurace.

### Očekávaný výsledek
- Restaurace se vizuálně posune o 1 místo.
- Zvýší se počítadlo `Uložit změny (N)`.
- Horní/poslední prvek má správně disabled šipku.

## 9.6 Zrušit změny

### Kroky
1. Udělat více změn (režim + typ + pořadí).
2. Kliknout `Zrušit změny`.

### Očekávaný výsledek
- Všechny neuložené změny se vrátí.
- Počítadlo se vrátí na `0`.
- Nic se neuloží na server.

## 9.7 Uložit změny (dávkově)

### Kroky
1. Udělat více změn:
   - režim
   - typ
   - pořadí
2. Kliknout `Uložit změny`.

### Očekávaný výsledek
- Změny se uloží.
- Počítadlo klesne na `0`.
- Po reloadu adminu změny zůstávají.

## 9.8 Smazání restaurace

### Kroky
1. Kliknout `Smazat`.
2. Potvrdit.

### Očekávaný výsledek
- Restaurace se odstraní.
- Nezůstane rozbitý seznam ani pořadí.

## 9.9 ReCache

### Kroky
1. Kliknout `ReCache`.
2. Potvrdit.

### Očekávaný výsledek
- Zobrazí se status o proběhlém ReCache.
- Po obnovení hlavní stránky se načtou aktuální data.

## 10. API Test Cases (základ)

## 10.1 `/api/restaurants`

- `GET` vrací pole restaurací
- `POST` add přidá restauraci
- `POST action=update` upraví restauraci
- `POST action=reorder` uloží pořadí
- `DELETE` smaže restauraci

## 10.2 `/api/getMenus`

- `GET ?type=today` vrací dnešní data
- `GET ?type=all` vrací širší data
- odpověď je validní JSON

## 10.3 `/api/usda`

- funkční dotaz vrací `kcal` nebo `null`
- při chybě klíče vrací srozumitelnou chybu

## 11. Kritéria úspěchu release

Release je možné považovat za OK, pokud:
1. Smoke test projde bez kritické chyby.
2. Hlavní stránka funguje (filtry + výběr restaurace + zobrazení menu).
3. Administrace funguje (přidání / úpravy / pořadí / uložení).
4. ReCache funguje.
5. Neobjevují se blokující chyby v konzoli / API.

## 12. Evidence výsledků testu (doporučený formát)

Pro každý build/deploy evidovat:
- datum a čas testu
- verzi/commit
- tester
- výsledek (`PASS` / `FAIL`)
- seznam nalezených chyb
- screenshoty / kroky reprodukce

