import pool from "../db/pool";
import { fetchSecurityMetadata } from "./quotes";

export type MetadataRefreshResult = {
  updated: number;
  with_sectors: number;
  /** Held securities the feed has no profile for, so they fall back to manual. */
  no_data: string[];
  failed: string[];
};

export const MetadataRepository = {
  refresh: async (): Promise<MetadataRefreshResult> => {
    const { rows: securities } = await pool.query(
      `SELECT symbol, ticker, underlying_ticker FROM securities
       WHERE ticker IS NOT NULL ORDER BY symbol`,
    );

    const noData: string[] = [];
    const failed: string[] = [];
    let updated = 0;
    let withSectors = 0;

    for (const s of securities) {
      // A wrapper such as a CDR carries no profile of its own, so fall through
      // to whatever it tracks rather than leaving the position unclassified.
      const candidates = [s.ticker, s.underlying_ticker].filter(Boolean);
      let meta = null;
      for (const candidate of candidates) {
        try {
          const fetched = await fetchSecurityMetadata(candidate);
          if (fetched && (fetched.sectors.length > 0 || fetched.sector)) {
            meta = fetched;
            break;
          }
        } catch (err) {
          console.error(`Metadata failed for ${candidate}:`, err);
        }
      }
      if (!meta) {
        failed.push(s.symbol);
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE securities
           SET stock_position = $2, bond_position = $3, cash_position = $4,
               other_position = $5, legal_type = $6,
               region = COALESCE(region, $7),
               metadata_updated_at = now()
           WHERE symbol = $1`,
          [
            s.symbol,
            meta.stock_position,
            meta.bond_position,
            meta.cash_position,
            meta.other_position,
            meta.legal_type,
            // Only individual stocks report a country; a manual value always wins.
            meta.country,
          ],
        );

        // Replace wholesale: a stale sector that vanished upstream must go.
        await client.query(
          "DELETE FROM security_sector_weights WHERE security = $1",
          [s.symbol],
        );

        const weights = meta.sectors.length
          ? meta.sectors
          : // A single stock is wholly its own sector.
            meta.sector
            ? [{ sector: meta.sector, weight: 1 }]
            : [];

        for (const w of weights) {
          await client.query(
            `INSERT INTO security_sector_weights (security, sector, weight)
             VALUES ($1, $2, $3)
             ON CONFLICT (security, sector) DO UPDATE SET weight = EXCLUDED.weight`,
            [s.symbol, w.sector, w.weight],
          );
        }

        await client.query("COMMIT");
        updated += 1;
        if (weights.length > 0) withSectors += 1;
        else noData.push(s.symbol);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    return { updated, with_sectors: withSectors, no_data: noData, failed };
  },
};
