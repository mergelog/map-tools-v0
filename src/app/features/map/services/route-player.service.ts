import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { LatLng, haversine, lerp } from '../../../shared/utils/geo';

export interface StepUpdate {
  pos: LatLng;
  prev: LatLng;
  next: LatLng;
}

@Injectable({ providedIn: 'root' })
export class RoutePlayerService {
  private path: LatLng[] = [];
  private segIndex = 0;
  private segProgress = 0; // meters along current segment
  private running = false;
  private raf: number | null = null;
  private lastTime = 0;
  private speedProvider: () => number = () => 0; // m/s

  private posSubject = new Subject<StepUpdate>();
  readonly pos$ = this.posSubject.asObservable();

  setPath(path: LatLng[]) {
    this.path = path ?? [];
    this.segIndex = 0;
    this.segProgress = 0;
  }

  start(speedProvider: () => number) {
    if (!this.path.length) return;
    this.speedProvider = speedProvider;
    this.running = true;
    this.lastTime = performance.now();
    const step = (t: number) => {
      if (!this.running) return;
      const dt = Math.max(0, (t - this.lastTime) / 1000);
      this.lastTime = t;
      this.advance(dt);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
    // emit initial position
    if (this.path.length >= 2) {
      const a = this.path[0];
      const b = this.path[1];
      this.posSubject.next({ pos: a, prev: a, next: b });
    }
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.running = false;
  }

  isRunning() {
    return this.running;
  }

  getState() {
    return { segIndex: this.segIndex, segProgress: this.segProgress, path: this.path };
  }

  remainingMeters(): number {
    const { path, segIndex, segProgress } = this.getState();
    // inline to avoid circular import; simple compute
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

  private advance(dt: number) {
    if (this.path.length < 2) return;
    let remaining = this.speedProvider() * dt; // meters to move this frame
    while (remaining > 0 && this.segIndex < this.path.length - 1) {
      const a = this.path[this.segIndex];
      const b = this.path[this.segIndex + 1];
      const segLen = haversine(a, b);
      const distLeft = segLen - this.segProgress;
      if (remaining < distLeft) {
        this.segProgress += remaining;
        remaining = 0;
        const ratio = this.segProgress / segLen;
        const pos = lerp(a, b, ratio);
        this.posSubject.next({ pos, prev: a, next: b });
      } else {
        remaining -= distLeft;
        this.segIndex++;
        this.segProgress = 0;
        this.posSubject.next({ pos: b, prev: a, next: b });
      }
    }
    if (this.segIndex >= this.path.length - 1) {
      this.stop();
    }
  }
}

