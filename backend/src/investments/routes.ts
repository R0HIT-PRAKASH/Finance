import { Router, Request, Response } from "express";
import { PortfolioRepository } from "./portfolio.repository";
import { PricesRepository } from "./prices.repository";

const router = Router();

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
