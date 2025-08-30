// Repository layer for route fetching via Leaflet Routing Machine
import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-routing-machine';

export type LatLng = { lat: number; lng: number };

@Injectable({ providedIn: 'root' })
export class RouteRepository {
  private readonly endpoints = [
    'https://router.project-osrm.org/route/v1',
    // Fallback (FOSSGIS)
    'https://routing.openstreetmap.de/routed-car/route/v1'
  ];

  constructor() {
    // nothing to initialize eagerly
  }

  async getRouteCoords(start: LatLng, end: LatLng): Promise<LatLng[]> {
    const waypoints = [
      { latLng: L.latLng(start.lat, start.lng) },
      { latLng: L.latLng(end.lat, end.lng) }
    ];

    const tryEndpointLRM = (idx: number): Promise<LatLng[]> => {
      if (idx >= this.endpoints.length) return Promise.reject(new Error('All routers failed'));
      const serviceUrl = this.endpoints[idx];
      const router = (L as any)?.Routing?.osrmv1
        ? (L as any).Routing.osrmv1({
            serviceUrl,
            profile: 'driving',
            useHints: false,
            timeout: 15000
          })
        : null;
      if (!router) return Promise.reject(new Error('LRM unavailable'));
      return new Promise<LatLng[]>((resolve, reject) => {
        (router as any).route(waypoints, (err: any, routes: any[]) => {
          if (err || !routes?.length || !routes[0]?.coordinates) {
            // 次のエンドポイントで LRM 再試行
            tryEndpointLRM(idx + 1).then(resolve).catch(reject);
            return;
          }
          const r = routes[0];
          const coords: LatLng[] = r.coordinates.map((c: any) => ({ lat: c.lat, lng: c.lng }));
          resolve(coords);
        });
      });
    };

    // 1) LRM で順に試行 → 2) 失敗時は HTTP 直叩きで順に試行
    try {
      return await tryEndpointLRM(0);
    } catch {
      return await this.tryDirectSequence(start, end);
    }
  }

  private async tryDirectSequence(start: LatLng, end: LatLng): Promise<LatLng[]> {
    let lastErr: any;
    for (const base of this.endpoints) {
      try {
        return await this.fetchOsrmDirect(base, start, end);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error('All routers failed');
  }

  private async fetchOsrmDirect(serviceUrl: string, start: LatLng, end: LatLng): Promise<LatLng[]> {
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    // OSRM: /route/v1/{profile}/{coordinates}
    const url = `${serviceUrl}/driving/${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { signal: controller.signal, mode: 'cors' as RequestMode });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: any = await res.json();
      const line = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
      if (!line?.length) throw new Error('No route in response');
      return line.map(([lng, lat]) => ({ lat, lng }));
    } finally {
      clearTimeout(timer);
    }
  }
}
