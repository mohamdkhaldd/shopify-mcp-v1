import { percent, portion, Piasters } from "./money";

export interface InvestorWeight {
  investorId: number;
  /** Σ (capital in piasters × each day it was present in the month). */
  weight: bigint;
}

export interface Distribution {
  monthNetPt: Piasters;
  investorsPoolPt: Piasters;
  managementPt: Piasters;
  /** Sub-piaster leftovers from splitting the pool; already included in managementPt. */
  remainderToManagementPt: Piasters;
  investors: { investorId: number; sharePt: Piasters; weight: bigint }[];
}

/**
 * Splits a month's net profit. The investors' pool is split by time-weighted
 * capital; whatever can't be split to the piaster goes to management. A month
 * with no profit (or a loss) distributes nothing to investors.
 */
export function distribute(monthNetPt: Piasters, investorsBp: number, weights: InvestorWeight[]): Distribution {
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0n);
  if (monthNetPt <= 0 || totalWeight === 0n) {
    return {
      monthNetPt,
      investorsPoolPt: 0,
      managementPt: monthNetPt,
      remainderToManagementPt: 0,
      investors: weights.map((w) => ({ investorId: w.investorId, sharePt: 0, weight: w.weight })),
    };
  }
  const pool = percent(monthNetPt, investorsBp);
  const investors = weights.map((w) => ({ investorId: w.investorId, sharePt: portion(pool, w.weight, totalWeight), weight: w.weight }));
  const given = investors.reduce((s, x) => s + x.sharePt, 0);
  const remainder = pool - given;
  return {
    monthNetPt,
    investorsPoolPt: pool,
    managementPt: monthNetPt - pool + remainder,
    remainderToManagementPt: remainder,
    investors,
  };
}
