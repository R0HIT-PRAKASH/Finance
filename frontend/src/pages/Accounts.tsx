import { useEffect, useState } from "react";
import { api, Account, CreateAccountInput } from "../api/client";

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showModal, setShowModal] = useState(false);
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
    setShowModal(false);
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
      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2>Accounts</h2>
          <p>All your financial accounts in one place</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Account
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">
            <p>Loading...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <p>No accounts yet. Add your first account to get started.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Institution</th>
                <th>Type</th>
                <th>Registered</th>
                <th>Currency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td style={{ fontWeight: 500 }}>{account.name}</td>
                  <td className="text-muted">{account.institution}</td>
                  <td>
                    <span className="badge">{typeLabel[account.type]}</span>
                  </td>
                  <td>
                    {account.registered_type !== "none" ? (
                      <span className="badge accent">
                        {account.registered_type}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="mono text-muted">{account.currency}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(account.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Add Account</div>

            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                placeholder="e.g. BMO Chequing"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Institution</label>
              <input
                className="form-input"
                placeholder="e.g. BMO, Amex, Canadalife"
                value={form.institution}
                onChange={(e) =>
                  setForm({ ...form, institution: e.target.value })
                }
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as any })
                  }
                >
                  <option value="chequing">Chequing</option>
                  <option value="savings">Savings</option>
                  <option value="credit">Credit</option>
                  <option value="investment">Investment</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Currency</label>
                <select
                  className="form-select"
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Registered Type</label>
              <select
                className="form-select"
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
              </select>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!form.name || !form.institution}
              >
                Add Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
