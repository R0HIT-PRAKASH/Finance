import pool from "./pool";
import dotenv from "dotenv";
dotenv.config();

type CategoryKind = "income" | "expense" | "transfer";

type CategoryNode = {
  name: string;
  children?: CategoryNode[];
};

/** Only roots declare a kind, descendants inherit it. */
const categoryTree: (CategoryNode & { kind: CategoryKind })[] = [
  {
    name: "Income",
    kind: "income",
    children: [
      { name: "Salary" },
      { name: "Bonus" },
      { name: "RSU Vest" },
      { name: "Dividend Income" },
      { name: "Interest Income" },
      { name: "Tax Refund" },
    ],
  },
  {
    name: "Living Expenses",
    kind: "expense",
    children: [
      {
        name: "Food",
        children: [
          { name: "Groceries" },
          { name: "Dining Out" },
          { name: "Coffee" },
        ],
      },
      {
        name: "Housing",
        children: [
          { name: "Rent" },
          { name: "Utilities" },
          { name: "Internet" },
          { name: "Phone" },
        ],
      },
      {
        name: "Transport",
        children: [{ name: "Gas" }, { name: "Transit" }, { name: "Parking" }],
      },
      {
        name: "Health",
        children: [{ name: "Pharmacy" }, { name: "Fitness" }],
      },
    ],
  },
  {
    name: "Discretionary",
    kind: "expense",
    children: [
      { name: "Shopping" },
      { name: "Entertainment" },
      { name: "Travel" },
      { name: "Personal Care" },
    ],
  },
  {
    name: "Subscriptions",
    kind: "expense",
    children: [
      { name: "Streaming" },
      { name: "Software" },
      { name: "Other" },
    ],
  },
  {
    name: "Investments",
    kind: "transfer",
    children: [
      { name: "Purchase" },
      { name: "Sale" },
      { name: "Contribution" },
      { name: "Withdrawal" },
    ],
  },
  {
    name: "Transfers",
    kind: "transfer",
    children: [
      { name: "Credit Card Payment" },
      { name: "Interac Transfer" },
    ],
  },
];

async function insertCategory(
  client: any,
  node: CategoryNode,
  kind: CategoryKind,
  parentId: number | null = null
): Promise<void> {
  const result = await client.query(
    `INSERT INTO categories (name, parent_id, kind)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [node.name, parentId, kind]
  );

  if (result.rows.length === 0) {
    console.log(`  Skipped (already exists): ${node.name}`);
    return;
  }

  const id = result.rows[0].id;
  console.log(`  Inserted: ${node.name} (id: ${id})`);

  if (node.children) {
    for (const child of node.children) {
      await insertCategory(client, child, kind, id);
    }
  }
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Seeding categories...");
    for (const root of categoryTree) {
      await insertCategory(client, root, root.kind);
    }
    console.log("Seed complete.");
  } catch (err) {
    console.error("Seed failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
