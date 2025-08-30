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

    const tryEndpoint = (idx: number): Promise<LatLng[]> => {
      if (!L?.Routing?.osrmv1) return Promise.reject(new Error('Routing engine not available'));
      if (idx >= this.endpoints.length) return Promise.reject(new Error('All routers failed'));
      const serviceUrl = this.endpoints[idx];
      const router = L.Routing.osrmv1({
        serviceUrl,
        profile: 'driving',
        useHints: false,
        timeout: 15000
      } as any);
      return new Promise<LatLng[]>((resolve, reject) => {
        const anyRouter: any = router as any;
        anyRouter.route(waypoints, (err: any, routes: any[]) => {
          if (err || !routes?.length || !routes[0]?.coordinates) {
            // 次のエンドポイントで再試行（コールバックは void を返す）
            tryEndpoint(idx + 1).then(resolve).catch(reject);
            return;
          }
          const r = routes[0];
          const coords: LatLng[] = r.coordinates.map((c: any) => ({ lat: c.lat, lng: c.lng }));
          resolve(coords);
        });
      });
    };

    return tryEndpoint(0);
  }
}
