# Soukromý Telegram bot Tagery

Samostatná služba `tagery-telegram.service`. Původní `telegram-codex-bot.service` se nemění.
Kód je v `tools/telegram`, nainstalovaná kopie v `/opt/tagery-telegram`, soukromý stav v
`/var/lib/tagery-telegram` (0700, soubory 0600). Žádné npm závislosti; Node 22+.

## Relace a oprávnění

Při přípravě byla pomocí `codex exec fork` vytvořena a krátkou odpovědí ověřena samostatná větev
uložené relace Tagery `01a07664-bf8a-7e93-a11d-96a3bdd67094`.
Její ID je uložené v `/var/lib/tagery-telegram/session.json`. Zprávy použijí `resume` této větve.
Při nové instalaci bez uložené větve ji založí první otázka.
Nejde o připojení k živému terminálu. Novější kontext se předává přes sdílený stav níže,
nikoli synchronizací celé historie relací.
Zdrojová relace zůstává zachovaná. Fork je dostupný v nainstalovaném CLI (`codex exec fork --help`);
[oficiální dokumentace resume](https://developers.openai.com/codex/non-interactive-mode/#resume-a-non-interactive-session).

Bot používá existující přihlášení `/root/.codex`, ale ignoruje uživatelskou konfiguraci a pravidla
automatických schválení. Nepřebírá token původního Telegram bota. Výchozí sandbox je **read-only**,
schvalování `never`. Změny projektu, Docker deploye a git push nejsou tímto botem povolené.
Služba běží pod root stejně jako zdejší CLI; sandbox pouze pro čtení není izolace citlivých souborů
proti čtení. Bot není určen pro další uživatele nebo skupiny. Před rozšířením přístupu je nutný
samostatný systémový účet a omezený filesystem. Telegram token se nepředává v prostředí Codexu.

## Dokončení po založení nového bota u BotFather

Na serveru jako root (token neposílat do chatu, příkazové řádky ani historie shellu):

```sh
node /opt/tagery-telegram/configure.mjs
```

Interaktivně vlož **nový** token; zadávání je skryté. Existující token skript nepřepisuje.
Ověř dostupnost přihlášení bez výpisu přihlašovacích údajů:

```sh
CODEX_HOME=/root/.codex /usr/local/bin/codex login status
node /opt/tagery-telegram/configure.mjs --pair
systemctl enable --now tagery-telegram.service
```

V soukromém chatu novému botovi pošli vypsané `/pair KÓD` (platnost 15 minut, nejvýše 10 pokusů).
Kód má 128 bitů náhody. Jeho držitel může spárovat účet: nesdílej jej. Po prvním úspěchu je kód
smazán a přístup je vázán na ID uživatele i soukromého chatu. Skupiny a další účty jsou odmítnuté.
Pokud vyprší před spárováním, zopakuj lokální příkaz `--pair`. Změna vlastníka přes Telegram není možná.

Pošli `/status`, poté například „Shrň stav Tagery, nic neměň“. Větvení a autorizace Codexu jsou
ověřené; bez nového tokenu nebylo možné otestovat skutečnou Telegram komunikaci.

## Provoz

### Sdílení stavu, zadání a potvrzení

- Běžná zpráva: odpověď Telegram větve (pouze čtení), která před každým promptem dostane
  aktuální sdílený souhrn a posledních 20 záznamů. Text promptu a odpovědi je lokálně sdílený.
- `/shared`: aktuální souhrn a poslední záznamy obou stran.
- `/task zadání`: trvale uloží úkol pro pracovní relaci v projektu. Funguje i během odpovědi bota.
- `/tasks`: posledních 15 úkolů, jejich ID, stav a případný výsledek.
- `/reply ID odpověď`: odpověď na konkrétní nezodpovězenou otázku z pracovní relace.
  Například `/reply a1b2c3d4e5f6 ano`. Stejnou otázku nelze přepsat další odpovědí.

Pracovní relace čte stav při zahájení a před předáním práce podle kořenového `AGENTS.md`.
Telegram sám tuto relaci **neprobouzí**. Pokud není aktivní, úkol/odpověď čeká na další běh.
Zadání nepřepíná Telegram větev do režimu změn projektu.

Otázky z pracovní relace bot posílá automaticky spárovanému uživateli v dalším cyklu pollingu
(obvykle do 30 sekund, síťové výpadky mohou dobu prodloužit). Po pádu mezi odesláním a uložením
potvrzení doručení může stejnou otázku poslat znovu; ID zůstává stejné a odpověď je jednorázová.
Potvrzení platí jen pro uvedenou otázku a rozsah. **Nenahrazuje schválení sandboxu, příkazů
mimo sandbox ani nový souhlas s nesouvisejícími akcemi.**

Z kořene projektu:

```sh
node tools/telegram/shared.mjs show
node tools/telegram/shared.mjs publish 'Aktuální stav a ověřené výsledky'
node tools/telegram/shared.mjs ask 'Konkrétní otázka včetně rozsahu rozhodnutí?'
node tools/telegram/shared.mjs claim ID identifikator-relace
node tools/telegram/shared.mjs finish ID identifikator-relace done 'Výsledek a ověření'
```

Soukromý soubor `.handoff/state.json` (0600, adresář 0700) je mimo Git. Neukládej do promptů
tokeny ani hesla. Aktuálně se drží nejvýše 500 záznamů; pak je nutná ruční archivace, nic se
automaticky nemaže. Aktualizace jsou atomické a pod krátkým souborovým zámkem. Převzetí úkolu
je kooperativní rezervace: nebrání jiné aplikaci ručně editovat soubory. Uvízlý zámek nebo
převzatý úkol se po havárii automaticky nepřivlastňuje.

Při aktualizaci instaluj společně `bridge.mjs`, `shared.mjs` a `configure.mjs` do
`/opt/tagery-telegram`, poté restartuj pouze `tagery-telegram.service` mimo běžící úlohu.

### Služba

```sh
systemctl status tagery-telegram.service --no-pager
journalctl -u tagery-telegram.service -n 30 --no-pager
systemctl stop tagery-telegram.service
```

Zpracovává se jedna úloha; během ní zůstává dostupné `/status`, další úkol se odmítne.
Po 10 minutách je proces ukončen. Služba drží procesový zámek; restart ukončí i potomky Codexu.
Nezpracovávají se zprávy starší než 5 minut. Offset se uloží před spuštěním úlohy: pád může úlohu
ztratit, ale nesmí ji automaticky zopakovat. Poslední stav je v `job.json`. Při nedoručení odpovědi
se obsah automaticky neopakuje. Log neobsahuje zprávy, výstup nástrojů ani Telegram URL s tokenem.
Historii větve ukládá standardně Codex. Token se načítá ze souboru; změna vyžaduje restart.
Používá se [Telegram long polling](https://core.telegram.org/bots/api#getupdates), bez příchozího portu.
Bot s existujícím webhookem odmítne nastartovat; webhook se automaticky nemaže.

Lokální testy: `node tools/telegram/bridge.test.mjs` a `node tools/telegram/shared.test.mjs`
(8 testů včetně falešného procesu, timeoutu, párování, fronty, zámků a odpovědí;
v omezeném sandboxu může test podprocesu vyžadovat schválení).
