import * as L from 'leaflet';

export type MarkerKind = 'start' | 'end' | 'point';

export function createMarkerIcon(kind: MarkerKind = 'point'): L.DivIcon {
  const src = kind === 'start' ? 'svg/marker-start.svg' : kind === 'end' ? 'svg/marker-end.svg' : 'svg/marker-start.svg';
  const html = `<img class="marker-svg" src="${src}" width="28" height="36" alt="marker" />`;
  return L.divIcon({ className: 'marker-icon', html, iconSize: [28, 36], iconAnchor: [14, 34] });
}

export function createCarIcon(): L.DivIcon {
  const html = `
    <div class="car-inner" style="will-change: transform;">
      <img src="svg/car.svg" width="48" height="48" alt="car" />
    </div>`;
  return L.divIcon({ className: 'car-icon', html, iconSize: [48, 48], iconAnchor: [24, 24] });
}

