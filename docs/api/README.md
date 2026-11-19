# Tagery API – přehled endpointů

> Generováno z kódu – needitovat ručně. Aktualizace: `cd apps/api && UPDATE_API_DOCS=1 npx jest src/core/api-docs`.
> Strojově čitelná specifikace: [`openapi.json`](./openapi.json) (OpenAPI 3.1, těla z class-validator DTO).

- Základ: `https://app.tagery.tech/api/v1` (výjimky na kořeni: `/r/*`, `/mcp`, `/oauth/*`, `/.well-known/*`).
- Přihlášení: `POST /api/v1/auth/login` `{ email, password }` → `accessToken` (Bearer, 15 min) + `refreshToken` → `POST /api/v1/auth/refresh`.
- Autorizace: sloupec *Oprávnění* = klíč z katalogu rolí (`Nastavení → Role`); *přihlášený* = stačí členství ve firmě.
- Data se vždy vztahují k aktivní firmě z tokenu (Row Level Security).

Celkem 340 endpointů.

## access

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/access-points` | access.point.manage | access | AccessPointsController.list |
| POST | `/api/v1/access-points` | access.point.manage | access | AccessPointsController.create |
| GET | `/api/v1/access-points/{id}` | access.point.manage | access | AccessPointsController.get |
| POST | `/api/v1/access-points/{id}/evaluate` | access.point.manage | access | AccessPointsController.evaluate |
| GET | `/api/v1/access-points/{id}/events` | access.point.manage | access | AccessPointsController.events |

## analytics

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/analytics/overview` | asset.item.view |  | AnalyticsController.overview |
| GET | `/api/v1/analytics/scans` | asset.item.view |  | AnalyticsController.scans |

