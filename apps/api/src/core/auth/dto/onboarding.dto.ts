import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterOrganizationDto {
  @IsString() @MinLength(2) @MaxLength(200) organizationName!: string;
  @IsString() @MinLength(2) @MaxLength(200) ownerName!: string;
  @IsEmail() ownerEmail!: string;
  @IsString() @MinLength(10) @MaxLength(200) password!: string;
  @IsOptional() @IsBoolean() includeDemoData?: boolean;
}

export class ConfirmAccountActionDto {
  @IsString() @MinLength(20) token!: string;
}

export class AcceptInviteDto extends ConfirmAccountActionDto {
  @IsString() @MinLength(10) @MaxLength(200) password!: string;
}
