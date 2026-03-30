import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({
    example: "nuevo.coordinador"
  })
  @IsString()
  @Length(3, 64)
  username!: string;

  @ApiProperty({
    example: "nuevo.coordinador@bdpolitica.local"
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: "ClaveSegura123!"
  })
  @IsString()
  @MinLength(10)
  password!: string;

  @ApiProperty({
    example: "COORDINADOR"
  })
  @IsString()
  @Length(3, 64)
  roleCode!: string;

  @ApiPropertyOptional({
    example: false
  })
  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;

  @ApiPropertyOptional({
    example: "654321"
  })
  @IsOptional()
  @IsString()
  @Length(6, 12)
  mfaCode?: string;
}
