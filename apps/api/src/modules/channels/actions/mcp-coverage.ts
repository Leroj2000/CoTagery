/**
 * Manifest pokrytí MCP / konverzačních kanálů (EPIC-22).
 *
 * Každé oprávnění z katalogu a každý API controller musí mít výslovné rozhodnutí:
 * - `{ actions: [...] }` – které akce z ActionRegistry ho pokrývají,
 * - `{ excluded: 'důvod' }` – vědomě není v MCP (s krátkým důvodem).
 *
 * Test `mcp-coverage.spec.ts` selže, když přibude oprávnění nebo controller bez
 * záznamu tady, když záznam odkazuje na neexistující akci, nebo když záznam
 * zůstane po smazaném oprávnění/controlleru. Při přidání nového oprávnění nebo
 * endpointu sem doplň rozhodnutí (a případně novou akci do v1.actions.ts).
 */
export type McpDecision = { actions: string[] } | { excluded: string };

const later = (what: string): McpDecision => ({
  excluded: `zatím ne – kandidát na další akce (${what})`,
});
const internal = (why: string): McpDecision => ({ excluded: why });

/** Oprávnění (namespace.resource.action) → rozhodnutí. */
export const MCP_PERMISSION_COVERAGE: Record<string, McpDecision> = {
  // --- pokryté akcemi v1 ---
  'asset.item.view': { actions: ['asset.search', 'asset.get', 'attention.list', 'tire.list'] },
  'asset.item.create': { actions: ['asset.create'] },
  'asset.movement.perform': { actions: ['asset.move'] },
  'asset.issue.manage': { actions: ['issue.report'] },
  'core.location.view': { actions: ['location.search'] },

  // --- majetek: kandidáti na další akce ---
  'asset.item.update': later('úprava položky'),
  'asset.item.assign': later('přidělení osobě'),
  'asset.item.transfer': later('převod mezi místy/firmami'),
  'asset.item.delete': internal('mazání položek jen na webu (nevratné)'),
  'asset.reservation.view': later('výpis rezervací'),
  'asset.reservation.approve': later('schválení rezervace'),
  'asset.scan.use': internal('skenování kódů vyžaduje kameru/čtečku – web a mobil'),
  'asset.selfloan.use': later('vlastní výpůjčka'),
  'asset.handoff.use': internal('předávka s potvrzením druhou stranou – web'),
  'asset.dispatch.bulk': internal('hromadný výdej – web'),
  'asset.inventory.manage': internal('inventury se dělají skenováním na webu/mobilu'),
  'asset.media.manage': internal('fotky a soubory – kanály zatím nepřenášejí přílohy'),
  'asset.category.manage': internal('správa číselníku kategorií – nastavení'),
  'asset.identifier.manage': internal('správa identifikátorů (QR/NFC) – web'),
  'asset.purchase.view': later('nákupní údaje'),
  'asset.purchase.update': internal('nákupní údaje upravuje správce na webu'),
  'carrier.item.manage': internal('výroba a párování nosičů – web'),

  // --- organizace, lidé, místa ---
  'core.location.create': later('založení místa'),
  'core.location.update': internal('úprava míst – nastavení na webu'),
  'core.location.deactivate': internal('deaktivace míst – nastavení na webu'),
  'core.person.view': later('vyhledání osoby'),
  'core.person.manage': internal('správa osob – web (osobní údaje)'),
  'core.person_group.manage': internal('skupiny osob – nastavení'),
  'core.group.manage': internal('skupiny – nastavení'),
  'core.member.view': internal('seznam uživatelů – administrace'),
  'core.member.invite': internal('pozvánky uživatelů – administrace (bezpečnost)'),
  'core.member.update': internal('změny uživatelů – administrace (bezpečnost)'),
  'core.member.deactivate': internal('deaktivace uživatelů – administrace (bezpečnost)'),
  'core.role.view': internal('role a oprávnění – administrace'),
  'core.role.manage': internal('role a oprávnění – administrace (bezpečnost)'),
  'core.scope.manage': internal('rozsahy oprávnění – administrace (bezpečnost)'),
  'core.organization.view': internal('údaje firmy – administrace'),
  'core.organization.configure': internal('nastavení firmy – administrace'),
  'core.module.view': internal('moduly a předplatné – administrace'),
  'core.module.configure': internal('moduly a předplatné – administrace'),
  'core.integration.manage': internal('webhooky a integrace – administrace (tajné klíče)'),
  'core.audit.view': internal('audit log – administrace'),
  'core.audit.export': internal('export auditu – administrace'),
  'core.calendar.view': later('výpis termínů kalendáře'),
  'core.calendar.create': later('nová událost v kalendáři'),
  'core.calendar.update': internal('úprava událostí – web'),
  'core.calendar.delete': internal('mazání událostí – web'),
  'core.calendar.manage': internal('sdílení kalendáře – web (veřejné odkazy)'),

  // --- volitelné moduly ---
  'billing.subscription.manage': internal('předplatné a platby – jen web'),
  'access.point.manage': internal('modul Vstupy – správa stanovišť na webu'),
  'found.report.handle': internal('nálezy – zpracování na webu'),
  'gallery.item.manage': internal('modul Galerie – web'),
  'membership.card.manage': internal('modul Členství – web'),
  'object.item.manage': internal('digitální objekty – web'),
  'product.item.manage': internal('modul Produkty – web'),
  'rental.item.manage': internal('modul Půjčovna – web'),
  'rental.renter.verify': internal('ověření nájemce – web (osobní údaje)'),
  'ticketing.event.manage': internal('modul Vstupenky – web'),
};