## asset

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| POST | `/api/v1/asset-registration` | asset.item.create |  | RegistrationController.register |
| GET | `/api/v1/assets` | asset.item.view |  | AssetController.list |
| POST | `/api/v1/assets` | asset.item.create |  | AssetController.create |
| GET | `/api/v1/assets/{id}` | asset.item.view |  | AssetController.get |
| PATCH | `/api/v1/assets/{id}` | asset.item.update |  | AssetController.updateAsset |
| GET | `/api/v1/assets/{id}/contents` | asset.item.view |  | AssetController.contents |
| POST | `/api/v1/assets/{id}/contents` | asset.item.update |  | AssetController.putInto |
| POST | `/api/v1/assets/{id}/documents` | asset.purchase.update | purchase | PurchaseController.upload |
| GET | `/api/v1/assets/{id}/issues` | asset.item.view |  | AssetController.issues |
| POST | `/api/v1/assets/{id}/issues` | asset.issue.manage |  | AssetController.reportIssue |
| GET | `/api/v1/assets/{id}/manuals` | asset.item.view |  | ManualsController.list |
| POST | `/api/v1/assets/{id}/manuals` | asset.media.manage |  | ManualsController.upload |
| POST | `/api/v1/assets/{id}/manuals/fetch-ai` | asset.media.manage | ai | ManualsController.fetchAi |
| GET | `/api/v1/assets/{id}/media` | asset.item.view |  | MediaController.list |
| POST | `/api/v1/assets/{id}/media` | asset.media.manage |  | MediaController.upload |
| GET | `/api/v1/assets/{id}/movements` | asset.item.view |  | AssetController.movements |
| POST | `/api/v1/assets/{id}/movements` | asset.movement.perform |  | AssetController.perform |
| GET | `/api/v1/assets/{id}/observations` | asset.item.view |  | AssetController.observations |
| POST | `/api/v1/assets/{id}/observations/{observationId}/address` | asset.item.view |  | AssetController.resolveObservationAddress |
| GET | `/api/v1/assets/{id}/photo` | asset.item.view |  | AssetController.photo |
| GET | `/api/v1/assets/{id}/photos` | asset.item.view |  | AssetController.photos |
| POST | `/api/v1/assets/{id}/photos` | asset.media.manage |  | AssetController.addPhotos |
| DELETE | `/api/v1/assets/{id}/photos/{photoId}` | asset.media.manage |  | AssetController.deletePhoto |
| GET | `/api/v1/assets/{id}/photos/{photoId}/file` | asset.item.view |  | AssetController.photoFile |
| POST | `/api/v1/assets/{id}/photos/{photoId}/main` | asset.media.manage |  | AssetController.setMainPhoto |
| PATCH | `/api/v1/assets/{id}/photos/{photoId}/preview` | asset.media.manage |  | AssetController.setPhotoPreview |
| GET | `/api/v1/assets/{id}/purchase` | asset.purchase.view | purchase | PurchaseController.purchase |
| PUT | `/api/v1/assets/{id}/purchase` | asset.purchase.update | purchase | PurchaseController.upsert |
| POST | `/api/v1/assets/{id}/return` | asset.movement.perform |  | MediaController.returnWithPhotos |
| GET | `/api/v1/assets/{id}/services` | asset.item.view |  | AssetController.services |
| POST | `/api/v1/assets/{id}/services` | asset.item.update |  | AssetController.addService |
| GET | `/api/v1/assets/{id}/specs` | asset.item.view |  | SpecsController.get |
| POST | `/api/v1/assets/{id}/specs/fetch-ai` | asset.media.manage | ai | SpecsController.fetchAi |
| GET | `/api/v1/assets/{id}/tire-booking` | asset.tireslot.book | vehicles | TireSlotsController.assetBooking |
| GET | `/api/v1/assets/{id}/tires` | asset.item.view |  | TiresController.list |
| POST | `/api/v1/assets/{id}/tires` | asset.item.update |  | TiresController.create |
| PATCH | `/api/v1/assets/{id}/tires/{tireId}` | asset.item.update |  | TiresController.update |
| DELETE | `/api/v1/assets/{id}/tires/{tireId}` | asset.item.update |  | TiresController.remove |
| POST | `/api/v1/assets/{id}/tires/mount` | asset.item.update |  | TiresController.mount |
| GET | `/api/v1/assets/{id}/warranties` | asset.item.view | purchase | PurchaseController.warranties |
| POST | `/api/v1/assets/{id}/warranties` | asset.purchase.update | purchase | PurchaseController.createWarranty |
| GET | `/api/v1/assets/attention` | asset.item.view |  | AssetController.attention |
| DELETE | `/api/v1/assets/contents/{childId}` | asset.item.update |  | AssetController.removeFromContainer |
| GET | `/api/v1/assets/export` | asset.item.view | import_export | AssetIoController.export |
| POST | `/api/v1/assets/import` | asset.item.create | import_export | AssetIoController.import |
| GET | `/api/v1/assets/import-template` | asset.item.create | import_export | AssetIoController.template |
| POST | `/api/v1/assets/issues/{issueId}/resolve` | asset.issue.manage |  | AssetController.resolveIssue |
| GET | `/api/v1/assets/mine` | asset.scan.use |  | AssetController.mine |
| POST | `/api/v1/assets/movements/{movementId}/confirm` | asset.movement.perform |  | AssetController.confirmMovement |
| POST | `/api/v1/assets/movements/bulk` | asset.dispatch.bulk |  | AssetController.bulk |
| GET | `/api/v1/assets/movements/pending` | asset.item.view |  | AssetController.pendingConfirmations |
| GET | `/api/v1/assets/rules` | asset.item.view |  | AssetController.rules |
| GET | `/api/v1/assets/search` | asset.item.view |  | AssetController.search |
| GET | `/api/v1/assets/services/due` | asset.item.view |  | AssetController.dueServices |
| POST | `/api/v1/assets/workflow/validate` | asset.movement.perform |  | AssetController.validateWorkflow |
| GET | `/api/v1/categories` | asset.item.view |  | CategoriesController.list |
| POST | `/api/v1/categories` | asset.category.manage |  | CategoriesController.create |
| PATCH | `/api/v1/categories/{id}` | asset.category.manage |  | CategoriesController.rename |
| DELETE | `/api/v1/categories/{id}` | asset.category.manage |  | CategoriesController.remove |
| DELETE | `/api/v1/documents/{documentId}` | asset.purchase.update | purchase | PurchaseController.hide |
| GET | `/api/v1/documents/{documentId}/file` | asset.item.view | purchase | PurchaseController.file |
| GET | `/api/v1/maintenance/assets/{assetId}` | asset.item.view | vehicles | MaintenanceController.summary |
| POST | `/api/v1/maintenance/assets/{assetId}/readings` | asset.item.update | vehicles | MaintenanceController.addReading |
| DELETE | `/api/v1/maintenance/assets/{assetId}/readings/{readingId}` | asset.item.update | vehicles | MaintenanceController.deleteReading |
| PATCH | `/api/v1/maintenance/assets/{assetId}/rules/{code}` | asset.item.update | vehicles | MaintenanceController.updateRule |
| POST | `/api/v1/maintenance/assets/{assetId}/services` | asset.item.update | vehicles | MaintenanceController.complete |
| GET | `/api/v1/maintenance/due` | asset.item.view | vehicles | MaintenanceController.due |
| DELETE | `/api/v1/manuals/{manualId}` | asset.media.manage |  | ManualsController.remove |
| GET | `/api/v1/manuals/{manualId}/file` | asset.item.view |  | ManualsController.file |
| POST | `/api/v1/manuals/webhook/callback` | veřejné / vlastní |  | ManualCallbackController.handle |
| DELETE | `/api/v1/media/{mediaId}` | asset.media.manage |  | MediaController.hide |
| GET | `/api/v1/media/{mediaId}/file` | asset.item.view |  | MediaController.file |
| POST | `/api/v1/personal-workflows/handoffs` | asset.handoff.use |  | PersonalWorkflowsController.prepare |
| POST | `/api/v1/personal-workflows/handoffs/{id}/cancel` | asset.handoff.use |  | PersonalWorkflowsController.cancel |
| POST | `/api/v1/personal-workflows/handoffs/{id}/confirm` | asset.handoff.use |  | PersonalWorkflowsController.confirm |
| GET | `/api/v1/personal-workflows/loans` | asset.reservation.approve |  | PersonalWorkflowsController.loanApprovals |
| POST | `/api/v1/personal-workflows/loans` | asset.selfloan.use |  | PersonalWorkflowsController.loan |
| POST | `/api/v1/personal-workflows/loans/{id}/decide` | asset.reservation.approve |  | PersonalWorkflowsController.decide |
| GET | `/api/v1/personal-workflows/me` | asset.handoff.use |  | PersonalWorkflowsController.me |
| GET | `/api/v1/reports/utilization` | asset.item.view |  | UtilizationController.report |
| GET | `/api/v1/reservations` | asset.reservation.view |  | ReservationsController.list |
| POST | `/api/v1/reservations` | asset.reservation.view |  | ReservationsController.create |
| POST | `/api/v1/reservations/{id}/approve` | asset.reservation.approve |  | ReservationsController.approve |
| POST | `/api/v1/reservations/{id}/cancel` | asset.reservation.view |  | ReservationsController.cancel |
| POST | `/api/v1/reservations/{id}/reject` | asset.reservation.approve |  | ReservationsController.reject |
| POST | `/api/v1/scan` | asset.scan.use |  | ScanController.capture |
| GET | `/api/v1/scan` | asset.scan.use |  | ScanController.lookup |
| POST | `/api/v1/specs/webhook/callback` | veřejné / vlastní |  | SpecCallbackController.handle |
| POST | `/api/v1/tire-bookings/{id}/cancel` | asset.tireslot.book | vehicles | TireSlotsController.cancel |
| POST | `/api/v1/tire-bookings/{id}/complete` | asset.tireslot.manage | vehicles | TireSlotsController.complete |
| POST | `/api/v1/tire-bookings/{id}/move` | asset.tireslot.book | vehicles | TireSlotsController.move |
| GET | `/api/v1/tire-slots` | asset.tireslot.book | vehicles | TireSlotsController.list |
| POST | `/api/v1/tire-slots` | asset.tireslot.manage | vehicles | TireSlotsController.create |
| DELETE | `/api/v1/tire-slots/{id}` | asset.tireslot.manage | vehicles | TireSlotsController.cancelSlot |
| POST | `/api/v1/tire-slots/{id}/book` | asset.tireslot.book | vehicles | TireSlotsController.book |
| GET | `/api/v1/tire-slots/mine` | asset.tireslot.book | vehicles | TireSlotsController.mine |
| PUT | `/api/v1/warranties/{warrantyId}` | asset.purchase.update | purchase | PurchaseController.updateWarranty |
| DELETE | `/api/v1/warranties/{warrantyId}` | asset.purchase.update | purchase | PurchaseController.deleteWarranty |
| GET | `/api/v1/warranties/expiring` | asset.item.view | purchase | PurchaseController.expiring |
| GET | `/api/v1/warranties/paid-repairs` | asset.item.view | purchase | PurchaseController.paidRepairs |

