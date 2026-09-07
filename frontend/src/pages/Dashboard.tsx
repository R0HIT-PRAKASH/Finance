import { useEffect, useState } from "react";
import { api, AccountBalance, NetWorth } from "../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/datepicker";

function formatCAD(amount: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

// Investment accounts are valued from holdings snapshots, not transaction
// balances, so they're summarized on the Portfolio page instead.
const TYPE_ORDER = ["chequing", "savings", "credit"];
const TYPE_LABELS: Record<string, string> = {
  chequing: "Chequing",
  savings: "Savings",
  credit: "Credit",
};

type BalanceForm = {
  account: AccountBalance;
  balance: string;
  date: string;
};

export default function Dashboard() {
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorth | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceForm, setBalanceForm] = useState<BalanceForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.accounts.balances(), api.netWorth()])
      .then(([b, nw]) => {
        setBalances(b);
        setNetWorth(nw);
      })
      .finally(() => setLoading(false));
  }, []);

  const grouped = TYPE_ORDER.reduce(
    (acc, type) => {
      acc[type] = balances.filter((a) => a.type === type);
      return acc;
    },
    {} as Record<string, AccountBalance[]>,
  );

  function openBalanceForm(account: AccountBalance) {
    setBalanceForm({
      account,
      balance: account.opening_balance?.toString() ?? "",
      date: new Date().toLocaleDateString("en-CA"),
    });
  }

  async function handleSaveBalance() {
    if (!balanceForm) return;
    setSaving(true);
    try {
      await api.accounts.updateBalance(
        balanceForm.account.id,
        parseFloat(balanceForm.balance),
        balanceForm.date,
      );
      const updated = await api.accounts.balances();
      setBalances(updated);
      setBalanceForm(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-xl font-medium text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your financial overview
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Loading...
        </div>
      ) : (
        <>
          <div className="bg-muted border border-border rounded-xl p-6 mb-4">
            <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Net Worth
            </div>
            <div className="text-4xl font-light font-mono text-foreground tracking-tight">
              {formatCAD(netWorth?.net_worth ?? 0)}
            </div>
            {netWorth && (
              <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-5 gap-y-1">
                <span>Banking {formatCAD(netWorth.banking.total)}</span>
                <span>
                  Investments {formatCAD(netWorth.investments.total)}
                  {netWorth.investments.as_of_latest &&
                    ` (as of ${netWorth.investments.as_of_latest})`}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {TYPE_ORDER.map((type) => {
              const accounts = grouped[type] ?? [];
              if (accounts.length === 0) return null;
              const total = accounts.reduce((s, a) => s + a.balance, 0);

              return (
                <div
                  key={type}
                  className="bg-muted border border-border rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                      {TYPE_LABELS[type]}
                    </div>
                    <div
                      className={`text-sm font-mono font-medium ${total >= 0 ? "text-primary" : "text-destructive"}`}
                    >
                      {formatCAD(total)}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-sm text-foreground">
                            {account.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {account.institution}
                          </div>
                          {account.opening_balance_date && (
                            <div className="text-xs text-muted-foreground/60 font-mono">
                              baseline{" "}
                              {account.opening_balance_date.slice(0, 10)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className={`text-sm font-mono ${account.balance >= 0 ? "text-foreground" : "text-destructive"}`}
                          >
                            {account.opening_balance_date ? (
                              formatCAD(account.balance)
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                no baseline
                              </span>
                            )}
                          </div>
                          {account.registered_type &&
                            account.registered_type !== "none" && (
                              <div className="text-xs text-primary/70 font-mono">
                                {account.registered_type}
                              </div>
                            )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => openBalanceForm(account)}
                          >
                            {account.opening_balance_date
                              ? "Update"
                              : "Set balance"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Set balance dialog */}
      <Dialog
        open={!!balanceForm}
        onOpenChange={(open) => !open && setBalanceForm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {balanceForm?.account.opening_balance_date ? "Update" : "Set"}{" "}
              Balance: {balanceForm?.account.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                Current Balance
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 4823.50 or -1234.56 for credit"
                value={balanceForm?.balance ?? ""}
                onChange={(e) =>
                  setBalanceForm((f) =>
                    f ? { ...f, balance: e.target.value } : f,
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Enter the exact balance shown in your bank right now. Use
                negative for credit card debt.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                As of Date
              </label>
              <DatePicker
                value={balanceForm?.date ?? ""}
                onChange={(date) =>
                  setBalanceForm((f) => (f ? { ...f, date } : f))
                }
                placeholder="Select date"
              />
              <p className="text-xs text-muted-foreground">
                Only transactions after this date will adjust the balance.
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setBalanceForm(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveBalance}
                disabled={saving || !balanceForm?.balance}
              >
                {saving ? "Saving..." : "Save Balance"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
