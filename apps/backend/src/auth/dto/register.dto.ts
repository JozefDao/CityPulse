import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(3, 24)
  @Matches(/^[a-zA-Z0-9_]+$/)
  nickname: string;

  @IsString()
  @MinLength(8)
  password: string;
}
