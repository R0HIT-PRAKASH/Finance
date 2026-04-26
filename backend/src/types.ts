export type CreateAccountInput = {
  name: string;
  type: "investment" | "credit" | "chequing" | "savings";
  institution: string;
  registered_type?: string;
  currency?: string;
};