## auth

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| POST | `/api/v1/auth/accept-invite` | veřejné / vlastní |  | AuthController.acceptInvite |
| POST | `/api/v1/auth/login` | veřejné / vlastní |  | AuthController.login |
| POST | `/api/v1/auth/logout` | veřejné / vlastní |  | AuthController.logout |
| GET | `/api/v1/auth/me` | veřejné / vlastní |  | AuthController.me |
| GET | `/api/v1/auth/memberships` | veřejné / vlastní |  | AuthController.memberships |
| POST | `/api/v1/auth/password-reset/confirm` | veřejné / vlastní |  | AuthController.confirmReset |
| POST | `/api/v1/auth/password-reset/request` | veřejné / vlastní |  | AuthController.requestReset |
| POST | `/api/v1/auth/refresh` | veřejné / vlastní |  | AuthController.refresh |
| POST | `/api/v1/auth/register` | veřejné / vlastní |  | AuthController.register |
| POST | `/api/v1/auth/switch-org` | veřejné / vlastní |  | AuthController.switchOrg |
| POST | `/api/v1/auth/verify-email` | veřejné / vlastní |  | AuthController.verifyEmail |

## billing

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| POST | `/api/v1/billing/checkout` | billing.subscription.manage | billing | BillingController.checkout |
| GET | `/api/v1/billing/subscriptions` | billing.subscription.manage | billing | BillingController.listSubscriptions |
| GET | `/api/v1/billing/subscriptions/{id}` | billing.subscription.manage | billing | BillingController.getSubscription |
| POST | `/api/v1/billing/subscriptions/{id}/cancel` | billing.subscription.manage | billing | BillingController.cancel |
| GET | `/api/v1/billing/subscriptions/{id}/invoices` | billing.subscription.manage | billing | BillingController.invoices |
| GET | `/api/v1/billing/subscriptions/{id}/portal` | billing.subscription.manage | billing | BillingController.portal |
| GET | `/api/v1/billing/usage` | billing.subscription.manage | billing | BillingController.usage |
| POST | `/api/v1/billing/webhook` | veřejné / vlastní |  | BillingWebhookController.handle |

