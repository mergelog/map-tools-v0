import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type LatLngPos = { lat: number; lng: number } | null;

@Injectable({ providedIn: 'root' })
export class CurrentPositionStore {
  private readonly state$ = new BehaviorSubject<LatLngPos>(null);
  readonly currentPosition$ = this.state$.asObservable();

  push(lat: number, lng: number) {
    this.state$.next({ lat, lng });
  }

  clear() {
    this.state$.next(null);
  }
}

