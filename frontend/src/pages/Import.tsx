import { useEffect, useState } from "react";
import { api, Account } from "../api/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// Must match what getParser() expects on the backend
const SUPPORTED = [
  { institution: "bmo", type: "chequing", label: "BMO Chequing" },
  { institution: "bmo", type: "savings", label: "BMO Savings" },
  { institution: "amex", type: "credit", label: "Amex Credit Card" },
];

function getParserLabel(account: Account): string | null {
  const match = SUPPORTED.find(
    (s) =>
      account.institution.toLowerCase().startsWith(s.institution) &&
      account.type === s.type,
  );
  return match?.label ?? null;
}

type ImportedTransaction = {
  id: number;
  date: string;
  amount: number;
  description: string;
  account_id: number;
};

export default function Import() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [csvContent, setCsvContent] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [imported, setImported] = useState<ImportedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api.accounts.list().then((all) => {
      // Only show accounts we have a parser for
      const supported = all.filter((a) => getParserLabel(a) !== null);
      setAccounts(supported);
      if (supported.length > 0) setAccountId(String(supported[0].id));
    });
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCsvContent(ev.target?.result as string);
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!accountId || !csvContent) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API_URL}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: parseInt(accountId),
          csv_content: csvContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Import failed");
      }

      const data = await res.json();
      setImported(data.transactions);
      setSuccess(`Successfully imported ${data.imported} transactions`);
      setCsvContent("");
      setFilename("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedAccount = accounts.find((a) => String(a.id) === accountId);
  const parserLabel = selectedAccount ? getParserLabel(selectedAccount) : null;

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-xl font-medium text-foreground">Import</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Import transactions from your bank exports
        </p>
      </div>

      <div className="bg-muted border border-border rounded-xl p-6 mb-6">
        <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground mb-5">
          Import Transactions
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
              Account
            </label>
            <Select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            {parserLabel && (
              <p className="text-xs text-muted-foreground">
                Using parser:{" "}
                <span className="text-primary font-mono">{parserLabel}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
              CSV File
            </label>
            <div
              className="border border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => document.getElementById("csv-input")?.click()}
            >
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFile}
              />
              {filename ? (
                <p className="text-sm text-foreground font-mono">{filename}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Click to select a CSV file
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
              {success}
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={!csvContent || !accountId || loading}
          >
            {loading ? "Importing..." : "Import Transactions"}
          </Button>
        </div>
      </div>

      {imported.length > 0 && (
        <div className="bg-muted border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
              Imported Transactions
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                {["Date", "Description", "Amount"].map((h) => (
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
              {imported.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-background/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                    {tx.date.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-sm">{tx.description}</td>
                  <td
                    className={`px-4 py-3 text-sm font-mono ${Number(tx.amount) >= 0 ? "text-primary" : "text-destructive"}`}
                  >
                    {Number(tx.amount) >= 0 ? "+" : ""}
                    {Number(tx.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