## calendar

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/calendar` | core.calendar.view |  | CalendarController.list |
| GET | `/api/v1/calendar/events` | core.calendar.view |  | CalendarController.events |
| POST | `/api/v1/calendar/events` | core.calendar.create |  | CalendarController.createEvent |
| PATCH | `/api/v1/calendar/events/{id}` | core.calendar.update |  | CalendarController.updateEvent |
| DELETE | `/api/v1/calendar/events/{id}` | core.calendar.delete |  | CalendarController.deleteEvent |
| GET | `/api/v1/calendar/shares` | core.calendar.manage |  | CalendarController.shares |
| POST | `/api/v1/calendar/shares` | core.calendar.manage |  | CalendarController.createShare |
| POST | `/api/v1/calendar/shares/{id}/revoke` | core.calendar.manage |  | CalendarController.revokeShare |
| GET | `/api/v1/public/calendar/{token}` | veřejné / vlastní |  | PublicCalendarController.view |
| GET | `/api/v1/public/calendar/{token}/ics` | veřejné / vlastní |  | PublicCalendarController.ics |

## carriers

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/carriers/{id}` | asset.item.view |  | DataCarriersController.get |
| POST | `/api/v1/carriers/{id}/nfc/pair` | carrier.item.manage |  | DataCarriersController.pairNfc |
| GET | `/api/v1/carriers/{id}/qr` | asset.item.view |  | DataCarriersController.qrImage |
| GET | `/api/v1/carriers/assigned-object-ids` | asset.item.view |  | DataCarriersController.assignedObjectIds |
| POST | `/api/v1/carriers/batch` | carrier.item.manage |  | DataCarriersController.generateBatch |
| POST | `/api/v1/carriers/claim` | carrier.item.manage |  | DataCarriersController.claim |
| GET | `/api/v1/carriers/unassigned` | asset.item.view |  | DataCarriersController.listUnassigned |

## channels

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/channels/identities` | přihlášený |  | ChannelsController.identitiesList |
| DELETE | `/api/v1/channels/identities/{id}` | přihlášený |  | ChannelsController.revoke |
| POST | `/api/v1/channels/mcp-tokens` | přihlášený |  | ChannelsController.createMcpToken |
| GET | `/api/v1/channels/mcp-tokens` | přihlášený |  | ChannelsController.listMcpTokens |
| DELETE | `/api/v1/channels/mcp-tokens/{id}` | přihlášený |  | ChannelsController.revokeMcpToken |
| POST | `/api/v1/channels/telegram/link-code` | přihlášený |  | ChannelsController.telegramLinkCode |

## fabrication

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/carriers/{id}/fabrication` | carrier.item.manage |  | FabricationController.label |
| GET | `/api/v1/label-templates` | asset.item.view |  | LabelTemplatesController.list |
| PUT | `/api/v1/label-templates/{formatKey}` | core.organization.configure |  | LabelTemplatesController.save |
| DELETE | `/api/v1/label-templates/{formatKey}` | core.organization.configure |  | LabelTemplatesController.reset |
| PUT | `/api/v1/label-templates/default-format` | core.organization.configure |  | LabelTemplatesController.setDefault |

## found

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/found-reports` | found.report.handle |  | FoundReportsController.list |
| POST | `/api/v1/found-reports/{id}/handle` | found.report.handle |  | FoundReportsController.handle |
| POST | `/r/{code}/found` | veřejné / vlastní |  | FoundPublicController.report |

## gallery

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| POST | `/api/v1/galleries` | gallery.item.manage | gallery | GalleryController.create |
| GET | `/api/v1/galleries/{id}` | gallery.item.manage | gallery | GalleryController.get |
| GET | `/api/v1/galleries/{id}/uploads` | gallery.item.manage | gallery | GalleryController.listUploads |
| POST | `/api/v1/galleries/{id}/uploads` | gallery.item.manage | gallery | GalleryController.upload |

## groups

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/groups` | přihlášený |  | GroupsController.list |
| POST | `/api/v1/groups` | přihlášený |  | GroupsController.create |
| DELETE | `/api/v1/groups/{id}` | přihlášený |  | GroupsController.remove |
| GET | `/api/v1/groups/{id}/members` | přihlášený |  | GroupsController.listMembers |
| POST | `/api/v1/groups/{id}/members` | přihlášený |  | GroupsController.addMember |
| DELETE | `/api/v1/groups/{id}/members/{memberRef}` | přihlášený |  | GroupsController.removeMember |

