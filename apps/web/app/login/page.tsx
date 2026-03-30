"use client";

import { motion } from "framer-motion";
import { Shield, UserRoundCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../lib/api";
import { saveSession } from "../../lib/session";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    tenantId: string;
    tenantCode: string;
    username: string;
    roles: string[];
    permissions: string[];
    mfaVerified: boolean;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [tenantCode, setTenantCode] = useState("campana-demo-alcaldia");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin12345!");
  const [mfaCode, setMfaCode] = useState("654321");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [message, setMessage] = useState("Use credenciales demo o tus credenciales reales.");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("Validando sesión...");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tenantCode,
          username,
          password,
          mfaCode: mfaCode.trim() || undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string | string[] };
        const errorMessage = Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message ?? "No fue posible iniciar sesión";
        setStatus("error");
        setMessage(errorMessage);
        return;
      }

      const data = (await response.json()) as LoginResponse;
      saveSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tenantId: data.user.tenantId,
        tenantCode: data.user.tenantCode,
        username: data.user.username,
        roles: data.user.roles,
        permissions: data.user.permissions,
        mfaVerified: data.user.mfaVerified
      });

      setStatus("ok");
      setMessage(`Bienvenido ${data.user.username}. Redirigiendo al dashboard...`);
      setTimeout(() => {
        router.push("/dashboard");
      }, 450);
    } catch {
      setStatus("error");
      setMessage("Error de conexión con la API.");
    }
  }

  return (
    <div className="split">
      <motion.section
        className="card hero"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h2 className="title title-xl">Ingreso seguro con MFA y control por tenant</h2>
        <p className="subtitle">
          Este acceso usa el flujo real de seguridad: acceso JWT, refresh rotativo, scope por
          tenant y enforcement de permisos sensibles.
        </p>
        <div className="stack" style={{ marginTop: 14 }}>
          <div className="panel stack">
            <Shield size={18} />
            <p className="muted small">
              Para ADMIN, MFA es obligatorio según configuración del tenant.
            </p>
          </div>
          <div className="panel stack">
            <UserRoundCheck size={18} />
            <p className="muted small">
              Tras login exitoso, tendrás navegación operativa de dashboard y usuarios.
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="card stack"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h3 className="title">Acceder al panel</h3>
        <form className="stack" onSubmit={onSubmit}>
          <label className="label">
            Tenant code
            <input
              className="input"
              value={tenantCode}
              onChange={(event) => setTenantCode(event.target.value)}
              required
            />
          </label>
          <label className="label">
            Usuario
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="label">
            Contraseña
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label className="label">
            Código MFA (si aplica)
            <input
              className="input"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              placeholder="Ej: 654321"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Validando..." : "Ingresar"}
          </button>
        </form>
        <p
          className={
            status === "ok"
              ? "status-ok"
              : status === "error"
                ? "status-error"
                : "status-warn"
          }
        >
          {message}
        </p>
      </motion.section>
    </div>
  );
}
