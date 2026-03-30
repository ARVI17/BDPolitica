import { INestApplication } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TENANT_1 = "11111111-1111-7111-8111-111111111111";
const TENANT_2 = "22222222-2222-7222-8222-222222222222";
const DIGITADOR_USER_ID = "dddddddd-dddd-7ddd-8ddd-dddddddddddd";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    tenantId: string;
    username: string;
    roles: string[];
    permissions: string[];
    mfaVerified: boolean;
  };
};

describe("API Fase 2 (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.ACCESS_TOKEN_SECRET = "local-testing-secret-with-at-least-32-chars";
    process.env.ACCESS_TOKEN_TTL = "15m";
    process.env.REFRESH_TOKEN_TTL = "30d";
    process.env.LOGIN_MAX_ATTEMPTS = "5";
    process.env.LOGIN_BLOCK_MINUTES = "15";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.auditEvent.deleteMany({
      where: {
        tenantId: {
          in: [TENANT_1, TENANT_2]
        }
      }
    });

    await prisma.userRole.updateMany({
      where: {
        tenantId: TENANT_1,
        userId: DIGITADOR_USER_ID,
        isActive: true
      },
      data: {
        isActive: false,
        validTo: new Date()
      }
    });

    await prisma.userRole.create({
      data: {
        id: randomUUID(),
        tenantId: TENANT_1,
        userId: DIGITADOR_USER_ID,
        roleId: "f266d9c3-a6f9-4986-b1af-700bd6b9c6ef",
        validFrom: new Date(),
        isActive: true
      }
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("login coordinador + refresh valido + reuse detectado + revocacion global", async () => {
    const login = await request(app.getHttpServer()).post("/api/auth/login").send({
      tenantCode: "campana-demo-alcaldia",
      username: "coordinador",
      password: "Coordi12345!"
    });

    expect(login.status).toBe(201);
    const loginBody = login.body as LoginResponse;
    expect(loginBody.accessToken).toBeDefined();
    expect(loginBody.refreshToken).toBeDefined();
    expect(loginBody.user.roles).toContain("COORDINADOR");

    const refresh1 = await request(app.getHttpServer()).post("/api/auth/refresh").send({
      refreshToken: loginBody.refreshToken
    });
    expect(refresh1.status).toBe(201);
    const refresh1Body = refresh1.body as LoginResponse;
    expect(refresh1Body.refreshToken).toBeDefined();
    expect(refresh1Body.refreshToken).not.toBe(loginBody.refreshToken);

    const reuse = await request(app.getHttpServer()).post("/api/auth/refresh").send({
      refreshToken: loginBody.refreshToken
    });
    expect(reuse.status).toBe(401);

    const afterReuse = await request(app.getHttpServer()).post("/api/auth/refresh").send({
      refreshToken: refresh1Body.refreshToken
    });
    expect(afterReuse.status).toBe(401);
  });

  it("logout global revoca refresh tokens activos", async () => {
    const login = await request(app.getHttpServer()).post("/api/auth/login").send({
      tenantCode: "campana-demo-alcaldia",
      username: "coordinador",
      password: "Coordi12345!"
    });
    const loginBody = login.body as LoginResponse;

    const logout = await request(app.getHttpServer())
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${loginBody.accessToken}`)
      .set("x-tenant-id", TENANT_1);

    expect(logout.status).toBe(201);
    expect(logout.body.revokedCount).toBeGreaterThanOrEqual(1);

    const refresh = await request(app.getHttpServer()).post("/api/auth/refresh").send({
      refreshToken: loginBody.refreshToken
    });
    expect(refresh.status).toBe(401);
  });

  it("matriz de permisos por rol y tenant", async () => {
    const coordLogin = await request(app.getHttpServer()).post("/api/auth/login").send({
      tenantCode: "campana-demo-alcaldia",
      username: "coordinador",
      password: "Coordi12345!"
    });
    const coord = coordLogin.body as LoginResponse;

    const coordPermissions = await request(app.getHttpServer())
      .get("/api/rbac/me-permissions")
      .set("Authorization", `Bearer ${coord.accessToken}`)
      .set("x-tenant-id", TENANT_1);
    expect(coordPermissions.status).toBe(200);
    expect(coordPermissions.body.permissions).toContain("personas.read");
    expect(coordPermissions.body.permissions).not.toContain("usuarios.manage");

    const coordCannotAssign = await request(app.getHttpServer())
      .post(`/api/rbac/users/${DIGITADOR_USER_ID}/assign-role`)
      .set("Authorization", `Bearer ${coord.accessToken}`)
      .set("x-tenant-id", TENANT_1)
      .send({ roleCode: "COORDINADOR" });
    expect(coordCannotAssign.status).toBe(403);

    const coordTenant2Login = await request(app.getHttpServer()).post("/api/auth/login").send({
      tenantCode: "campana-demo-gobernacion",
      username: "coordinador2",
      password: "CoordiTenant2123!"
    });
    const coordTenant2 = coordTenant2Login.body as LoginResponse;

    const tenantMismatch = await request(app.getHttpServer())
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${coordTenant2.accessToken}`)
      .set("x-tenant-id", TENANT_1);
    expect(tenantMismatch.status).toBe(403);

    const tenantOk = await request(app.getHttpServer())
      .get("/api/tenants/me")
      .set("Authorization", `Bearer ${coordTenant2.accessToken}`)
      .set("x-tenant-id", TENANT_2);
    expect(tenantOk.status).toBe(200);
  });

  it("MFA admin: sin MFA no accede, con MFA si accede a ruta sensible", async () => {
    const adminNoMfa = await request(app.getHttpServer()).post("/api/auth/login").send({
      tenantCode: "campana-demo-alcaldia",
      username: "admin_nomfa",
      password: "AdminNoMfa123!"
    });
    expect(adminNoMfa.status).toBe(403);

    const adminWithoutCode = await request(app.getHttpServer()).post("/api/auth/login").send({
      tenantCode: "campana-demo-alcaldia",
      username: "admin",
      password: "Admin12345!"
    });
    expect(adminWithoutCode.status).toBe(401);

    const adminLogin = await request(app.getHttpServer()).post("/api/auth/login").send({
      tenantCode: "campana-demo-alcaldia",
      username: "admin",
      password: "Admin12345!",
      mfaCode: "654321"
    });
    expect(adminLogin.status).toBe(201);
    const admin = adminLogin.body as LoginResponse;
    expect(admin.user.roles).toContain("ADMIN");
    expect(admin.user.mfaVerified).toBe(true);

    const sensitive = await request(app.getHttpServer())
      .get("/api/rbac/admin-security-status")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .set("x-tenant-id", TENANT_1);
    expect(sensitive.status).toBe(200);
  });

  it("auditoria registra eventos criticos de auth y RBAC", async () => {
    const login = await request(app.getHttpServer()).post("/api/auth/login").send({
      tenantCode: "campana-demo-alcaldia",
      username: "admin",
      password: "Admin12345!",
      mfaCode: "654321"
    });
    const admin = login.body as LoginResponse;

    const refreshed = await request(app.getHttpServer()).post("/api/auth/refresh").send({
      refreshToken: admin.refreshToken
    });
    expect(refreshed.status).toBe(201);

    const assignRole = await request(app.getHttpServer())
      .post(`/api/rbac/users/${DIGITADOR_USER_ID}/assign-role`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .set("x-tenant-id", TENANT_1)
      .send({ roleCode: "COORDINADOR" });
    expect(assignRole.status).toBe(201);

    const logout = await request(app.getHttpServer())
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .set("x-tenant-id", TENANT_1);
    expect(logout.status).toBe(201);

    const events = await prisma.auditEvent.findMany({
      where: {
        tenantId: TENANT_1
      },
      select: {
        eventName: true,
        actorUserId: true,
        tenantId: true
      }
    });

    const names = events.map((item) => item.eventName);
    expect(names).toContain("auth.login.success");
    expect(names).toContain("auth.refresh.success");
    expect(names).toContain("auth.logout_all.success");
    expect(names).toContain("rbac.user_role.updated");
    expect(events.every((item) => item.tenantId === TENANT_1)).toBe(true);
    expect(events.some((item) => item.actorUserId === admin.user.id)).toBe(true);
  });

  it("gestion de usuarios: crear, listar y desactivar", async () => {
    const adminLogin = await request(app.getHttpServer()).post("/api/auth/login").send({
      tenantCode: "campana-demo-alcaldia",
      username: "admin",
      password: "Admin12345!",
      mfaCode: "654321"
    });
    expect(adminLogin.status).toBe(201);
    const admin = adminLogin.body as LoginResponse;

    const roles = await request(app.getHttpServer())
      .get("/api/users/roles")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .set("x-tenant-id", TENANT_1);
    expect(roles.status).toBe(200);
    expect(Array.isArray(roles.body)).toBe(true);

    const suffix = Date.now().toString();
    const username = `operador_${suffix}`;
    const email = `operador_${suffix}@bdpolitica.local`;
    const password = "Operador12345!";

    const created = await request(app.getHttpServer())
      .post("/api/users")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .set("x-tenant-id", TENANT_1)
      .send({
        username,
        email,
        password,
        roleCode: "COORDINADOR"
      });
    expect(created.status).toBe(201);
    expect(created.body.username).toBe(username);
    expect(created.body.roleCode).toBe("COORDINADOR");

    const listed = await request(app.getHttpServer())
      .get("/api/users")
      .query({ search: username })
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .set("x-tenant-id", TENANT_1);
    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body)).toBe(true);
    expect(listed.body.some((item: { username: string }) => item.username === username)).toBe(
      true
    );

    const userId = created.body.id as string;
    const disabled = await request(app.getHttpServer())
      .patch(`/api/users/${userId}/status`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .set("x-tenant-id", TENANT_1)
      .send({ isActive: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.isActive).toBe(false);

    const inactiveLogin = await request(app.getHttpServer()).post("/api/auth/login").send({
      tenantCode: "campana-demo-alcaldia",
      username,
      password
    });
    expect(inactiveLogin.status).toBe(401);
  });
});
