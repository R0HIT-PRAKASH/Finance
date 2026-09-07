import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Shallow task: map a short merchant string to one id from a fixed list. Every
// result is confirmed by hand before it applies, so errors are cheap and visible.
const MODEL = "claude-haiku-4-5";

export type TaxonomyEntry = {
  id: number;
  name: string;
  parent_name: string | null;
  kind: string;
};

export type LabeledExample = {
  description: string;
  category_id: number;
};

export type Merchant = {
  key: string;
  total_amount: number;
  count: number;
};

export type Suggestion = {
  key: string;
  category_id: number | null;
  confidence: "high" | "low";
};

const ResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      key: z.string(),
      category_id: z.number().nullable(),
      confidence: z.enum(["high", "low"]),
    }),
  ),
});

const SYSTEM = `You categorize bank transaction merchant keys for a personal finance app.

Each key is a normalized merchant name derived from raw bank descriptions, with noise
(store numbers, cities, reference codes) already stripped. Assign each key exactly one
category id from the taxonomy.

Each merchant comes with the net amount across its transactions. The sign is a hard
constraint, not a hint:
- A positive net means money came in. Only an [income] or [transfer] category is valid.
- A negative net means money went out. Only an [expense] or [transfer] category is valid.
An inflow is never an expense, however much the merchant name looks like one, a
payment from an employer is income even if that employer also sells software.

Rules:
- Only use ids from the taxonomy. Never invent one.
- If a key is too ambiguous to categorize confidently, return null for category_id.
- Use confidence "low" when the merchant could plausibly fit several categories
  (a warehouse store selling both groceries and electronics, an ambiguous acronym),
  and "high" only when the merchant clearly determines the category.
- The user's own past categorizations are the authority on their preferences.
  When an example conflicts with your instinct, follow the example.
- Return one entry for every key you are given, in the same order.`;

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function formatTaxonomy(taxonomy: TaxonomyEntry[]): string {
  return taxonomy
    .map(
      (c) =>
        `${c.id}: ${c.parent_name ? `${c.parent_name} > ${c.name}` : c.name} [${c.kind}]`,
    )
    .join("\n");
}

export async function classifyMerchants(input: {
  merchants: Merchant[];
  taxonomy: TaxonomyEntry[];
  examples: LabeledExample[];
}): Promise<Suggestion[]> {
  if (input.merchants.length === 0) return [];

  // An API key not scoped to a workspace must name one on every request.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic(
    workspaceId
      ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } }
      : {},
  );

  const examples = input.examples.length
    ? `The user previously categorized these transactions themselves:\n${input.examples
        .map((e) => `${e.description} -> ${e.category_id}`)
        .join("\n")}\n\n`
    : "";

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: `${SYSTEM}\n\nTaxonomy:\n${formatTaxonomy(input.taxonomy)}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `${examples}Categorize these merchants:\n${input.merchants
          .map(
            (m) =>
              `${m.key} (net ${m.total_amount >= 0 ? "+" : ""}${m.total_amount.toFixed(2)} across ${m.count})`,
          )
          .join("\n")}`,
      },
    ],
    output_config: { format: zodOutputFormat(ResponseSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) return [];

  const byId = new Map(input.taxonomy.map((c) => [c.id, c]));
  const byKey = new Map(input.merchants.map((m) => [m.key, m]));

  return parsed.suggestions
    .filter((s) => byKey.has(s.key))
    .map((s) => {
      const category = s.category_id === null ? null : byId.get(s.category_id);
      // Drop hallucinated ids, and any category whose kind contradicts the
      // direction of the money, an inflow is never an expense.
      if (s.category_id !== null && !category) return { ...s, category_id: null };
      if (category && category.kind !== "transfer") {
        const isInflow = byKey.get(s.key)!.total_amount >= 0;
        const contradicts =
          (isInflow && category.kind === "expense") ||
          (!isInflow && category.kind === "income");
        if (contradicts) return { ...s, category_id: null, confidence: "low" as const };
      }
      return s;
    });
}
