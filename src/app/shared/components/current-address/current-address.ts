import { Component, inject } from '@angular/core';
import { NgIf, AsyncPipe } from '@angular/common';
import { CurrentAddressStore } from '../../../core/stores/current-address.store';

@Component({
  selector: 'app-current-address',
  standalone: true,
  imports: [NgIf, AsyncPipe],
  templateUrl: './current-address.html',
  styleUrl: './current-address.scss'
})
export class CurrentAddressComponent {
  private readonly store = inject(CurrentAddressStore);
  readonly address$ = this.store.currentAddress$;
}

