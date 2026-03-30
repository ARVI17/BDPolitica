"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Fingerprint,
  Landmark,
  ShieldAlert,
  UserCog,
  Users
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import { getSession } from "../../lib/session";

type TenantSummary = {
  user: {
    id: string;
    username: string;
    roles: string[];
    tenantId: string;
  };
  tenant: {
    id: string;
    name: string;
    code: string;
    campaignTypeCode: string;
    isActive: boolean;
  };
};

type PermissionSummary = {
  roles: string[];
  permissions: string[];
  mfaVerified: boolean;
};

export default function DashboardPage() {
  const [tenantData, setTenantData] = useState<TenantSummary | null>(null);
  const [permissionData, setPermissionData] = useState<PermissionSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      setError("No hay sesión activa. Inicia sesión para ver el dashboard.");
      return;
    }

    const run = async () => {
      try {
        const [tenant, permission] = await Promise.all([
          apiRequest<TenantSummary>("/tenants/me", { session }),
          apiRequest<PermissionSummary>("/rbac/me-permissions", { session })
        ]);
        setTenantData(tenant);
        setPermissionData(permission);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No fue posible cargar información de operación."
        );
      }
    };

    run().catch(() => {
      setError("No fue posible cargar el dashboard.");
    });
  }, []);

  const kpis = useMemo(() => {
    if (!permissionData) {
      return [
        { label: "Roles activos", value: "0", delta: "Sin datos", icon: <UserCog size={18} /> },
        {
          label: "Permisos efectivos",
          value: "0",
          delta: "Sin datos",
          icon: <Fingerprint size={18} />
        },
        {
          label: "MFA verificado",
          value: "No",
          delta: "Pendiente",
          icon: <ShieldAlert size={18} />
        },
        { label: "Estado tenant", value: "N/A", delta: "Pendiente", icon: <Landmark size={18} /> }
      ];
    }

    return [
      {
        label: "Roles activos",
        value: String(permissionData.roles.length),
        delta: permissionData.roles.join(", "),
        icon: <UserCog size={18} />
      },
      {
        label: "Permisos efectivos",
        value: String(permissionData.permissions.length),
        delta:
          permissionData.permissions.includes("usuarios.manage")
            ? "Acceso administrativo habilitado"
            : "Perfil operativo",
        icon: <Fingerprint size={18} />
      },
      {
        label: "MFA verificado",
        value: permissionData.mfaVerified ? "Sí" : "No",
        delta: permissionData.mfaVerified ? "Rutas sensibles habilitadas" : "Restricción activa",
        icon: <ShieldAlert size={18} />
      },
      {
        label: "Estado tenant",
        value: tenantData?.tenant.isActive ? "Activo" : "Inactivo",
        delta: tenantData?.tenant.name ?? "Sin tenant",
        icon: <Landmark size={18} />
      }
    ];
  }, [permissionData, tenantData]);

  return (
    <>
      <motion.section
        className="card hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h2 className="title title-xl">Centro operativo de campaña</h2>
        <p className="subtitle">
          Supervisa seguridad, permisos y estado de tenant desde un tablero de control para
          decisiones rápidas.
        </p>
        {tenantData ? (
          <div className="actions" style={{ marginTop: 10 }}>
            <span className="status-ok">{tenantData.tenant.name}</span>
            <span className="status-warn">{tenantData.user.username}</span>
            <span className="status-warn">{tenantData.tenant.code}</span>
          </div>
        ) : null}
        {error ? <p className="status-error">{error}</p> : null}
      </motion.section>

      <section className="grid grid-4">
        {kpis.map((kpi, index) => (
          <motion.article
            className="card kpi"
            key={kpi.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index, duration: 0.3 }}
          >
            {kpi.icon}
            <span className="kpi-label">{kpi.label}</span>
            <strong className="kpi-value">{kpi.value}</strong>
            <span className="kpi-delta">{kpi.delta}</span>
          </motion.article>
        ))}
      </section>

      <section className="grid grid-2">
        <article className="card stack">
          <h3 className="title">Acciones rápidas</h3>
          <p className="muted">
            Gestiona usuarios, roles y accesos sensibles desde el módulo administrativo.
          </p>
          <div className="actions">
            <Link className="btn btn-primary" href="/usuarios">
              <Users size={16} /> Gestión de usuarios
            </Link>
            <Link className="btn btn-soft" href="/login">
              Reautenticar
            </Link>
          </div>
        </article>

        <article className="card stack">
          <h3 className="title">Operatividad y seguridad</h3>
          <p className="muted">
            Revisa `/api/docs` para probar endpoints de auth, tenant y usuarios. El sistema
            ya bloquea merges sin QA exitoso.
          </p>
          <div className="actions">
            <a className="btn btn-soft" href="http://localhost:3001/api/docs" target="_blank">
              <Activity size={16} /> Abrir Swagger
            </a>
          </div>
        </article>
      </section>
    </>
  );
}
