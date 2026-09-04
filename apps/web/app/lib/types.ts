/** Sdílené tvary entit vrácených API (jen pole, která admin renderuje). */

export interface Asset {
  id: string;
  digitalObjectId: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  inventoryNumber: string | null;
  homeLocationId: string | null;
  status: string;
  currentHolderType: 'location' | 'person' | 'asset' | null;
  currentHolderId: string | null;
  responsiblePersonId: string | null;
  dueAt: string | null;
  canContainAssets: boolean;
  parentAssetId: string | null;
  photoKey: string | null;
  actions?: string[];
}

export interface Movement {
  id: string;
  assetId?: string;
  type: string;
  fromType: string | null;
  fromId: string | null;
  toType: string | null;
  toId: string | null;
  actorPersonId: string | null;
  dueAt: string | null;
  note: string | null;
  confirmation: 'none' | 'pending' | 'confirmed';
  confirmedAt: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string | null;
}

export interface ServiceRecord {
  id: string;
  assetId: string;
  kind: string;
  performedAt: string | null;
  nextDueAt: string | null;
  provider: string | null;
  cost: string | null;
  note: string | null;
}

export interface AssetMedia {
  id: string;
  assetId: string;
  movementId: string | null;
  phase: 'at_loan' | 'at_return' | 'at_service' | 'general';
  kind: string;
  mime: string;
  caption: string | null;
  sha256: string | null;
  capturedAt: string;
  createdAt: string;
}

export interface AssetManual {
  id: string;
  assetId: string;
  title: string;
  fileKey: string | null;
  mime: string | null;
  sizeBytes: number | string | null;
  source: 'upload' | 'camera' | 'ai';
  sourceUrl: string | null;
  status: 'ready' | 'fetching' | 'failed';
  failureReason: string | null;
  createdAt: string;
}

export interface AssetSpecItem {
  label: string;
  value: string;
}

export interface AssetSpec {
  id: string;
  assetId: string;
  specs: AssetSpecItem[] | null;
  sourceUrl: string | null;
  status: 'fetching' | 'ready' | 'failed';
  failureReason: string | null;
}

export interface Observation {
  id: string;
  source: string;
  observedAt: string;
  locationName: string | null;
  actorName: string | null;
}

export interface Reservation {
  id: string;
  assetId: string;
  requestedById: string | null;
  fromAt: string | null;
  toAt: string | null;
  purpose: string | null;
  status: string;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  categoryId: string | null;
  photoFileKey: string | null;
}

export interface PersonCategory {
  id: string;
  name: string;
  color: string | null;
}

export interface Issue {
  id: string;
  assetId: string;
  kind: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface FoundReport {
  id: string;
  publicCode: string;
  message: string;
  finderContact: string | null;
  status: string;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  statusCode: number | null;
  ok: boolean;
  error: string | null;
  createdAt: string;
}

export interface Attention {
  overdue: Asset[];
  pendingConfirmations: Movement[];
  openIssues: Issue[];
  dueServices: ServiceRecord[];
}

export interface Location {
  id: string;
  name: string;
  type: string;
  address: string | null;
  parentId: string | null;
  gridRows?: number | null;
  gridCols?: number | null;
  cellRow?: number | null;
  cellCol?: number | null;
}

export interface InventoryCheck {
  id: string;
  subjectType: 'location' | 'person' | 'asset';
  subjectId: string | null;
  locationId: string | null;
  status: 'open' | 'closed';
  expectedAssetIds: string[];
  foundCount: number;
  missingCount: number;
  unexpectedCount: number;
  closedAt: string | null;
  createdAt: string;
}

export interface InventoryDetail {
  check: InventoryCheck;
  found: Asset[];
  missing: Asset[];
  unexpected: Asset[];
  scannedCount: number;
}

export interface DigitalObject {
  id: string;
  moduleType: string;
  slug: string;
  status: string;
  primaryUrl: string | null;
  createdAt: string;
}

export interface DataCarrier {
  id: string;
  publicCode: string;
  carrierType: string;
  status: string;
  resolverUrl: string | null;
  selfActivatable?: boolean;
  moduleTemplate?: string | null;
  externalCode?: string | null;
  externalScheme?: 'ean13' | 'url' | 'custom' | null;
  origin?: 'native' | 'adopted';
}

/** Výsledek generování batche identifikátorů (pin je jen jednou, k tisku). */
export interface GeneratedCarrier {
  id: string;
  publicCode: string;
  resolverUrl: string | null;
  status: string;
  pin: string | null;
}

export interface ScanResult {
  found: boolean;
  code: string;
  carrier?: {
    id: string;
    publicCode: string;
    externalCode: string | null;
    origin: 'native' | 'adopted';
    carrierType: string;
  };
  asset?: (Asset & { actions?: string[] }) | null;
  object?: { id: string; moduleType: string; slug: string } | null;
  primaryAction?: string | null;
  context?: {
    homeName: string | null;
    holderName: string | null;
    responsibleName: string | null;
  } | null;
  requireReturnPhoto?: boolean;
}

export interface WorkflowItem {
  code: string;
  assetId: string | null;
  name: string | null;
  status: string | null;
  ok: boolean;
  reason?: string;
  duplicate?: boolean;
}

export interface WorkflowValidation {
  items: WorkflowItem[];
  okCount: number;
  blockedCount: number;
  assetIds: string[];
}

export interface MembershipTier {
  id: string;
  name: string;
  level: number;
  price: string;
  currency: string;
  validityDays: number;
  graceDays: number;
  zoneKeys: string[];
}

export interface Member {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface Membership {
  id: string;
  memberId: string;
  tierId: string;
  status: string;
  validTo: string;
}

export type GroupType = 'user' | 'person';

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string | null;
  personId: string | null;
}

export interface Subscription {
  id: string;
  tierId: string;
  membershipId: string | null;
  status: string;
  currentPeriodEnd: string | null;
  pspSubscriptionRef: string;
}

export interface UsageMeter {
  id: string;
  period: string;
  metric: string;
  quantity: number;
  reportedAt: string | null;
}

export interface Invoice {
  id: string;
  pspInvoiceRef: string;
  amountNet: string;
  vatAmount: string;
  vatRate: string;
  reverseCharge: boolean;
  currency: string;
  status: string;
  periodEnd: string | null;
}

export interface AccessPoint {
  id: string;
  name: string;
  zoneKey: string;
  direction: string;
}

export interface AccessEvent {
  id: string;
  subjectType: string;
  subjectRef: string;
  decision: string;
  reason: string | null;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  type: string;
  slug: string | null;
  brandingDomain: string | null;
  networkListed?: boolean;
  settings: Record<string, unknown>;
}

export interface MembershipBenefit {
  id: string;
  tierId: string;
  kind: string;
  targetKey: string | null;
  value: string | null;
  description: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  tenantRole: string;
  status: string;
  createdAt: string;
  personCategoryId?: string | null;
}
