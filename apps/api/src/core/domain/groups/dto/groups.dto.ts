import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}

export class AddGroupMemberDto {
  @IsUUID()
  userId!: string;
}
