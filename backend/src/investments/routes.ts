import { Router, Request, Response } from "express";
import { PortfolioRepository } from "./portfolio.repository";

const router = Router();

router.get("/portfolio", async (_req: Request, res: Response) => {
  try {
    const [accounts, bySector, byAssetClass] = await Promise.all([
      PortfolioRepository.findAll(),
      PortfolioRepository.allocationBy("sector"),
      PortfolioRepository.allocationBy("asset_class"),
    ]);
    res.json({
      accounts,
      totals: PortfolioRepository.summarize(accounts),
      allocation: { sector: bySector, asset_class: byAssetClass },
    });
  } catch (err) {
    console.error("Failed to fetch portfolio:", err);
    res.status(500).json({ error: "Failed to fetch portfolio" });
  }
});

export default router;
