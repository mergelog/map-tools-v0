import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-lat-lng',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './lat-lng.html',
  styleUrl: './lat-lng.scss'
})
export class LatLngDisplay {
  @Input({ required: true }) lat!: number;
  @Input({ required: true }) lng!: number;
  /** Angular number pipe format (default 1.6-6) */
  @Input() format: string = '1.6-6';
}

