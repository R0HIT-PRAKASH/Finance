const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  accounts: {
    list: () => request<Account[]>("/accounts"),
    create: (data: CreateAccountInput) =>
      request<Account>("/accounts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<void>(`/accounts/${id}`, { method: "DELETE" }),
    balances: () => request<AccountBalance[]>("/accounts/balances"),
    updateBalance: (
      id: number,
      opening_balance: number,
      opening_balance_date: string,
    ) =>
      request<Account>(`/accounts/${id}/balance`, {
        method: "PATCH",
        body: JSON.stringify({ opening_balance, opening_balance_date }),
      }),
  },
  categories: {
    tree: () => request<CategoryNode[]>("/categories"),
    flat: () => request<FlatCategory[]>("/categories/flat"),
  },
  health: () => request<{ status: string }>("/health"),
  transactions: {
    list: (filters: TransactionFilters = {}) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          params.append(k, String(v));
        }
      });
      return request<{ transactions: Transaction[]; total: number }>(
        `/transactions?${params}`,
      );
    },
    updateCategory: (id: number, category_id: number, save_rule: boolean) =>
      request<Transaction>(`/transactions/${id}/category`, {
        method: "PATCH",
        body: JSON.stringify({ category_id, save_rule }),
      }),
  },
};

export type Account = {
  id: number;
  name: string;
  type: "investment" | "credit" | "chequing" | "savings";
  institution: string;
  registered_type: string;
  currency: string;
  created_at: string;
};

export type CreateAccountInput = Omit<Account, "id" | "created_at">;

export type CategoryNode = {
  id: number;
  name: string;
  parent_id: number | null;
  children: CategoryNode[];
};

export type FlatCategory = {
  id: number;
  name: string;
  parent_name: string | null;
};

export type Transaction = {
  id: number;
  date: string;
  account_id: number;
  account_name: string;
  amount: number;
  currency: string;
  merchant_name: string | null;
  description: string;
  category_id: number | null;
  category_name: string | null;
  category_parent_name: string | null;
  categorization_source: string | null;
  categorization_confidence: string | null;
};

export type TransactionFilters = {
  account_id?: number;
  category_id?: number;
  uncategorized?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type AccountBalance = Account & {
  balance: number;
  opening_balance: number | null;
  opening_balance_date: string | null;
};
