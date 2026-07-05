import { IsBoolean, IsString, MinLength } from 'class-validator';

export class AddSshUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsBoolean()
  isAdmin: boolean;
}
