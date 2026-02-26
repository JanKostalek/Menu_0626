# Dokumentace aplikace `menu`

## 1. Co je to za aplikaci

Tato aplikace slouží k rychlému zobrazení denních menu restaurací na jednom místě.

Uživatel si:
- vybere typ restaurace (např. česká, čína, italská),
- vybere konkrétní restauraci,
- zobrazí menu (vyčtené položky nebo zdrojový náhled),
- u některých jídel vidí i přibližný odhad kalorické hodnoty.

Aplikace obsahuje také:
- formulář pro návrh nové restaurace,
- administraci pro správu restaurací,
- cache mechanizmy pro rychlejší načítání.

## 2. Hlavní stránka (pro běžného uživatele)

### 2.1 Co uživatel vidí

- Nahoře:
  - filtry podle typu restaurace (`Všechny restaurace`, `Česká`, `Čína`, `Italská`, `Mexická`, `Burger`, `Kavárna`)
  - tlačítka `Návrh restaurace` a `Administrace`
- Vlevo:
  - seznam restaurací (každá má název a ikonu typu)
- Vpravo:
  - obsah menu / náhled zdroje / prázdný stav

### 2.2 Očekávané chování

- Po načtení stránky:
  - je aktivní filtr `Všechny restaurace`
  - není vybraná žádná restaurace
  - vpravo se zobrazí úvodní text (`Máš hlad?...`) a pod ním průhledné pozadí obrázku
- Typové filtry:
  - lze vybrat více typů najednou
  - `Všechny restaurace` zruší výběr typových filtrů
  - při najetí myší se barva filtru nemění
- Výběr restaurace:
  - lze vybrat vždy pouze jednu restauraci
  - klik na jinou restauraci zruší předchozí výběr
- Zobrazení menu:
  - některé restaurace zobrazují vyčtené položky jídel (parse)
  - některé zobrazují zdroj / iframe / PDF / obrázek (embed)
- Kalorie:
  - pokud je dostupný odhad, zobrazí se přibližné kcal na porci
  - pokud odhad nelze získat, zobrazí se `kcal odhad nedostupný`

### 2.3 Co není chyba (je to očekávané)

- U některých restaurací se nezobrazí vyčtené položky, ale pouze tlačítko `Otevřít zdroj`.
- U některých jídel není dostupný odhad kcal.
- Některé weby blokují vložení do iframe (bezpečnostní hlavičky). Pak je nutné použít `Otevřít zdroj`.

## 3. Návrh restaurace

Uživatel může přes tlačítko `Návrh restaurace` otevřít popup okno a odeslat návrh.

### 3.1 Povinné údaje

- název restaurace
- email

### 3.2 Očekávané chování

- okno se otevře jako popup
- po odeslání se návrh uloží do seznamu návrhů v administraci

## 4. Administrace

Administrace slouží ke správě restaurací a návrhů.

### 4.1 Hlavní funkce

- přidání restaurace
- smazání restaurace
- změna režimu (`Parse` / `Embed`)
- změna typu restaurace (`Česká`, `Čína`, ...)
- změna pořadí restaurací (šipky nahoru/dolů)
- dávkové uložení změn (`Uložit změny`)
- zahození neuložených změn (`Zrušit změny`)
- `ReCache` (invalidace cache)

### 4.2 Přidání restaurace

Při přidání se vyplňuje:
- `Název restaurace`
- `URL menu`
- režim:
  - `Parsovat HTML`
  - `Zobrazit zdroj (embed)`
- typ restaurace:
  - `Česká`, `Čína`, `Italská`, `Mexická`, `Burger`, `Kavárna`

### 4.3 Režimy restaurace

- `Parse`
  - backend se pokusí vyčíst jídla a ceny z HTML
- `Embed`
  - frontend zobrazí zdroj (iframe/popup/PDF/obrázek), bez parsování jídel

### 4.4 Uložení změn (dávkové)

Tlačítko `Uložit změny (N)` ukládá najednou:
- změny režimu (`Parse/Embed`)
- změny typu restaurace
- změnu pořadí restaurací

Tlačítko `Zrušit změny`:
- zahodí všechny neuložené změny
- nic neposílá na server

### 4.5 ReCache

`ReCache`:
- vymaže lokální cache v prohlížeči
- invaliduje server cache
- použij po větších změnách (nové restaurace, změna pořadí, změna parseru)

## 5. Support dokumentace (jak poznat, co je v pořádku a co je problém)

### 5.1 Typické dotazy a správná odpověď

#### „Nezobrazuje se mi jídlo, jen tlačítko Otevřít zdroj“

Možné příčiny:
- restaurace je v režimu `Embed` (to je v pořádku)
- web restaurace nejde spolehlivě parsovat (zatím)
- web blokuje iframe (pak je nutné otevřít zdroj)

