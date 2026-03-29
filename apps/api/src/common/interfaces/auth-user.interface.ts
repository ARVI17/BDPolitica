export interface AuthUser {
  id: string;
  tenantId: string;
  tenantCode: string;
  username: string;
  roles: string[];
  permissions: string[];
  mfaVerified: boolean;
}
