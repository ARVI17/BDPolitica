import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      tenantId: string;
      tenantCode: string;
      username: string;
      roles: string[];
      permissions: string[];
      mfaVerified: boolean;
    };
  }
}
