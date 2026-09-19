export type Gate = { name: string; status: 'pass' | 'fail' | 'unknown'; evidence: string };
export type Factor = { name: string; score: number; weight: number };
export function qualify(gates: Gate[], factors: Factor[]) {
  if (!gates.length || gates.some((g) => g.status === 'unknown')) {
    if (!gates.some((g) => g.status === 'fail'))
      return { score: null, band: 'Needs review' as const };
  }
  if (gates.some((g) => g.status === 'fail')) return { score: null, band: 'Not eligible' as const };
  if (
    !factors.length ||
    factors.some(
      (f) =>
        !Number.isFinite(f.score) ||
        f.score < 0 ||
        f.score > 100 ||
        !Number.isFinite(f.weight) ||
        f.weight <= 0,
    )
  )
    return { score: null, band: 'Needs review' as const };
  const score = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) /
      factors.reduce((sum, f) => sum + f.weight, 0),
  );
  return {
    score,
    band:
      score >= 80
        ? ('Strong fit' as const)
        : score >= 60
          ? ('Needs review' as const)
          : ('Low fit' as const),
  };
}
