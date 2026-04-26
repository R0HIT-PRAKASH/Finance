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
  },
  categories: {
    tree: () => request<CategoryNode[]>("/categories"),
    flat: () => request<FlatCategory[]>("/categories/flat"),
  },
  health: () => request<{ status: string }>("/health"),
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
