import { ArrowRight, ShieldCheck, Users, Workflow } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="card hero">
        <h2 className="title title-xl">Control operativo real para campañas multi-tenant</h2>
        <p className="subtitle">
          Seguridad de sesión avanzada, auditoría trazable, RBAC por permisos y gestión
          profesional de usuarios en un entorno Docker-first listo para producción.
        </p>
        <div className="actions" style={{ marginTop: 14 }}>
          <Link className="btn btn-primary" href="/login">
            Entrar al panel
          </Link>
          <Link className="btn btn-soft" href="/usuarios">
            Gestionar usuarios <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="grid grid-3">
        <article className="card stack">
          <ShieldCheck size={20} />
          <h3 className="title">Seguridad aplicada</h3>
          <p className="muted">
            Access + refresh rotativo, detección de reuse, MFA para admin y control por
            tenant.
          </p>
        </article>
        <article className="card stack">
          <Users size={20} />
          <h3 className="title">Gestión de usuarios</h3>
          <p className="muted">
            Alta, filtros operativos, activación/desactivación y asignación de rol por
            endpoint seguro.
          </p>
        </article>
        <article className="card stack">
          <Workflow size={20} />
          <h3 className="title">Operatividad + CI</h3>
          <p className="muted">
            Pipeline Docker QA y branch protection para evitar merges con calidad
            incompleta.
          </p>
        </article>
      </section>
    </>
  );
}
