// Repository layer for route fetching via Leaflet Routing Machine
import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-routing-machine';

export type LatLng = { lat: number; lng: number };

@Injectable({ providedIn: 'root' })
export class RouteRepository {
  private router: any;

  constructor() {
    // Use OSRM public demo server via LRM
    // Note: for production, consider hosting your own OSRM backend
    this.router = L?.Routing?.osrmv1
      ? L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'driving',
          useHints: false
        })
      : null;
  }

  async getRouteCoords(start: LatLng, end: LatLng): Promise<LatLng[]> {
    if (!this.router) {
      throw new Error('Routing engine not available');
    }
    return new Promise((resolve, reject) => {
      const waypoints = [
        { latLng: L.latLng(start.lat, start.lng) },
        { latLng: L.latLng(end.lat, end.lng) }
      ];
      this.router.route(waypoints, (err: any, routes: any[]) => {
        if (err) return reject(err);
        const r = routes?.[0];
        if (!r?.coordinates) return reject(new Error('No route found'));
        const coords: LatLng[] = r.coordinates.map((c: any) => ({ lat: c.lat, lng: c.lng }));
        resolve(coords);
      });
    });
  }
}
