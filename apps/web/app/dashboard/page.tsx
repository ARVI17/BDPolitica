export default function DashboardPage() {
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <h1>Dashboard MVP</h1>
        <p>Indicadores base para control operativo de campana.</p>
      </div>
      <div className="grid">
        <div className="card kpi">
          <span>Coordinadores</span>
          <strong>0</strong>
        </div>
        <div className="card kpi">
          <span>Lideres</span>
          <strong>0</strong>
        </div>
        <div className="card kpi">
          <span>Votantes</span>
          <strong>0</strong>
        </div>
        <div className="card kpi">
          <span>Listados abiertos</span>
          <strong>0</strong>
        </div>
      </div>
    </section>
  );
}
