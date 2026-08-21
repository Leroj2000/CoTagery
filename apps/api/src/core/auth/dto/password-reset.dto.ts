import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestResetDto {
  @IsEmail()
  email!: string;
}

export class ConfirmResetDto {
  @IsString()
  @MaxLength(200)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}
