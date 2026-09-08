import { Router, Request, Response } from "express";
import { PortfolioRepository } from "./portfolio.repository";
import { PricesRepository } from "./prices.repository";
import { ActivityRepository } from "./activity.repository";
import { HoldingsRepository } from "./holdings.repository";
import { PerformanceRepository } from "./performance.repository";
import { ReturnsRepository } from "./returns.repository";
import { MetadataRepository } from "./metadata.repository";
import { ExposureRepository } from "./exposure.repository";
import { PlanSummaryRepository } from "./plan-summary.repository";
import { pdfToText } from "./pdf";
import { parseCanadaLifeSummary } from "../parsers/canadalife-summary.parser";
import { parseInvestorlineActivity } from "../parsers/investorline-activity.parser";
import { parseInvestorlineHoldings } from "../parsers/investorline-holdings.parser";

const router = Router();

// Also self-routing: the report header carries the account number and date.
router.post("/holdings/import", async (req: Request, res: Response) => {
  const { csv_content } = req.body;
  if (!csv_content) {
    res.status(400).json({ error: "csv_content is required" });
    return;
  }

  try {
    const report = parseInvestorlineHoldings(csv_content);
    res.status(201).json(await HoldingsRepository.importReport(report));
  } catch (err) {
    // Reconciliation and routing failures are the user's to act on, not bugs.
    const message = err instanceof Error ? err.message : "Import failed";
    console.error("Failed to import holdings:", err);
    res.status(400).json({ error: message });
  }
});

// No account is named: every row carries its own account number.
router.post("/activity/import", async (req: Request, res: Response) => {
  const { csv_content } = req.body;
  if (!csv_content) {
    res.status(400).json({ error: "csv_content is required" });
    return;
  }

  try {
    const rows = parseInvestorlineActivity(csv_content);
    if (rows.length === 0) {
      res.status(400).json({ error: "No activity rows found in file" });
      return;
    }
    res.status(201).json(await ActivityRepository.importRows(rows));
  } catch (err) {
    console.error("Failed to import activity:", err);
    res.status(500).json({ error: "Failed to import activity" });
  }
});

// Group-plan statements arrive as PDF, so the file is posted base64 encoded.
router.post("/plan-summary/import", async (req: Request, res: Response) => {
  const { pdf_base64 } = req.body;
  if (!pdf_base64) {
    res.status(400).json({ error: "pdf_base64 is required" });
    return;
  }
  try {
    const text = await pdfToText(Buffer.from(pdf_base64, "base64"));
    const summary = parseCanadaLifeSummary(text);
    res.status(201).json(await PlanSummaryRepository.save(summary));
  } catch (err) {
    console.error("Failed to import plan summary:", err);
    const message = err instanceof Error ? err.message : "Import failed";
    res.status(400).json({ error: message });
  }
});

router.get("/plan-summary", async (_req: Request, res: Response) => {
  try {
    res.json(await PlanSummaryRepository.findAll());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plan summaries" });
  }
});

router.get("/exposure", async (req: Request, res: Response) => {
  try {
    const accountId = req.query.account_id
      ? parseInt(req.query.account_id as string)
      : undefined;
    res.json(await ExposureRepository.find(accountId));
  } catch (err) {
    console.error("Failed to compute exposure:", err);
    res.status(500).json({ error: "Failed to compute exposure" });
  }
});

router.get("/returns", async (req: Request, res: Response) => {
  try {
    const accountId = req.query.account_id
      ? parseInt(req.query.account_id as string)
      : undefined;
    res.json(await ReturnsRepository.summary(accountId));
  } catch (err) {
    console.error("Failed to compute returns:", err);
    res.status(500).json({ error: "Failed to compute returns" });
  }
});

router.get("/performance", async (req: Request, res: Response) => {
  try {
    const accountId = req.query.account_id
      ? parseInt(req.query.account_id as string)
      : undefined;
    res.json(await PerformanceRepository.series(accountId));
  } catch (err) {
    console.error("Failed to build performance series:", err);
    res.status(500).json({ error: "Failed to build performance series" });
  }
});

router.post("/metadata/refresh", async (_req: Request, res: Response) => {
  try {
    res.json(await MetadataRepository.refresh());
  } catch (err) {
    console.error("Failed to refresh metadata:", err);
    res.status(500).json({ error: "Failed to refresh metadata" });
  }
});

router.post("/prices/backfill", async (req: Request, res: Response) => {
  try {
    res.json(await PricesRepository.backfill(req.body?.from, req.body?.to));
  } catch (err) {
    console.error("Failed to backfill prices:", err);
    const message = err instanceof Error ? err.message : "Backfill failed";
    res.status(500).json({ error: message });
  }
});

router.post("/prices/refresh", async (_req: Request, res: Response) => {
  try {
    res.json(await PricesRepository.refresh());
  } catch (err) {
    console.error("Failed to refresh prices:", err);
    res.status(500).json({ error: "Failed to refresh prices" });
  }
});

router.get("/portfolio", async (_req: Request, res: Response) => {
  try {
    const [accounts, positions, bySector, byAssetClass] = await Promise.all([
      PortfolioRepository.findAll(),
      PortfolioRepository.consolidatedPositions(),
      PortfolioRepository.allocationBy("sector"),
      PortfolioRepository.allocationBy("asset_class"),
    ]);
    res.json({
      accounts,
      positions,
      totals: PortfolioRepository.summarize(accounts),
      allocation: { sector: bySector, asset_class: byAssetClass },
    });
  } catch (err) {
    console.error("Failed to fetch portfolio:", err);
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

export default router;
