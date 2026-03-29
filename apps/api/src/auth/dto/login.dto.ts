import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength
} from "class-validator";

export class LoginDto {
  @ApiProperty({
    example: "campana-demo-alcaldia"
  })
  @IsString()
  @IsNotEmpty()
  tenantCode!: string;

  @ApiProperty({
    example: "admin"
  })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({
    example: "Admin12345!"
  })
  @IsString()
  @MinLength(10)
  password!: string;

  @ApiPropertyOptional({
    example: "654321"
  })
  @IsOptional()
  @IsString()
  @Length(6, 10)
  mfaCode?: string;
}