Kdy je to chyba:
- restaurace má být v `Parse`, dříve fungovala a nyní vrací prázdné menu
- u více restaurací najednou přestane fungovat parsing (může být chyba API / deploy)

#### „Nejde odhad kcal“

Možné příčiny:
- USDA API nedokáže najít vhodný ekvivalent
- chybí/nefunguje `USDA_KEY`
- dočasná chyba externího API

Kdy je to chyba:
- `api/usda?query=pizza` vrací chybu (např. 403/500)

#### „Po změně v adminu se nic neprojevilo“

Očekávaný postup:
1. kliknout `Uložit změny`
2. případně kliknout `ReCache`
3. obnovit hlavní stránku (`Ctrl+F5`)

Kdy je to chyba:
- `Uložit změny` hlásí úspěch, ale ani po `ReCache` se změna neprojeví

### 5.2 Rychlá diagnostika pro support

1. Ověřit, že problém je reprodukovatelný (načíst stránku znovu).
2. Ověřit typ restaurace v adminu (`Parse` vs `Embed`).
3. Ověřit URL restaurace (otevřít zdroj).
4. Kliknout `ReCache`.
5. Otestovat `/api/restaurants` a `/api/getMenus?type=today`.
6. Pokud jde o kcal, otestovat `/api/usda?query=pizza`.

## 6. Testerský checklist (co všechno proklikat)

## 6.1 Smoke test po deployi

1. Otevřít hlavní stránku.
2. Ověřit, že je aktivní `Všechny restaurace`.
3. Ověřit, že není vybraná žádná restaurace.
4. Ověřit úvodní text + pozadí obrázku.
5. Ověřit otevření popup:
   - `Návrh restaurace`
   - `Administrace`

## 6.2 Typové filtry restaurací

1. Kliknout `Česká`:
   - vlevo se zobrazí jen české restaurace
2. Přidat `Čína`:
   - zobrazí se kombinace českých + čínských
3. Kliknout `Všechny restaurace`:
   - zruší se typové filtry
4. Hover na filtrech:
   - barva se nemění

## 6.3 Výběr restaurace

1. Kliknout restauraci A:
   - tlačítko zezelená
   - zobrazí se její obsah
2. Kliknout restauraci B:
   - A se odznačí
   - B se označí
   - zobrazí se obsah B

## 6.4 Zobrazení menu (parse/embed/PDF/obrázek)

Otestovat alespoň jednu restauraci z každého typu zdroje:
- parse HTML
- embed web
- PDF
- obrázek

Kontroly:
- tlačítko `Otevřít zdroj/PDF/obrázek` funguje
- popup se otevře
- obsah se zobrazí správně / očekávaně

## 6.5 Kalorické odhady

1. Otevřít restauraci s vyčteným menu.
2. Ověřit, že se u některých jídel objeví:
   - `odhad kcal…`
   - následně `přibl. XXX kcal / porce (~YYY g)` nebo `kcal odhad nedostupný`
3. Ověřit, že chyba v kcal nerozbije zobrazení menu.

## 6.6 Administrace - přidání restaurace

1. Otevřít `Administrace`.
2. Vyplnit:
   - název
   - URL
   - režim
   - typ restaurace
3. Uložit.
4. Ověřit, že se restaurace objeví v seznamu.
5. Ověřit, že se na hlavní stránce zobrazuje s odpovídající ikonou.

## 6.7 Administrace - dávkové změny

1. Změnit `Parse/Embed` u alespoň 2 restaurací.
2. Změnit typ restaurace u alespoň 2 restaurací.
3. Přesunout restauraci šipkami nahoru/dolů.
4. Ověřit, že `Uložit změny (N)` ukazuje počet změn.
5. Kliknout `Zrušit změny`:
   - vše se vrátí
   - počítadlo se vynuluje
6. Změny provést znovu a kliknout `Uložit změny`:
   - změny se uloží
   - pořadí se projeví na hlavní stránce po refreshi

## 6.8 Administrace - ReCache

1. Kliknout `ReCache`.
2. Ověřit status hlášku.
3. Obnovit hlavní stránku a ověřit, že data se načtou znovu.

## 7. Známé limity

- Parsování menu je závislé na struktuře webu restaurace.
- Některé weby se musí řešit speciálním parserem.
- Kalorie jsou pouze orientační odhad.
- USDA je primárně anglická databáze (CZ názvy se převádějí heuristicky).

## 8. Doporučení pro provoz

- Po větších změnách v administraci používat `ReCache`.
- Po nasazení nové verze udělat smoke test dle checklistu.
- Pokud restaurace přestane fungovat v `Parse`, přepnout dočasně na `Embed` a nahlásit k doplnění parseru.