/** API controllery (název třídy) → rozhodnutí. */
export const MCP_CONTROLLER_COVERAGE: Record<string, McpDecision> = {
  AssetController: {
    actions: [
      'asset.search',
      'asset.get',
      'asset.create',
      'asset.move',
      'issue.report',
      'attention.list',
    ],
  },
  LocationsController: { actions: ['location.search'] },
  AuthController: { actions: ['org.list'] },

  AssetIoController: internal('import/export souborů – web'),
  CategoriesController: internal('číselník kategorií – nastavení'),
  MaintenanceController: later('servisní termíny (částečně v attention.list)'),
  ManualCallbackController: internal('interní callback z n8n'),
  ManualsController: internal('návody k položkám – web'),
  MediaController: internal('fotky a soubory – kanály zatím bez příloh'),
  PersonalWorkflowsController: internal('předávky a výpůjčky s potvrzením – web/mobil'),
  PurchaseController: internal('nákupní údaje – web'),
  RegistrationController: internal('veřejná registrace položky přes QR – web'),
  ReservationsController: later('rezervace'),
  ScanController: internal('skenování – web/mobil'),
  SpecCallbackController: internal('interní callback z n8n'),
  SpecsController: internal('technické specifikace – web'),
  // GET /assets/:id/tires → tire.list (jen čtení); úpravy a přezutí zůstávají na webu.
  TiresController: { actions: ['tire.list'] },
  AccessPointsController: internal('modul Vstupy – web'),
  AnalyticsController: internal('statistiky – web'),
  DataCarriersController: internal('nosiče QR/NFC – web'),
  GroupsController: internal('skupiny – nastavení'),
  LocationTypesController: internal('typy míst – nastavení'),
  DigitalObjectsController: internal('digitální objekty – web'),
  PeopleController: later('vyhledání osoby'),
  PersonCategoriesController: internal('kategorie osob – nastavení'),
  TenantController: internal('nastavení firmy – administrace'),
  UsersController: internal('správa uživatelů – administrace (bezpečnost)'),
  FabricationController: internal('výroba nosičů – web'),
  LabelTemplatesController: internal('editor štítků – web'),
  NotificationsController: internal('e-mailové notifikace – nastavení'),
  SubscriptionController: internal('předplatné – web'),
  AuditController: internal('audit log – administrace'),
  AuthzController: internal('interní dotazy na oprávnění pro web'),
  ModulesController: internal('moduly – administrace'),
  PolicyController: internal('politiky – administrace (bezpečnost)'),
  RbacController: internal('RBAC – administrace (bezpečnost)'),
  RolesController: internal('role – administrace (bezpečnost)'),
  ActivationController: internal('veřejná aktivace nosiče – web'),
  ResolverController: internal('veřejný resolver QR/NFC'),
  WebhooksController: internal('webhooky – administrace (tajné klíče)'),
  HealthController: internal('technický health check'),
  BillingWebhookController: internal('webhook platební brány'),
  BillingController: internal('předplatné a platby – jen web'),
  CalendarController: later('kalendář'),
  PublicCalendarController: internal('veřejný sdílený kalendář'),
  ChannelsController: internal('správa kanálů samotných – web (propojení, tokeny)'),
  McpController: internal('samotný MCP endpoint (transport akcí)'),
  OAuthPublicController: internal('OAuth pro MCP (autorizace, ne akce)'),
  OAuthConsentController: internal('OAuth souhlas a správa povolení – web'),
  TelegramWebhookController: internal('Telegram webhook (transport akcí)'),
  FoundPublicController: internal('veřejné hlášení nálezu'),
  FoundReportsController: internal('nálezy – web'),
  GalleryController: internal('modul Galerie – web'),
  InventoryController: internal('inventury – web/mobil'),
  PublicRentalController: internal('veřejný katalog půjčovny'),
  RentalListingController: internal('modul Půjčovna – web'),
  RentalOrderController: internal('modul Půjčovna – web'),
  RenterAuthController: internal('přihlášení nájemců – veřejná část'),
  RenterOrderController: internal('objednávky nájemců – veřejná část'),
  MembershipController: internal('modul Členství – web'),
  NetworkPublicController: internal('veřejná síť – web'),
  NetworkController: internal('síť firem – web'),
  PlatformController: internal('superadmin platformy – nikdy přes kanály'),
  ProductsController: internal('modul Produkty – web'),
  RentalController: internal('modul Půjčovna – web'),
  TicketingController: internal('modul Vstupenky – web'),
  WalletController: internal('peněženka – web (platby)'),
};
