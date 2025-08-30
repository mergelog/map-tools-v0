import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-map-controls',
  standalone: true,
  imports: [NgIf],
  templateUrl: './map-controls.html',
  styleUrl: './map-controls.scss'
})
export class MapControls {
  @Input({ required: true }) running = false;
  @Input({ required: true }) hasRoute = false;
  @Input({ required: true }) showStart = false;
  @Input({ required: true }) speedKmH = 60;
  @Input({ required: true }) follow = true;
  @Input({ required: true }) busy = false;

  @Output() stop = new EventEmitter<void>();
  @Output() start = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
  @Output() toggleFollow = new EventEmitter<void>();
  @Output() speedChange = new EventEmitter<number>();

  onSpeed(ev: Event) {
    const v = parseInt((ev.target as HTMLInputElement).value, 10);
    if (Number.isFinite(v)) this.speedChange.emit(v);
  }
}

