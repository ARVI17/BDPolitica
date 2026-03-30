export const SESSION_STORAGE_KEY = "bdpolitica.session.v1";

export type SessionData = {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  tenantCode: string;
  username: string;
  roles: string[];
  permissions: string[];
  mfaVerified: boolean;
};

export function getSession(): SessionData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed.accessToken || !parsed.tenantId || !parsed.username) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionData): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
