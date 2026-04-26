import { useEffect, useState } from "react";
import { api, Account, CreateAccountInput } from "../api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateAccountInput>({
    name: "",
    type: "chequing",
    institution: "",
    registered_type: "none",
    currency: "CAD",
  });

  useEffect(() => {
    api.accounts
      .list()
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const account = await api.accounts.create(form);
    setAccounts((prev) => [...prev, account]);
    setOpen(false);
    setForm({
      name: "",
      type: "chequing",
      institution: "",
      registered_type: "none",
      currency: "CAD",
    });
  }

  async function handleDelete(id: number) {
    await api.accounts.delete(id);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  const typeLabel: Record<string, string> = {
    investment: "Investment",
    credit: "Credit",
    chequing: "Chequing",
    savings: "Savings",
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h2 className="text-xl font-medium text-foreground">Accounts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            All your financial accounts in one place
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Add Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </label>
                <Input
                  placeholder="e.g. BMO Chequing"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                  Institution
                </label>
                <Input
                  placeholder="e.g. BMO, Amex, Canadalife"
                  value={form.institution}
                  onChange={(e) =>
                    setForm({ ...form, institution: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                    Type
                  </label>
                  <Select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as any })
                    }
                  >
                    <option value="chequing">Chequing</option>
                    <option value="savings">Savings</option>
                    <option value="credit">Credit</option>
                    <option value="investment">Investment</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                    Currency
                  </label>
                  <Select
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value })
                    }
                  >
                    <option value="CAD">CAD</option>
                    <option value="USD">USD</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                  Registered Type
                </label>
                <Select
                  value={form.registered_type}
                  onChange={(e) =>
                    setForm({ ...form, registered_type: e.target.value })
                  }
                >
                  <option value="none">None</option>
                  <option value="TFSA">TFSA</option>
                  <option value="RRSP">RRSP</option>
                  <option value="FHSA">FHSA</option>
                  <option value="DPSP">DPSP</option>
                  <option value="Non-registered">Non-registered</option>
                </Select>
              </div>
              <div className="flex gap-2.5 justify-end pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!form.name || !form.institution}
                >
                  Add Account
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-muted border border-border rounded-xl">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No accounts yet. Add your first account to get started.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {[
                  "Name",
                  "Institution",
                  "Type",
                  "Registered",
                  "Currency",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground px-4 py-3 border-b border-border"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="group hover:bg-background/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium">
                    {account.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {account.institution}
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{typeLabel[account.type]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {account.registered_type !== "none" ? (
                      <Badge variant="accent">{account.registered_type}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                    {account.currency}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(account.id)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
