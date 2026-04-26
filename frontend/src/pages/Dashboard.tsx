export default function Dashboard() {
  return (
    <div>
      <div className="mb-7">
        <h2 className="text-xl font-medium text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your financial overview
        </p>
      </div>
      <div className="bg-muted border border-border rounded-xl p-5 mb-4">
        <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-4">
          Net Worth
        </div>
        <div className="text-center py-10 text-muted-foreground text-sm">
          Add accounts and import transactions to see your net worth here.
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted border border-border rounded-xl p-5">
          <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Spending This Month
          </div>
          <div className="text-center py-8 text-muted-foreground text-sm">
            No transactions yet
          </div>
        </div>
        <div className="bg-muted border border-border rounded-xl p-5">
          <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Portfolio Value
          </div>
          <div className="text-center py-8 text-muted-foreground text-sm">
            No holdings yet
          </div>
        </div>
      </div>
    </div>
  );
}
