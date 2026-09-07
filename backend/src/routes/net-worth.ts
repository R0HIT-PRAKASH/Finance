import { Router, Request, Response } from "express";
import { AccountRepository } from "../repositories/accounts.repository";
import { PortfolioRepository } from "../investments/portfolio.repository";

const router = Router();

/**
 * The only place the banking and investment domains combine. Computing it here
 * keeps every page showing the same number instead of each deriving its own.
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [balances, portfolios] = await Promise.all([
      AccountRepository.findBalances(),
      PortfolioRepository.findAll(),
    ]);

    const sumType = (type: string) =>
      balances
        .filter((a: any) => a.type === type)
        .reduce((total: number, a: any) => total + a.balance, 0);

    const chequing = sumType("chequing");
    const savings = sumType("savings");
    const credit = sumType("credit");
    const investments = PortfolioRepository.summarize(portfolios);

    const banking = chequing + savings + credit;

    res.json({
      banking: { chequing, savings, credit, total: banking },
      investments: {
        // Valued at the latest known prices, not the statement date.
        total: investments.live_total_value_cad,
        book_value_cad: investments.book_value_cad,
        unrealized_gain_cad: investments.live_unrealized_cad,
        unrealized_pct: investments.live_unrealized_pct,
        as_of_latest: investments.oldest_price_date,
        funded_accounts: investments.funded_accounts,
      },
      net_worth: banking + investments.live_total_value_cad,
    });
  } catch (err) {
    console.error("Failed to compute net worth:", err);
    res.status(500).json({ error: "Failed to compute net worth" });
  }
});

export default router;
