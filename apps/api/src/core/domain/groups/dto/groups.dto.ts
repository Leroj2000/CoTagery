import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { GroupType } from '../../entities/group.entity';

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  /** Typ skupiny – `user` (výchozí) nebo `person`. */
  @IsOptional()
  @IsIn(['user', 'person'])
  type?: GroupType;
}

export class AddGroupMemberDto {
  /** ID uživatele (skupina typu `user`). */
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** ID osoby (skupina typu `person`). */
  @IsOptional()
  @IsUUID()
  personId?: string;
}
