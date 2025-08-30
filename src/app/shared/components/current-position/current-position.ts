import { Component, inject } from '@angular/core';
import { NgIf, AsyncPipe } from '@angular/common';
import { CurrentPositionStore } from '../../../core/stores/current-position.store';
import { LatLngDisplay } from '../lat-lng/lat-lng';

@Component({
  selector: 'app-current-position',
  standalone: true,
  imports: [NgIf, AsyncPipe, LatLngDisplay],
  templateUrl: './current-position.html',
  styleUrl: './current-position.scss'
})
export class CurrentPositionComponent {
  private readonly store = inject(CurrentPositionStore);
  readonly pos$ = this.store.currentPosition$;
}

