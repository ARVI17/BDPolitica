import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length } from "class-validator";

export class ListUsersQueryDto {
  @ApiPropertyOptional({
    description: "Busca por username o email",
    example: "coord"
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;

  @ApiPropertyOptional({
    description: "Filtrar por codigo de rol",
    example: "COORDINADOR"
  })
  @IsOptional()
  @IsString()
  @Length(3, 64)
  roleCode?: string;

  @ApiPropertyOptional({
    description: "Estado de activacion",
    enum: ["all", "active", "inactive"],
    example: "active"
  })
  @IsOptional()
  @IsIn(["all", "active", "inactive"])
  status?: "all" | "active" | "inactive";
}
