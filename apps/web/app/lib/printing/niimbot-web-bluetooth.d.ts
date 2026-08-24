/**
 * Ambientní deklarace pro `niimbot-web-bluetooth@2.4.0` – zero-dependency
 * CommonJS modul BEZ vlastních typů, který se při načtení navěsí jako globální
 * `Niimbot` na `window`/`globalThis` (nemá ESM export). Import ho jen spustí
 * kvůli vedlejšímu efektu; s API pracujeme přes `globalThis.Niimbot`
 * (viz `niimbot-client.ts`).
 *
 * Deklarujeme jen tolik, aby TypeScript nepadal na `implicit any` importu.
 */
declare module 'niimbot-web-bluetooth';