## health

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/health` | veřejné / vlastní |  | HealthController.check |

## inventory

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/inventory` | asset.inventory.manage | inventory | InventoryController.list |
| POST | `/api/v1/inventory` | asset.inventory.manage | inventory | InventoryController.start |
| GET | `/api/v1/inventory/{id}` | asset.inventory.manage | inventory | InventoryController.detail |
| POST | `/api/v1/inventory/{id}/close` | asset.inventory.manage | inventory | InventoryController.close |
| GET | `/api/v1/inventory/{id}/export` | asset.inventory.manage | import_export | InventoryController.export |
| POST | `/api/v1/inventory/{id}/reconcile` | asset.inventory.manage | inventory | InventoryController.reconcile |
| POST | `/api/v1/inventory/{id}/scan` | asset.inventory.manage | inventory | InventoryController.scan |
| POST | `/api/v1/inventory/{id}/vehicles/{assetId}` | asset.inventory.manage | vehicles | InventoryController.recordVehicle |
| POST | `/api/v1/inventory/vehicles` | asset.inventory.manage | vehicles | InventoryController.startVehicles |

## locations

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/location-types` | core.location.view |  | LocationTypesController.list |
| POST | `/api/v1/location-types` | core.location.update |  | LocationTypesController.create |
| PATCH | `/api/v1/location-types/{key}` | core.location.update |  | LocationTypesController.update |
| DELETE | `/api/v1/location-types/{key}` | core.location.update |  | LocationTypesController.remove |
| GET | `/api/v1/locations` | core.location.view |  | LocationsController.list |
| POST | `/api/v1/locations` | core.location.create |  | LocationsController.create |
| GET | `/api/v1/locations/{id}` | core.location.view |  | LocationsController.get |
| PATCH | `/api/v1/locations/{id}` | core.location.create |  | LocationsController.update |
| GET | `/api/v1/locations/{id}/assets` | core.location.view |  | LocationsController.cellAssets |
| GET | `/api/v1/locations/{id}/grid` | core.location.view |  | LocationsController.grid |
| POST | `/api/v1/locations/{id}/grid` | core.location.create |  | LocationsController.generateGrid |

## marketplace

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/public/rental/{tenantSlug}` | veřejné / vlastní |  | PublicRentalController.catalog |
| GET | `/api/v1/public/rental/{tenantSlug}/detail/{listingSlug}` | veřejné / vlastní |  | PublicRentalController.detail |
| GET | `/api/v1/public/rental/listings/{listingId}/availability` | veřejné / vlastní |  | PublicRentalController.availability |
| GET | `/api/v1/public/rental/listings/{listingId}/photos/{idx}` | veřejné / vlastní |  | PublicRentalController.photo |
| POST | `/api/v1/public/rental/quote` | veřejné / vlastní |  | PublicRentalController.quote |
| GET | `/api/v1/rental-listings` | rental.item.manage | rental | RentalListingController.list |
| POST | `/api/v1/rental-listings` | rental.item.manage | rental | RentalListingController.create |
| GET | `/api/v1/rental-listings/{id}` | rental.item.manage | rental | RentalListingController.get |
| PATCH | `/api/v1/rental-listings/{id}` | rental.item.manage | rental | RentalListingController.update |
| DELETE | `/api/v1/rental-listings/{id}` | rental.item.manage | rental | RentalListingController.remove |
| POST | `/api/v1/rental-listings/{id}/publish` | rental.item.manage | rental | RentalListingController.publish |
| POST | `/api/v1/rental-listings/{id}/unpublish` | rental.item.manage | rental | RentalListingController.unpublish |
| GET | `/api/v1/rental-orders` | rental.item.manage | rental | RentalOrderController.list |
| POST | `/api/v1/rental-orders/{id}/transition` | rental.item.manage | rental | RentalOrderController.transition |
| POST | `/api/v1/renter/auth/login` | veřejné / vlastní |  | RenterAuthController.login |
| GET | `/api/v1/renter/auth/me` | veřejné / vlastní |  | RenterAuthController.me |
| POST | `/api/v1/renter/auth/register` | veřejné / vlastní |  | RenterAuthController.register |
| GET | `/api/v1/renter/orders` | veřejné / vlastní |  | RenterOrderController.myOrders |
| POST | `/api/v1/renter/orders` | veřejné / vlastní |  | RenterOrderController.create |
| POST | `/api/v1/renter/orders/{id}/issue` | veřejné / vlastní |  | RenterOrderController.reportIssue |
| GET | `/api/v1/renter/orders/{id}/payment` | veřejné / vlastní |  | RenterOrderController.payment |
| GET | `/api/v1/renter/orders/{id}/payment/qr.png` | veřejné / vlastní |  | RenterOrderController.paymentQr |

