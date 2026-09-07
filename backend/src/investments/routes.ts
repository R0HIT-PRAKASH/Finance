import { Router, Request, Response } from "express";
import { PortfolioRepository } from "./portfolio.repository";
import { PricesRepository } from "./prices.repository";
import { ActivityRepository } from "./activity.repository";
import { parseInvestorlineActivity } from "../parsers/investorline-activity.parser";

const router = Router();

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
