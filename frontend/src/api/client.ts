const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const message = await res
      .json()
      .then((body) => body?.error)
      .catch(() => null);
    throw new Error(message ?? `API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
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
  investments: {
    portfolio: () => request<PortfolioResponse>("/investments/portfolio"),
  },
  netWorth: () => request<NetWorth>("/net-worth"),
  categorization: {
    groups: (filters: GroupFilters = {}) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
      });
      return request<TransactionGroup[]>(`/categorization/groups?${params}`);
    },
    applyGroup: (
      transaction_ids: number[],
      category_id: number,
      pattern?: string,
    ) =>
      request<{ updated: number }>("/categorization/groups/apply", {
        method: "POST",
        body: JSON.stringify({ transaction_ids, category_id, pattern }),
      }),
    suggest: () =>
      request<{ suggestions: Suggestion[] }>("/categorization/suggest", {
        method: "POST",
      }),
    rules: () => request<Rule[]>("/categorization/rules"),
    createRule: (pattern: string, category_id: number) =>
      request<Rule>("/categorization/rules", {
        method: "POST",
        body: JSON.stringify({ pattern, category_id }),
      }),
    deleteRule: (id: number) =>
      request<void>(`/categorization/rules/${id}`, { method: "DELETE" }),
    applyRules: () =>
      request<{ updated: number }>("/categorization/rules/apply", {
        method: "POST",
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

export type CreateAccountInput = Omit<Account, "id" | "created_at"> & {
  opening_balance?: number;
  opening_balance_date?: string;
};

export type CategoryNode = {
  id: number;
  name: string;
  parent_id: number | null;
  children: CategoryNode[];
};

export type CategoryKind = "income" | "expense" | "transfer";

/** Leaf categories only — parent nodes exist for rollup, not assignment. */
export type FlatCategory = {
  id: number;
  name: string;
  kind: CategoryKind;
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

export type GroupFilters = {
  account_id?: number;
  from?: string;
  to?: string;
};

export type GroupedTransaction = {
  id: number;
  date: string;
  description: string;
  amount: number;
};

export type TransactionGroup = {
  pattern: string;
  count: number;
  total_amount: number;
  rulable: boolean;
  /** False for person-to-person transfers — each needs its own category. */
  bulk_assignable: boolean;
  transactions: GroupedTransaction[];
};

export type Position = {
  security: string;
  description: string | null;
  asset_class: string | null;
  sector: string | null;
  units: number;
  settlement_currency: string;
  average_cost: number | null;
  current_price: number | null;
  market_value_cad: number;
  book_value_cad: number | null;
  unrealized_gain_cad: number | null;
};

export type CashBalance = {
  currency: string;
  amount: number;
  amount_cad: number;
  /** True when no snapshot-date FX rate existed, so amount_cad is unconverted. */
  rate_missing: boolean;
};

export type AccountPortfolio = {
  account_id: number;
  account_name: string;
  institution: string;
  registered_type: string;
  /** Null when the account has no holdings snapshot yet. */
  as_of: string | null;
  market_value_cad: number;
  cash_cad: number;
  /** Securities plus cash. */
  total_value_cad: number;
  /** Null when the source reports no lifetime cost basis (e.g. group plans). */
  book_value_cad: number | null;
  unrealized_gain_cad: number | null;
  unrealized_pct: number | null;
  cash: CashBalance[];
  positions: Position[];
};

export type Allocation = {
  label: string;
  market_value_cad: number;
  percentage: number;
};

export type PortfolioTotals = {
  securities_cad: number;
  cash_cad: number;
  total_value_cad: number;
  /** Gain figures cover only holdings with a known cost basis. */
  book_value_cad: number;
  unrealized_gain_cad: number;
  unrealized_pct: number;
  /** Market value excluded from the gain figures for lack of a cost basis. */
  market_value_without_basis: number;
  accounts_without_basis: number;
  as_of_earliest: string | null;
  as_of_latest: string | null;
  funded_accounts: number;
};

export type PortfolioResponse = {
  accounts: AccountPortfolio[];
  totals: PortfolioTotals;
  allocation: { sector: Allocation[]; asset_class: Allocation[] };
};

export type NetWorth = {
  banking: {
    chequing: number;
    savings: number;
    credit: number;
    total: number;
  };
  investments: {
    total: number;
    book_value_cad: number;
    unrealized_gain_cad: number;
    unrealized_pct: number;
    as_of_latest: string | null;
    funded_accounts: number;
  };
  net_worth: number;
};

export type Suggestion = {
  key: string;
  category_id: number | null;
  confidence: "high" | "low";
};

export type Rule = {
  id: number;
  pattern: string;
  category_id: number;
  category_name: string | null;
  category_parent_name: string | null;
  source: string;
  created_at: string;
};

export type AccountBalance = Account & {
  balance: number;
  opening_balance: number | null;
  opening_balance_date: string | null;
};