## mcp

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| POST | `/mcp` | veřejné / vlastní |  | McpController.post |
| GET | `/mcp` | veřejné / vlastní |  | McpController.get |

## membership

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/memberships` | membership.card.manage | membership | MembershipController.listMemberships |
| POST | `/api/v1/memberships` | membership.card.manage | membership | MembershipController.issue |
| GET | `/api/v1/memberships/{membershipId}` | membership.card.manage | membership | MembershipController.get |
| POST | `/api/v1/memberships/{membershipId}/cards` | membership.card.manage | membership | MembershipController.issueCard |
| POST | `/api/v1/memberships/{membershipId}/resume` | membership.card.manage | membership | MembershipController.resume |
| POST | `/api/v1/memberships/{membershipId}/suspend` | membership.card.manage | membership | MembershipController.suspend |
| GET | `/api/v1/memberships/cards/by-carrier/{carrierId}` | membership.card.manage | membership | MembershipController.cardView |
| GET | `/api/v1/memberships/members` | membership.card.manage | membership | MembershipController.listMembers |
| POST | `/api/v1/memberships/members` | membership.card.manage | membership | MembershipController.createMember |
| POST | `/api/v1/memberships/tiers` | membership.card.manage | membership | MembershipController.createTier |
| GET | `/api/v1/memberships/tiers` | membership.card.manage | membership | MembershipController.listTiers |
| POST | `/api/v1/memberships/tiers/{tierId}/benefits` | membership.card.manage | membership | MembershipController.addBenefit |
| GET | `/api/v1/memberships/tiers/{tierId}/benefits` | membership.card.manage | membership | MembershipController.listBenefits |

## network

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/network/discover` | veřejné / vlastní |  | NetworkPublicController.discover |
| GET | `/api/v1/network/feed` | veřejné / vlastní |  | NetworkController.feed |
| GET | `/api/v1/network/follows` | veřejné / vlastní |  | NetworkController.follows |
| POST | `/api/v1/network/follows/{tenantId}` | veřejné / vlastní |  | NetworkController.follow |
| DELETE | `/api/v1/network/follows/{tenantId}` | veřejné / vlastní |  | NetworkController.unfollow |
| GET | `/api/v1/network/tenants/{slug}` | veřejné / vlastní |  | NetworkPublicController.tenantProfile |

## notifications

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/notifications` | přihlášený |  | NotificationsController.overview |
| PUT | `/api/v1/notifications/{key}` | přihlášený |  | NotificationsController.update |
| POST | `/api/v1/notifications/{key}/preview` | přihlášený |  | NotificationsController.preview |
| POST | `/api/v1/notifications/{key}/test` | přihlášený |  | NotificationsController.test |
| GET | `/api/v1/notifications/access` | přihlášený |  | NotificationsController.access |
| PUT | `/api/v1/notifications/manager-access` | přihlášený |  | NotificationsController.managerAccess |

## oauth

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/.well-known/oauth-authorization-server` | veřejné / vlastní |  | OAuthPublicController.authorizationServer |
| GET | `/.well-known/oauth-protected-resource` | veřejné / vlastní |  | OAuthPublicController.protectedResource |
| GET | `/.well-known/oauth-protected-resource/mcp` | veřejné / vlastní |  | OAuthPublicController.protectedResourceMcp |
| GET | `/api/v1/channels/oauth-grants` | přihlášený |  | OAuthConsentController.grants |
| DELETE | `/api/v1/channels/oauth-grants/{id}` | přihlášený |  | OAuthConsentController.revokeGrant |
| GET | `/api/v1/oauth/authorize/check` | přihlášený |  | OAuthConsentController.check |
| POST | `/api/v1/oauth/authorize/decision` | přihlášený |  | OAuthConsentController.decision |
| POST | `/oauth/register` | veřejné / vlastní |  | OAuthPublicController.register |
| POST | `/oauth/revoke` | veřejné / vlastní |  | OAuthPublicController.revoke |
| POST | `/oauth/token` | veřejné / vlastní |  | OAuthPublicController.token |

