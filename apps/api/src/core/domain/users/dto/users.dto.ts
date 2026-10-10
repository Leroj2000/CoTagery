import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Klíč role (systémová šablona nebo vlastní role firmy `c_…`); existenci a hierarchii ověří RolesService. */
const ROLE_KEY = /^[A-Za-z0-9_]{1,64}$/;

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @Matches(ROLE_KEY)
  tenantRole!: string;
}

export class UpdateRoleDto {
  @IsString()
  @Matches(ROLE_KEY)
  tenantRole!: string;
}

export class SetUserCategoryDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayUnique()
  categoryIds!: string[];
}
