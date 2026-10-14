import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const TENANT_TYPES = ['retail', 'event', 'rental', 'home', 'mixed'] as const;

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsIn(TENANT_TYPES)
  type?: (typeof TENANT_TYPES)[number];

  @IsString()
  @MaxLength(200)
  ownerName!: string;

  @IsEmail()
  ownerEmail!: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['trialing', 'active', 'past_due', 'suspended', 'canceled'] as const;

/** Změna předplatného firmy superadminem. Prázdné = beze změny. */
export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(31)
  planKey?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE)
  periodStart?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE)
  periodEnd?: string | null;

  @IsOptional()
  @IsIn(['month', 'year', 'custom'])
  billingPeriod?: 'month' | 'year' | 'custom';

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceAmount?: number | null;

  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @IsOptional()
  @IsObject()
  billingDetails?: Record<string, string>;

  /** `{ assets: 800, users: null }` – null = neomezeno; chybějící klíč = podle úrovně. */
  @IsOptional()
  @IsObject()
  limitOverrides?: Record<string, number | null>;

  /** `{ rental: 'enabled', ai: 'disabled' }`. */
  @IsOptional()
  @IsObject()
  entitlementOverrides?: Record<string, string>;
}

export class ExtendSubscriptionDto {
  @IsInt()
  @Min(1)
  @Max(3660)
  days!: number;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amountNet?: number;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE)
  periodFrom?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE)
  periodTo?: string | null;

  @IsOptional()
  @Matches(DATE)
  issuedOn?: string;

  @IsOptional()
  @Matches(DATE)
  dueOn?: string;
}

export class MarkInvoicePaidDto {
  @IsOptional()
  @Matches(DATE)
  paidOn?: string;

  /** Prodloužit předplatné do konce fakturovaného období (výchozí ano). */
  @IsOptional()
  @IsBoolean()
  extend?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceMonth?: number | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priceYear?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entitlements?: string[];

  @IsOptional()
  @IsObject()
  limits?: Record<string, number | null>;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsInt()
  trialDays?: number;

  @IsOptional()
  @IsInt()
  graceDays?: number;

  @IsOptional()
  @IsInt()
  invoiceDueDays?: number;

  @IsOptional()
  @IsBoolean()
  vatPayer?: boolean;

  @IsOptional()
  @IsNumber()
  vatRate?: number;

  @IsOptional()
  @IsObject()
  supplier?: Record<string, string>;
}

/** Text systémového e-mailu (null/chybí = výchozí). */
export class PlatformTemplateDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(200)
  subject?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(5000)
  body?: string | null;
}
