import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

function resolveAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const allowedOrigins = resolveAllowedOrigins();
  const allowAllOrigins = allowedOrigins.includes("*");

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origen no permitido por CORS"), false);
      },
      credentials: true
    }
  });

  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const openApiConfig = new DocumentBuilder()
    .setTitle("BDPolitica API")
    .setDescription(
      "API multi-tenant con auth access/refresh, MFA admin y RBAC por permisos"
    )
    .setVersion("0.2.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      },
      "access-token"
    )
    .addCookieAuth("refresh_token")
    .addServer("http://localhost:3001")
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

bootstrap();
