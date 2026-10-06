# Zadání pro programovacího agenta: tisk štítků na NIIMBOT B1

## 1. Cíl

Rozšiř existující webovou aplikaci postavenou na Next.js a Reactu o MVP modul, který umožní vytisknout štítek s QR kódem přímo z webové aplikace na Bluetooth tiskárně **NIIMBOT B1**.

Použij knihovnu [`niimbot-web-bluetooth`](https://github.com/iscarelli/niimbot-web-bluetooth). Pro tisk nepoužívej systémový dialog `window.print()`, generování PDF ani aplikaci výrobce NIIMBOT.

První podporovaná konfigurace:

- tiskárna: NIIMBOT B1, nikoliv B1 Pro;
- rozlišení tiskárny: 203 DPI;
- fyzický rozměr štítku: 50 × 30 mm;
- tisková bitmapa: přesně 384 × 240 px;
- obsah: QR kód, název položky a evidenční kód;
- aplikace: Next.js / React;
- komunikace: Web Bluetooth;
- jazyk uživatelského rozhraní: čeština.

## 2. Podporovaná zařízení pro MVP

| Platforma | Prohlížeč | Stav |
| --- | --- | --- |
| Android | Chrome | podporováno |
| Windows | Chrome nebo Edge | podporováno |
| macOS | Chrome nebo Edge | podporováno |
| iPhone / iPad | Bluefy Web BLE Browser | experimentálně podporováno; ověřit na reálném zařízení |
| iPhone / iPad | Safari, Chrome nebo Edge | nepodporováno, protože na iOS neposkytují Web Bluetooth |
| Firefox | libovolná platforma | nepodporováno |

Na iOS neslibuj tisk v Safari. Pokud aplikace zjistí iOS bez dostupného `navigator.bluetooth`, zobraz uživateli krátký návod, že pro MVP musí stránku otevřít v aplikaci [Bluefy](https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055).

## 3. Důležité technické podmínky

- Web musí běžet přes HTTPS nebo na `localhost`.
- Výběr Bluetooth zařízení musí být vyvolán přímou akcí uživatele, například kliknutím na tlačítko „Připojit tiskárnu“.
- Nesnaž se automaticky otevřít Bluetooth dialog při načtení stránky.
- QR kód a text vykresli do canvasu o přesné velikosti 384 × 240 px.
- Výsledný tiskový obraz musí být černobílý a dobře čitelný na termotiskárně.
- QR kód nesmí být rozmazaný, interpolovaný ani oříznutý.
- Zachovej bílou klidovou zónu kolem QR kódu.
- Výchozí hustota tisku: `3`.
- Výchozí rychlost: `1`.
- Výchozí typ štítku: `1`.
- Výchozí počet kopií: `1`.
- Pro více identických kopií použij parametr `copies`; neposílej stejný obraz opakovaně.
- Knihovna používá reverzně analyzovaný protokol a licenci MIT. Integraci drž izolovanou, aby ji bylo možné později vyměnit za oficiální SDK.

## 4. Konfigurace NIIMBOT B1

Vytvoř jednu centrální konfiguraci tiskárny a štítku. Nevkládej stejné hodnoty na více míst.

```ts
export const NIIMBOT_B1_MODEL = {
  name_prefixes: ["B1"],
  task: "b1",
  density: 3,
  label_type: 1,
  speed: 1,
};

export const LABEL_50X30 = {
  widthMm: 50,
  heightMm: 30,
  w_px: 384,
  h_px: 240,
  offset_y_px: 4,
};
```

Názvy vlastností uprav podle skutečného API nainstalované verze knihovny, ale zachovej uvedené hodnoty a jednu centrální konfiguraci.

## 5. Požadovaná architektura

Přizpůsob názvy a umístění konvencím existujícího projektu. Preferovaná struktura je:

```text
src/
  components/
    printing/
      PrintLabelDialog.tsx
      LabelPreview.tsx
      PrinterStatus.tsx
  hooks/
    useNiimbotPrinter.ts
  lib/
    printing/
      niimbot-config.ts
      niimbot-client.ts
      render-label.ts
      browser-support.ts
  types/
    printing.ts
```

Odpovědnosti:

### `niimbot-config.ts`

- jediný zdroj konfigurace modelu B1 a štítku 50 × 30 mm;
- žádná logika UI.

### `niimbot-client.ts`

- načtení a bezpečné volání `niimbot-web-bluetooth` pouze na klientovi;
- připojení a identifikace tiskárny;
- tisk jedné bitmapy;
- tisk více identických kopií;
- převod nízkoúrovňových chyb na interní typ chyby;
- žádné React komponenty.

### `render-label.ts`

- vytvoření canvasu 384 × 240 px;
- vykreslení QR kódu, názvu položky a evidenčního kódu;
- vrácení `Blob`, object URL nebo jiného formátu, který přijímá tisková knihovna;
- deterministický výstup pro stejné vstupy;
- správné uvolnění object URL po dokončení tisku.

### `browser-support.ts`

- kontrola přítomnosti `navigator.bluetooth`;
- rozlišení podporovaného prostředí, iOS bez Web Bluetooth a obecně nepodporovaného prohlížeče;
- tato kontrola je informativní, nikoliv náhradou za zachycení skutečné chyby při připojení.

### `useNiimbotPrinter.ts`

Poskytni minimálně:

```ts
type PrinterState =
  | "unsupported"
  | "idle"
  | "connecting"
  | "connected"
  | "rendering"
  | "printing"
  | "success"
  | "error";
```

A veřejné operace obdobné:

```ts
connect(): Promise<void>
printLabel(data: LabelData, copies?: number): Promise<void>
resetError(): void
```

Hook musí vracet stav, průběh tisku, identifikaci připojené tiskárny a uživatelsky čitelnou chybu.

### `PrintLabelDialog.tsx`

Dialog musí obsahovat:

- náhled štítku;
- stav tiskárny;
- tlačítko „Připojit tiskárnu“;
- počet kopií, minimálně 1 a maximálně 99;
- tlačítko „Vytisknout“;
- průběh tisku;
- možnost opakovat tisk po chybě;
- zákaz dvojitého odeslání během probíhajícího tisku.

## 6. Datový kontrakt štítku

Použij jednoduchý kontrakt nezávislý na konkrétním modelu databáze:

```ts
export type LabelData = {
  qrValue: string;
  itemName: string;
  assetCode: string;
  subtitle?: string;
};
```

Napojení na skutečný objekt položky proveď v rodičovské komponentě nebo adaptéru, nikoliv uvnitř vykreslovací funkce.

## 7. Návrh štítku 384 × 240 px

Výchozí kompozice:

- QR kód vlevo, přibližně 184 až 192 px;
- kolem QR kódu zachovat čistou bílou zónu;
- název položky vpravo, maximálně 2 až 3 řádky;
- evidenční kód výrazně pod názvem;
- nepovinný krátký podtitulek u spodního okraje;
- minimální vnitřní odsazení přibližně 8 px;
- černý obsah na bílém pozadí;
- nepoužívat šedé odstíny, jemné čáry ani příliš tenké písmo.

Při dlouhém názvu:

1. zalom text;
2. omez počet řádků;
3. přidej výpustku;
4. nikdy nezmenšuj QR kód pod bezpečnou čitelnost.

Pro QR použij chybovou korekci `M`, případně `Q`, pokud bude QR obsah krátký. Nevkládej do středu QR logo.

## 8. Uživatelský průchod

1. Uživatel otevře detail položky.
2. Klikne na „Vytisknout štítek“.
3. Aplikace zobrazí dialog a přesný náhled.
4. Uživatel klikne na „Připojit tiskárnu“.
5. Prohlížeč otevře systémový výběr Bluetooth zařízení.
6. Uživatel vybere zařízení začínající `B1`.
7. Aplikace tiskárnu identifikuje.
8. Pokud nejde o B1 s 203 DPI, tisk se zastaví a zobrazí se jasná chyba.
9. Uživatel zvolí počet kopií a klikne na „Vytisknout“.
10. Aplikace zobrazí průběh a výsledek.

Pokud je tiskárna již připojená, krok připojení není nutné opakovat v rámci stejné relace. Nepředpokládej však, že web může tiskárnu automaticky znovu spárovat bez oprávnění prohlížeče.

## 9. Chybové stavy a české zprávy

Minimálně ošetři:

| Stav | Zpráva pro uživatele |
| --- | --- |
| Web Bluetooth není dostupný | „Tento prohlížeč nepodporuje přímý tisk přes Bluetooth.“ |
| iPhone v Safari | „Pro tisk na iPhonu otevřete tuto stránku v aplikaci Bluefy.“ |
| uživatel zrušil výběr zařízení | „Výběr tiskárny byl zrušen.“ |
| připojení selhalo | „K tiskárně se nepodařilo připojit. Zkontrolujte, že je zapnutá a není připojená k jinému zařízení.“ |
| nesprávný model | „Připojená tiskárna není podporovaný model NIIMBOT B1.“ |
| spojení se přerušilo | „Spojení s tiskárnou bylo přerušeno. Připojte ji znovu.“ |
| vykreslení selhalo | „Štítek se nepodařilo připravit.“ |
| tisk selhal | „Tisk se nezdařil. Zkontrolujte tiskárnu a zkuste to znovu.“ |
| tisk dokončen | „Štítek byl odeslán do tiskárny.“ |

Technickou chybu zaloguj pro diagnostiku, ale v UI nezobrazuj uživateli syrový stack trace nebo Bluetooth pakety.

## 10. Next.js požadavky

- Bluetooth a canvas kód spouštěj pouze na klientovi.
- Komponenty používající browser API označ pomocí `"use client"` nebo je dynamicky načti bez SSR podle architektury projektu.
- Během serverového renderování nepřistupuj k `window`, `navigator`, `document` ani `HTMLCanvasElement`.
- Nepřidávej globální závislost na tiskárně do serverové části aplikace.
- Dodrž TypeScript strict mode, pokud jej projekt používá.
- Nenaruš existující autentizaci, tenant logiku, RBAC ani datové modely.
- Tlačítko tisku zobraz pouze uživateli, který již má oprávnění zobrazit danou položku; nové oprávnění přidávej jen tehdy, pokud projekt už používá obdobně jemné permission kontroly.

## 11. Doporučené závislosti

- `niimbot-web-bluetooth` pro komunikaci a tisk;
- `qrcode` pro vytvoření QR matice nebo canvasu;
- existující UI knihovna projektu pro dialog, tlačítka, input a stavové zprávy.

Před přidáním závislosti ověř, zda projekt již neobsahuje knihovnu pro QR kódy. Nevytvářej duplicitní závislost bez důvodu. Zamkni konkrétní verzi tiskové knihovny v lockfile, aby se reverzně analyzovaný protokol nezměnil bez kontroly.

## 12. Testovací stránka

Přidej vývojovou stránku odpovídající konvencím routeru, například `/printer-test`. Stránka musí umožnit:

- zadat libovolnou hodnotu QR;
- zadat název položky;
- zadat evidenční kód;
- zobrazit náhled 384 × 240 px;
- stáhnout nebo otevřít výslednou PNG pouze pro diagnostiku;
- připojit tiskárnu;
- identifikovat model;
- vytisknout jednu kopii;
- vytisknout tři identické kopie;
- zapnout diagnostický režim knihovny pouze ve vývoji.

Testovací stránku nevystavuj běžným produkčním uživatelům. Použij existující vývojový feature flag, admin omezení nebo ji vypni v produkčním buildu.

## 13. Testy

Přidej automatické testy alespoň pro:

- detekci podporovaného a nepodporovaného prohlížeče;
- převod dlouhého názvu na omezený počet řádků;
- validaci počtu kopií 1–99;
- vytvoření bitmapy s rozměrem přesně 384 × 240 px;
- stavový přechod `idle → connecting → connected`;
- stavový přechod při odmítnutí výběru zařízení;
- zákaz souběžného dvojitého tisku;
- odmítnutí B1 Pro nebo jiné tiskárny při konfiguraci určené pro B1.

Bluetooth komunikaci v automatických testech mockuj. Skutečný tisk ověř samostatným manuálním testem.

## 14. Manuální testovací matice

| Test | Android Chrome | Windows Chrome/Edge | macOS Chrome/Edge | iPhone Bluefy |
| --- | --- | --- | --- | --- |
| nabídka zařízení B1 | ověřit | ověřit | ověřit | ověřit |
| správná identifikace B1 | ověřit | ověřit | ověřit | ověřit |
| tisk 1 kopie | ověřit | ověřit | ověřit | ověřit |
| tisk 3 kopií | ověřit | ověřit | ověřit | ověřit |
| čitelnost QR mobilem | ověřit | ověřit | ověřit | ověřit |
| dlouhý název položky | ověřit | ověřit | ověřit | ověřit |
| zrušení Bluetooth dialogu | ověřit | ověřit | ověřit | ověřit |
| vypnutí tiskárny během tisku | ověřit | ověřit | ověřit | ověřit |
| opětovné připojení | ověřit | ověřit | ověřit | ověřit |

Na macOS při prázdném tisku nebo výpadcích paketů nejprve ověř doporučení knihovny pro `PACE_MS`; nezrychluj odesílání bez fyzického testu.

## 15. Akceptační kritéria

Implementace je hotová, pokud:

- lze z detailu položky otevřít náhled štítku;
- náhled i tiskový obraz mají přesně 384 × 240 px;
- QR kód po vytištění spolehlivě otevře správnou adresu nebo hodnotu;
- uživatel může připojit NIIMBOT B1 a aplikace ověří model;
- lze vytisknout 1 až 99 identických kopií;
- aplikace neumožní spustit dva tisky zároveň;
- všechny stavy a chyby jsou srozumitelně popsány česky;
- na iPhonu bez Web Bluetooth se zobrazí návod pro Bluefy;
- aplikace nespadne při SSR ani při nepodporovaném prohlížeči;
- automatické testy projdou;
- lint a TypeScript kontrola projdou;
- proběhne fyzický test na NIIMBOT B1 alespoň na Androidu nebo počítači;
- iPhone/Bluefy je veden jako experimentální, dokud neproběhne fyzický test.

## 16. Postup práce agenta

1. Nejprve prohlédni strukturu projektu, router, UI knihovnu, stávající QR komponenty, testovací framework a způsob práce s oprávněními.
2. Napiš krátký implementační plán a seznam souborů, které změníš.
3. Ověř skutečné exporty a API aktuální verze `niimbot-web-bluetooth`; nekopíruj slepě ukázkový kód.
4. Implementuj izolovanou tiskovou vrstvu.
5. Implementuj canvas renderer a ověř výsledný rozměr.
6. Přidej dialog a napojení na detail položky.
7. Přidej vývojovou testovací stránku.
8. Přidej automatické testy.
9. Spusť lint, typecheck a relevantní testy.
10. Na závěr uveď změněné soubory, příkazy pro ověření, známá omezení a přesný manuální postup pro fyzický test.

Neprováděj rozsáhlý refaktor nesouvisejících částí projektu. Neměň databázové schéma, pokud to není pro tento modul skutečně nutné. Pokud konkrétní API knihovny neodpovídá zadání, zachovej požadované chování a zdokumentuj odchylku.

## 17. Zdroje

- [`niimbot-web-bluetooth` – dokumentace a demo](https://github.com/iscarelli/niimbot-web-bluetooth)
- [Bluefy – Web BLE Browser pro iOS](https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055)
- [MDN – Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)

