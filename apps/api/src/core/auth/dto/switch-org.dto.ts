import { IsUUID } from 'class-validator';

export class SwitchOrgDto {
  /** Organizace (tenant), do které se identita přepíná – musí v ní mít členství. */
  @IsUUID()
  organizationId!: string;
}
