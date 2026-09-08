import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import accountsRouter from "./routes/accounts";
import categoriesRouter from "./routes/categories";
import importRouter from "./routes/import";
import transactionsRouter from "./routes/transactions";
import categorizationRouter from "./categorization/routes";
import investmentsRouter from "./investments/routes";
import netWorthRouter from "./routes/net-worth";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json({ limit: "20mb" })); // PDFs arrive base64 encoded

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/accounts", accountsRouter);
app.use("/categories", categoriesRouter);
app.use("/import", importRouter);
app.use("/transactions", transactionsRouter);
app.use("/categorization", categorizationRouter);
app.use("/investments", investmentsRouter);
app.use("/net-worth", netWorthRouter);

app.listen(PORT, () => {
  console.log(`FinTrack backend running on port ${PORT}`);
});

export default app;
