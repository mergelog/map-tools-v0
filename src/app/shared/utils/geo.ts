export type LatLng = { lat: number; lng: number };

const R = 6371000; // mean Earth radius [m]

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const dφ = toRad(b.lat - a.lat);
  const dλ = toRad(b.lng - a.lng);
  const sinDφ = Math.sin(dφ / 2);
  const sinDλ = Math.sin(dλ / 2);
  const h = sinDφ * sinDφ + Math.cos(φ1) * Math.cos(φ2) * sinDλ * sinDλ;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const λ1 = toRad(a.lng);
  const λ2 = toRad(b.lng);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

export function pathLength(path: LatLng[]): number {
  let meters = 0;
  for (let i = 0; i < path.length - 1; i++) meters += haversine(path[i], path[i + 1]);
  return meters;
}

export function remainingDistance(
  path: LatLng[],
  segIndex: number,
  segProgress: number
): number {
  if (!path.length) return NaN;
  let meters = 0;
  if (segIndex < path.length - 1) {
    const a = path[segIndex];
    const b = path[segIndex + 1];
    const segLen = haversine(a, b);
    meters += Math.max(0, segLen - segProgress);
    for (let j = segIndex + 1; j < path.length - 1; j++) meters += haversine(path[j], path[j + 1]);
  }
  return meters;
}

