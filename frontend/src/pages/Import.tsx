import { useEffect, useState } from "react";
import { api, Account } from "../api/client";
import { Button, Label, ListBox, Select, Table } from "@heroui/react";

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
      const parts = [`Imported ${data.imported} transactions`];
      if (data.skipped) {
        parts.push(`${data.skipped} already on file`);
      }
      if (data.paired) {
        parts.push(
          `${data.paired} transfer${data.paired === 1 ? "" : "s"} matched`,
        );
      }
      setSuccess(parts.join(" · "));
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
        <p className="text-sm text-muted mt-1">
          Import transactions from your bank exports
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Select
              fullWidth
              placeholder="Select account"
              value={accountId || null}
              onChange={(value) => setAccountId(value ? String(value) : "")}
            >
              <Label>Account</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {accounts.map((a) => (
                    <ListBox.Item
                      key={a.id}
                      id={String(a.id)}
                      textValue={a.name}
                    >
                      {a.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            {parserLabel && (
              <p className="text-xs text-muted">
                Using parser: <span className="text-accent">{parserLabel}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>CSV file</Label>
            <div
              className="border border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent/40 transition-colors"
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
                <p className="text-sm text-muted">Click to select a CSV file</p>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-danger-soft-foreground bg-danger-soft border border-danger/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-accent-soft-foreground bg-accent-soft border border-accent/20 rounded-lg px-4 py-3">
              {success}
            </div>
          )}

          <Button
            isDisabled={!csvContent || !accountId || loading}
            isPending={loading}
            onPress={handleImport}
          >
            {loading ? "Importing..." : "Import transactions"}
          </Button>
        </div>
      </div>

      {imported.length > 0 && (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Imported transactions">
              <Table.Header>
                <Table.Column isRowHeader>Date</Table.Column>
                <Table.Column>Description</Table.Column>
                <Table.Column>Amount</Table.Column>
              </Table.Header>
              <Table.Body>
                {imported.map((tx) => (
                  <Table.Row key={tx.id}>
                    <Table.Cell className="font-mono text-muted">
                      {tx.date.slice(0, 10)}
                    </Table.Cell>
                    <Table.Cell>{tx.description}</Table.Cell>
                    <Table.Cell
                      className={`font-mono ${
                        Number(tx.amount) >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {Number(tx.amount) >= 0 ? "+" : ""}
                      {Number(tx.amount).toFixed(2)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  );
}
