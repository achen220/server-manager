import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateConnectionDto {
  @IsString()
  name!: string;

  @IsString()
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port = 22;

  @IsString()
  username!: string;

  @IsIn(['password', 'key'])
  authType!: 'password' | 'key';

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  privateKeyPath?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