## objects

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/objects` | asset.item.view |  | DigitalObjectsController.list |
| POST | `/api/v1/objects` | object.item.manage |  | DigitalObjectsController.create |
| GET | `/api/v1/objects/{id}` | asset.item.view |  | DigitalObjectsController.get |
| PATCH | `/api/v1/objects/{id}` | object.item.manage |  | DigitalObjectsController.update |
| DELETE | `/api/v1/objects/{id}` | object.item.manage |  | DigitalObjectsController.archive |
| GET | `/api/v1/objects/{id}/carriers` | asset.item.view |  | DigitalObjectsController.listCarriers |
| POST | `/api/v1/objects/{id}/carriers` | carrier.item.manage |  | DigitalObjectsController.addCarrier |
| POST | `/api/v1/objects/{id}/carriers/adopt` | carrier.item.manage |  | DigitalObjectsController.adoptCarrier |

## people

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/people` | core.person.view |  | PeopleController.list |
| POST | `/api/v1/people` | core.person.manage |  | PeopleController.create |
| PATCH | `/api/v1/people/{id}` | core.person.manage |  | PeopleController.update |
| PATCH | `/api/v1/people/{id}/categories` | core.person.manage |  | PeopleController.setCategories |
| POST | `/api/v1/people/{id}/photo` | core.person.manage |  | PeopleController.setPhoto |
| GET | `/api/v1/people/{id}/photo` | core.person.view |  | PeopleController.photo |
| DELETE | `/api/v1/people/{id}/photo` | core.person.manage |  | PeopleController.deletePhoto |
| GET | `/api/v1/person-categories` | core.person.view |  | PersonCategoriesController.list |
| POST | `/api/v1/person-categories` | core.person.manage |  | PersonCategoriesController.create |
| DELETE | `/api/v1/person-categories/{id}` | core.person.manage |  | PersonCategoriesController.remove |

## plans

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/subscription` | core.organization.view |  | SubscriptionController.view |
| GET | `/api/v1/subscription/invoices/{id}/pdf` | core.organization.configure |  | SubscriptionController.invoicePdf |
| GET | `/api/v1/subscription/status` | přihlášený |  | SubscriptionController.status |

## platform

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| POST | `/api/v1/platform/invoices/{id}/cancel` | veřejné / vlastní |  | PlatformController.cancelInvoice |
| POST | `/api/v1/platform/invoices/{id}/paid` | veřejné / vlastní |  | PlatformController.markPaid |
| GET | `/api/v1/platform/invoices/{id}/pdf` | veřejné / vlastní |  | PlatformController.invoicePdf |
| GET | `/api/v1/platform/notifications` | veřejné / vlastní |  | PlatformController.platformNotifications |
| PUT | `/api/v1/platform/notifications/{key}` | veřejné / vlastní |  | PlatformController.updatePlatformNotification |
| POST | `/api/v1/platform/notifications/{key}/preview` | veřejné / vlastní |  | PlatformController.previewPlatformNotification |
| POST | `/api/v1/platform/notifications/{key}/test` | veřejné / vlastní |  | PlatformController.testPlatformNotification |
| GET | `/api/v1/platform/plans` | veřejné / vlastní |  | PlatformController.plans |
| PUT | `/api/v1/platform/plans/{key}` | veřejné / vlastní |  | PlatformController.updatePlan |
| GET | `/api/v1/platform/settings` | veřejné / vlastní |  | PlatformController.settings |
| PUT | `/api/v1/platform/settings` | veřejné / vlastní |  | PlatformController.updateSettings |
| GET | `/api/v1/platform/tenants` | veřejné / vlastní |  | PlatformController.listTenants |
| POST | `/api/v1/platform/tenants` | veřejné / vlastní |  | PlatformController.createTenant |
| GET | `/api/v1/platform/tenants/{id}` | veřejné / vlastní |  | PlatformController.tenant |
| POST | `/api/v1/platform/tenants/{id}/invoices` | veřejné / vlastní |  | PlatformController.createInvoice |
| PUT | `/api/v1/platform/tenants/{id}/subscription` | veřejné / vlastní |  | PlatformController.updateSubscription |
| POST | `/api/v1/platform/tenants/{id}/subscription/extend` | veřejné / vlastní |  | PlatformController.extend |

## product

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| POST | `/api/v1/products` | product.item.manage | product | ProductsController.create |
| GET | `/api/v1/products/by-object/{objectId}` | product.item.manage | product | ProductsController.getByObject |

## rbac

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/audit-events` | core.audit.view |  | AuditController.list |
| POST | `/api/v1/authz/check` | přihlášený |  | AuthzController.check |
| GET | `/api/v1/authz/my-permissions` | přihlášený |  | AuthzController.myPermissions |
| GET | `/api/v1/modules` | přihlášený |  | ModulesController.list |
| PATCH | `/api/v1/modules/{key}` | core.module.configure |  | ModulesController.setState |
| GET | `/api/v1/objects/{id}/access-check` | core.role.view |  | RbacController.accessCheck |
| GET | `/api/v1/objects/{id}/permissions` | core.role.view |  | RbacController.list |
| POST | `/api/v1/objects/{id}/permissions` | core.role.manage |  | RbacController.grant |
| DELETE | `/api/v1/permissions/{permId}` | core.role.manage |  | RbacController.revoke |
| GET | `/api/v1/policies` | core.organization.configure |  | PolicyController.list |
| POST | `/api/v1/policies/{id}/assign` | core.organization.configure |  | PolicyController.assign |
| POST | `/api/v1/policies/time-window` | core.organization.configure |  | PolicyController.create |
| GET | `/api/v1/roles` | core.role.view |  | RolesController.overview |
| POST | `/api/v1/roles` | core.role.manage | custom_roles | RolesController.create |
| PUT | `/api/v1/roles/{key}` | core.role.manage | custom_roles | RolesController.update |
| DELETE | `/api/v1/roles/{key}` | core.role.manage | custom_roles | RolesController.remove |
| POST | `/api/v1/roles/{key}/reset` | core.role.manage | custom_roles | RolesController.reset |

