export function calcEtaSeconds(remainingMeters: number, speedMps: number): number | null {
  if (!isFinite(remainingMeters) || remainingMeters < 0) return null;
  if (!isFinite(speedMps) || speedMps <= 0) return null;
  return remainingMeters / speedMps;
}

