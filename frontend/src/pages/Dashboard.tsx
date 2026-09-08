import { useEffect, useState } from "react";
import { api, AccountBalance, NetWorth } from "../api/client";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
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
        <p className="text-sm text-muted mt-1">Your financial overview</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted text-sm">Loading...</div>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-xl p-6 mb-4">
            <div className="text-sm text-muted mb-2">Net worth</div>
            <div className="text-4xl font-light font-mono text-foreground tracking-tight">
              {formatCAD(netWorth?.net_worth ?? 0)}
            </div>
            {netWorth && (
              <div className="text-xs text-muted mt-2 flex flex-wrap gap-x-5 gap-y-1">
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
                  className="bg-surface border border-border rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-medium text-muted">
                      {TYPE_LABELS[type]}
                    </div>
                    <div
                      className={`text-sm font-mono font-medium ${
                        total >= 0 ? "text-success" : "text-danger"
                      }`}
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
                          <div className="text-xs text-muted">
                            {account.institution}
                          </div>
                          {account.opening_balance_date && (
                            <div className="text-xs text-muted/60 font-mono">
                              baseline{" "}
                              {account.opening_balance_date.slice(0, 10)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className={`text-sm font-mono ${
                              account.balance >= 0
                                ? "text-foreground"
                                : "text-danger"
                            }`}
                          >
                            {account.opening_balance_date ? (
                              formatCAD(account.balance)
                            ) : (
                              <span className="text-muted text-xs">
                                no baseline
                              </span>
                            )}
                          </div>
                          {account.registered_type &&
                            account.registered_type !== "none" && (
                              <div className="text-xs text-accent font-mono">
                                {account.registered_type}
                              </div>
                            )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={() => openBalanceForm(account)}
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

      <Modal.Backdrop
        isOpen={!!balanceForm}
        onOpenChange={(open) => !open && setBalanceForm(null)}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {balanceForm?.account.opening_balance_date ? "Update" : "Set"}{" "}
                balance: {balanceForm?.account.name}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <TextField
                  fullWidth
                  type="number"
                  value={balanceForm?.balance ?? ""}
                  onChange={(balance) =>
                    setBalanceForm((f) => (f ? { ...f, balance } : f))
                  }
                >
                  <Label>Current balance</Label>
                  <Input
                    step="0.01"
                    placeholder="e.g. 4823.50 or -1234.56 for credit"
                  />
                </TextField>
                <p className="text-xs text-muted">
                  Enter the exact balance shown in your bank right now. Use
                  negative for credit card debt.
                </p>

                <div className="space-y-1.5">
                  <Label>As of date</Label>
                  <DatePicker
                    value={balanceForm?.date ?? ""}
                    onChange={(date) =>
                      setBalanceForm((f) => (f ? { ...f, date } : f))
                    }
                    placeholder="Select date"
                  />
                  <p className="text-xs text-muted">
                    Only transactions after this date will adjust the balance.
                  </p>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setBalanceForm(null)}>
                Cancel
              </Button>
              <Button
                isDisabled={saving || !balanceForm?.balance}
                isPending={saving}
                onPress={handleSaveBalance}
              >
                {saving ? "Saving..." : "Save balance"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
