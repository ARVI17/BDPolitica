"use client";

import { FormEvent, useState } from "react";

type LoginResponse = {
  accessToken: string;
  user: {
    tenantId: string;
    username: string;
    roles: string[];
  };
};

export default function LoginPage() {
  const [tenantCode, setTenantCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Validando...");

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          tenantCode,
          username,
          password
        })
      });

      if (!response.ok) {
        setMessage("Credenciales invalidas");
        return;
      }

      const data = (await response.json()) as LoginResponse;
      setMessage(`Sesion iniciada: ${data.user.username} (${data.user.roles.join(", ")})`);
    } catch {
      setMessage("No fue posible conectar con la API.");
    }
  }

  return (
    <section className="card" style={{ maxWidth: 540 }}>
      <h1>Login MVP</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label>
          Tenant code
          <input
            className="input"
            value={tenantCode}
            required
            onChange={(event) => setTenantCode(event.target.value)}
          />
        </label>
        <label>
          Usuario
          <input
            className="input"
            value={username}
            required
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          Contrasena
          <input
            className="input"
            type="password"
            value={password}
            required
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="btn" type="submit">
          Ingresar
        </button>
      </form>
      <p>{message}</p>
    </section>
  );
}