## rental

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/rental/items` | rental.item.manage | rental | RentalController.listItems |
| POST | `/api/v1/rental/items` | rental.item.manage | rental | RentalController.createItem |
| POST | `/api/v1/rental/items/{itemId}/loans` | rental.item.manage | rental | RentalController.createLoan |
| POST | `/api/v1/rental/loans/{loanId}/cancel` | rental.item.manage | rental | RentalController.cancelLoan |
| POST | `/api/v1/rental/loans/{loanId}/return` | rental.item.manage | rental | RentalController.returnLoan |
| POST | `/api/v1/rental/loans/{loanId}/reviews` | rental.item.manage | rental | RentalController.submitReview |
| POST | `/api/v1/renters` | rental.item.manage | rental | RentalController.createRenter |
| GET | `/api/v1/renters/{id}` | rental.item.manage | rental | RentalController.getRenter |
| POST | `/api/v1/renters/{id}/verify` | rental.renter.verify | rental | RentalController.verifyRenter |

## resolver

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/r/{code}` | veřejné / vlastní |  | ResolverController.resolve |
| POST | `/r/{code}/activate` | veřejné / vlastní |  | ActivationController.activate |

## telegram

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| POST | `/api/v1/channels/telegram/webhook/{secret}` | veřejné / vlastní |  | TelegramWebhookController.webhook |

## tenant

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/tenant` | core.organization.view |  | TenantController.current |
| PATCH | `/api/v1/tenant` | core.organization.configure |  | TenantController.update |
| GET | `/api/v1/tenant/logo` | asset.item.view | branding | TenantController.logo |
| POST | `/api/v1/tenant/logo` | core.organization.configure | branding | TenantController.setLogo |
| DELETE | `/api/v1/tenant/logo` | core.organization.configure | branding | TenantController.deleteLogo |

## ticketing

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| POST | `/api/v1/ticketing/events` | ticketing.event.manage | ticketing | TicketingController.createEvent |
| POST | `/api/v1/ticketing/events/{eventId}/ticket-types` | ticketing.event.manage | ticketing | TicketingController.createTicketType |
| POST | `/api/v1/ticketing/ticket-types/{ticketTypeId}/tickets` | ticketing.event.manage | ticketing | TicketingController.issueTicket |

## users

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/users` | core.member.view |  | UsersController.list |
| POST | `/api/v1/users` | core.member.invite |  | UsersController.invite |
| POST | `/api/v1/users/{id}/activate` | core.member.deactivate |  | UsersController.activate |
| PATCH | `/api/v1/users/{id}/category` | core.person.manage |  | UsersController.setCategory |
| PATCH | `/api/v1/users/{id}/role` | core.role.manage |  | UsersController.updateRole |
| POST | `/api/v1/users/{id}/suspend` | core.member.deactivate |  | UsersController.suspend |

## wallet

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/wallet` | přihlášený |  | WalletController.list |
| POST | `/api/v1/wallet/codes` | přihlášený |  | WalletController.createPersonal |
| DELETE | `/api/v1/wallet/codes/{id}` | přihlášený |  | WalletController.deletePersonal |
| POST | `/api/v1/wallet/shared` | core.organization.configure |  | WalletController.createShared |
| DELETE | `/api/v1/wallet/shared/{id}` | core.organization.configure |  | WalletController.deleteShared |

## webhooks

| Metoda | Cesta | Oprávnění | Modul | Handler |
|---|---|---|---|---|
| GET | `/api/v1/webhooks` | core.integration.manage |  | WebhooksController.list |
| POST | `/api/v1/webhooks` | core.integration.manage |  | WebhooksController.create |
| DELETE | `/api/v1/webhooks/{id}` | core.integration.manage |  | WebhooksController.remove |
| POST | `/api/v1/webhooks/{id}/test` | core.integration.manage |  | WebhooksController.test |
| GET | `/api/v1/webhooks/deliveries` | core.integration.manage |  | WebhooksController.deliveries |

