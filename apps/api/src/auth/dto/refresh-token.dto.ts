import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      "Refresh token en body. Si no se envia, se usa cookie refresh_token",
    example: "22d45ad4c75b4a5988c3eab31fef39ce..."
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
