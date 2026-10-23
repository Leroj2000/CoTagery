# Tagery – mobilní aplikace (Capacitor)

Nativní obal pro Android a iOS. Aplikace **nenese vlastní build webu** – nativní
WebView načítá živé `https://app.tagery.tech/admin` (`server.url` v
`capacitor.config.json`). Přihlášení, httpOnly cookies, middleware i BFF
(`/api/*`) proto fungují beze změny a každé nasazení webu se v aplikaci projeví
okamžitě, bez vydání nové verze.

- `www/index.html` – lokální úvodní stránka (použije se jen bez `server.url`).
- `www/offline.html` – zobrazí se, když se server nepodaří načíst (`server.errorPath`).
- `appId` `tech.tagery.app`, název `Tagery`, User-Agent má příponu `TageryApp`
  (web tak pozná, že běží v aplikaci).

## Proč ne statický export Next.js

Web používá SSR, middleware (obnova session) a route handlery `/api/*` s
httpOnly cookies. `output: 'export'` by vyžadoval přepsat autentizaci a
všechna data na klientské volání API – velký refaktor bez přínosu pro uživatele.

**Riziko:** Apple (App Store Review Guideline 4.2) odmítá „pouhé obaly webu“.
Před odesláním do App Store je potřeba přidat nativní hodnotu – push notifikace,
Face ID / Touch ID, nativní skener QR, NFC (pluginy Capacitoru).

## Vývoj na Macu

```bash
git clone … && cd tagery
pnpm install
cd apps/mobile
pnpm exec cap sync          # po každé změně capacitor.config.json / pluginů
```

### Android

Potřeba: Android Studio (obsahuje JDK 21 a Android SDK, API 36).

```bash
pnpm exec cap open android   # otevře projekt v Android Studiu → ▶ Run
# nebo s telefonem přes USB (zapnuté ladění USB):
pnpm exec cap run android
```

Debug APK z příkazové řádky: `cd android && ./gradlew assembleDebug` →
`android/app/build/outputs/apk/debug/app-debug.apk`.

### iOS

Potřeba: Xcode (z App Store) a jednou `xcode-select --install`. CocoaPods
není potřeba – projekt používá Swift Package Manager (`ios/App/CapApp-SPM`).

```bash
pnpm exec cap sync ios
pnpm exec cap open ios       # Xcode → vybrat tým (Signing & Capabilities) → ▶ Run
```

Na vlastní iPhone stačí bezplatný Apple ID tým (aplikace platí 7 dní);
TestFlight / App Store vyžaduje Apple Developer Program (99 USD/rok).
