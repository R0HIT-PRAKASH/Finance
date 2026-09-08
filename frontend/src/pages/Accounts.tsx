import { useEffect, useState } from "react";
import { api, Account, CreateAccountInput } from "../api/client";
import {
  Button,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Table,
  TextField,
} from "@heroui/react";
import { DatePicker } from "@/components/ui/datepicker";

const TYPE_OPTIONS = [
  { id: "chequing", label: "Chequing" },
  { id: "savings", label: "Savings" },
  { id: "credit", label: "Credit" },
  { id: "investment", label: "Investment" },
];

const CURRENCY_OPTIONS = [
  { id: "CAD", label: "CAD" },
  { id: "USD", label: "USD" },
];

const REGISTERED_OPTIONS = [
  { id: "none", label: "None" },
  { id: "TFSA", label: "TFSA" },
  { id: "RRSP", label: "RRSP" },
  { id: "FHSA", label: "FHSA" },
  { id: "DPSP", label: "DPSP" },
  { id: "Non-registered", label: "Non-registered" },
];

const EMPTY_FORM: CreateAccountInput = {
  name: "",
  type: "chequing",
  institution: "",
  registered_type: "none",
  currency: "CAD",
  opening_balance: 0,
  opening_balance_date: "",
};

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateAccountInput>(EMPTY_FORM);

  useEffect(() => {
    api.accounts
      .list()
      // Investment accounts live on the Portfolio page.
      .then((all) => setAccounts(all.filter((a) => a.type !== "investment")))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const account = await api.accounts.create(form);
    setAccounts((prev) => [...prev, account]);
    setOpen(false);
    setForm(EMPTY_FORM);
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
          <p className="text-sm text-muted mt-1">
            All your financial accounts in one place
          </p>
        </div>
        <Button onPress={() => setOpen(true)}>Add account</Button>
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-xl text-center py-16 text-muted text-sm">
          Loading...
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl text-center py-16 text-muted text-sm">
          No accounts yet. Add your first account to get started.
        </div>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Accounts">
              <Table.Header>
                <Table.Column isRowHeader>Name</Table.Column>
                <Table.Column>Institution</Table.Column>
                <Table.Column>Type</Table.Column>
                <Table.Column>Registered</Table.Column>
                <Table.Column>Currency</Table.Column>
                <Table.Column>{""}</Table.Column>
              </Table.Header>
              <Table.Body>
                {accounts.map((account) => (
                  <Table.Row key={account.id}>
                    <Table.Cell className="font-medium">
                      {account.name}
                    </Table.Cell>
                    <Table.Cell className="text-muted">
                      {account.institution}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm">{typeLabel[account.type]}</Chip>
                    </Table.Cell>
                    <Table.Cell>
                      {account.registered_type !== "none" ? (
                        <Chip color="accent" size="sm">
                          {account.registered_type}
                        </Chip>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="font-mono text-muted">
                      {account.currency}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onPress={() => handleDelete(account.id)}
                      >
                        Remove
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Add account</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <TextField
                  fullWidth
                  value={form.name}
                  onChange={(name) => setForm({ ...form, name })}
                >
                  <Label>Name</Label>
                  <Input placeholder="e.g. BMO Chequing" />
                </TextField>

                <TextField
                  fullWidth
                  value={form.institution}
                  onChange={(institution) => setForm({ ...form, institution })}
                >
                  <Label>Institution</Label>
                  <Input placeholder="e.g. BMO, Amex, Canadalife" />
                </TextField>

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    fullWidth
                    value={form.type}
                    onChange={(value) =>
                      setForm({ ...form, type: String(value) as any })
                    }
                  >
                    <Label>Type</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {TYPE_OPTIONS.map((o) => (
                          <ListBox.Item
                            key={o.id}
                            id={o.id}
                            textValue={o.label}
                          >
                            {o.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <Select
                    fullWidth
                    value={form.currency}
                    onChange={(value) =>
                      setForm({ ...form, currency: String(value) })
                    }
                  >
                    <Label>Currency</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {CURRENCY_OPTIONS.map((o) => (
                          <ListBox.Item
                            key={o.id}
                            id={o.id}
                            textValue={o.label}
                          >
                            {o.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <Select
                  fullWidth
                  value={form.registered_type}
                  onChange={(value) =>
                    setForm({ ...form, registered_type: String(value) })
                  }
                >
                  <Label>Registered type</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {REGISTERED_OPTIONS.map((o) => (
                        <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                          {o.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    fullWidth
                    type="number"
                    value={form.opening_balance?.toString() ?? ""}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        opening_balance: value === "" ? 0 : parseFloat(value),
                      })
                    }
                  >
                    <Label>Opening balance</Label>
                    <Input step="0.01" placeholder="0.00" />
                  </TextField>

                  <div className="space-y-1.5">
                    <Label>As of date</Label>
                    <DatePicker
                      value={form.opening_balance_date ?? ""}
                      onChange={(opening_balance_date) =>
                        setForm({ ...form, opening_balance_date })
                      }
                      placeholder="Select date"
                    />
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                isDisabled={!form.name || !form.institution}
                onPress={handleCreate}
              >
                Add account
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
