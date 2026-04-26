export default function Dashboard() {
  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Your financial overview</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Net Worth</div>
        <div className="empty-state">
          <p>Add accounts and import transactions to see your net worth here.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Spending This Month</div>
          <div className="empty-state" style={{ padding: "32px 0" }}>
            <p>No transactions yet</p>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Portfolio Value</div>
          <div className="empty-state" style={{ padding: "32px 0" }}>
            <p>No holdings yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
