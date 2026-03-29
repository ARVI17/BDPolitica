import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "./common/decorators/public.decorator";

@ApiTags("health")
@Controller()
export class HealthController {
  @Public()
  @Get("health")
  @ApiOperation({
    summary: "Health check del servicio API"
  })
  health() {
    return {
      status: "ok",
      service: "api"
    };
  }
}
