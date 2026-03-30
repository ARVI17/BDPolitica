"use client";

import { motion } from "framer-motion";
import { Plus, RefreshCcw, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import { getSession } from "../../lib/session";

type UserRow = {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  mfaEnabled: boolean;
  failedLoginAttempts: number;
  blockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
};

type RoleOption = {
  code: string;
  name: string;
};

type CreateUserForm = {
  username: string;
  email: string;
  password: string;
  roleCode: string;
  mfaEnabled: boolean;
  mfaCode: string;
};

const EMPTY_CREATE_FORM: CreateUserForm = {
  username: "",
  email: "",
  password: "",
  roleCode: "COORDINADOR",
  mfaEnabled: false,
  mfaCode: ""
};

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState<CreateUserForm>(EMPTY_CREATE_FORM);

  const session = useMemo(() => getSession(), []);

  const loadUsers = useCallback(async () => {
    if (!session) {
      setMessage("No hay sesión activa. Inicia sesión para administrar usuarios.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const query = new URLSearchParams();
      if (search.trim()) {
        query.set("search", search.trim());
      }
      if (status !== "all") {
        query.set("status", status);
      }
      if (roleFilter !== "all") {
        query.set("roleCode", roleFilter);
      }

      const queryString = query.toString();
      const users = await apiRequest<UserRow[]>(
        `/users${queryString ? `?${queryString}` : ""}`,
        { session }
      );
      setRows(users);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar usuarios.");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search, session, status]);

  const loadRoles = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      const data = await apiRequest<RoleOption[]>("/users/roles", { session });
      setRoles(data);
      if (data.length > 0 && !data.some((role) => role.code === createForm.roleCode)) {
        setCreateForm((current) => ({
          ...current,
          roleCode: data[0].code
        }));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar roles.");
    }
  }, [createForm.roleCode, session]);

  useEffect(() => {
    loadRoles().catch(() => {
      setMessage("Error cargando roles.");
    });
  }, [loadRoles]);

  useEffect(() => {
    loadUsers().catch(() => {
      setMessage("Error cargando usuarios.");
    });
  }, [loadUsers]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      setMessage("No hay sesión activa.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await apiRequest("/users", {
        method: "POST",
        session,
        body: {
          username: createForm.username,
          email: createForm.email,
          password: createForm.password,
          roleCode: createForm.roleCode,
          mfaEnabled: createForm.mfaEnabled,
          mfaCode: createForm.mfaCode.trim() || undefined
        }
      });
      setCreateForm({
        ...EMPTY_CREATE_FORM,
        roleCode: createForm.roleCode
      });
      setMessage("Usuario creado correctamente.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear usuario.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(userId: string, isActive: boolean) {
    if (!session) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await apiRequest(`/users/${userId}/status`, {
        method: "PATCH",
        session,
        body: { isActive }
      });
      setMessage(isActive ? "Usuario activado." : "Usuario desactivado.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar usuario.");
    } finally {
      setLoading(false);
    }
  }

  async function assignRole(userId: string, roleCode: string) {
    if (!session) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await apiRequest(`/rbac/users/${userId}/assign-role`, {
        method: "POST",
        session,
        body: { roleCode }
      });
      setMessage(`Rol actualizado a ${roleCode}.`);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cambiar el rol.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <motion.section
        className="card hero"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h2 className="title title-xl">Gestión profesional de usuarios</h2>
        <p className="subtitle">
          Administra usuarios por tenant, roles, estado operativo y seguridad MFA con control
          total por permisos.
        </p>
        {message ? (
          <p className={message.toLowerCase().includes("no se pudo") ? "status-error" : "status-ok"}>
            {message}
          </p>
        ) : null}
      </motion.section>

      <section className="split">
        <article className="card stack">
          <div className="toolbar">
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por usuario o email"
            />
            <select
              className="select"
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | "active" | "inactive")}
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
            <select
              className="select"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="all">Todos los roles</option>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.code}
                </option>
              ))}
            </select>
            <button className="btn btn-soft" onClick={() => loadUsers()}>
              <RefreshCcw size={15} /> Filtrar
            </button>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Roles</th>
                  <th>Estado</th>
                  <th>MFA</th>
                  <th>Intentos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.username}</strong>
                      <p className="muted small">{row.email}</p>
                    </td>
                    <td>{row.roles.join(", ") || "-"}</td>
                    <td>
                      <span className={row.isActive ? "status-ok" : "status-error"}>
                        {row.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <span className={row.mfaEnabled ? "status-ok" : "status-warn"}>
                        {row.mfaEnabled ? "Sí" : "No"}
                      </span>
                    </td>
                    <td>{row.failedLoginAttempts}</td>
                    <td>
                      <div className="actions">
                        {row.isActive ? (
                          <button
                            className="btn btn-danger"
                            onClick={() => updateStatus(row.id, false)}
                            disabled={loading}
                          >
                            <UserX size={14} /> Desactivar
                          </button>
                        ) : (
                          <button
                            className="btn btn-soft"
                            onClick={() => updateStatus(row.id, true)}
                            disabled={loading}
                          >
                            <UserCheck size={14} /> Activar
                          </button>
                        )}
                        <select
                          className="select"
                          onChange={(event) => assignRole(row.id, event.target.value)}
                          value={row.roles[0] ?? ""}
                          disabled={loading}
                        >
                          {roles.map((role) => (
                            <option key={role.code} value={role.code}>
                              {role.code}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <p className="muted">Sin resultados para los filtros actuales.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card stack">
          <h3 className="title">Crear nuevo usuario</h3>
          <form className="stack" onSubmit={createUser}>
            <label className="label">
              Username
              <input
                className="input"
                value={createForm.username}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, username: event.target.value }))
                }
                required
              />
            </label>
            <label className="label">
              Email
              <input
                className="input"
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
            </label>
            <label className="label">
              Contraseña temporal
              <input
                className="input"
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, password: event.target.value }))
                }
                required
              />
            </label>
            <label className="label">
              Rol inicial
              <select
                className="select"
                value={createForm.roleCode}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, roleCode: event.target.value }))
                }
              >
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name} ({role.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              <span className="actions">
                <input
                  type="checkbox"
                  checked={createForm.mfaEnabled}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      mfaEnabled: event.target.checked
                    }))
                  }
                />
                Activar MFA
              </span>
            </label>
            {createForm.mfaEnabled ? (
              <label className="label">
                Código MFA inicial
                <input
                  className="input"
                  value={createForm.mfaCode}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, mfaCode: event.target.value }))
                  }
                  placeholder="Ej: 654321"
                />
              </label>
            ) : null}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              <Plus size={15} /> Crear usuario
            </button>
          </form>

          <div className="panel stack">
            <ShieldCheck size={18} />
            <p className="muted small">
              Todo cambio de usuarios queda auditado en `audit_events` y protegido por permisos
              `usuarios.manage`.
            </p>
          </div>
        </article>
      </section>
    </>
  );
}
