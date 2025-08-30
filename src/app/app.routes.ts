import { Routes } from '@angular/router';
import { MapPage } from './features/map/page';

export const routes: Routes = [
  { path: '', component: MapPage },
  { path: '**', redirectTo: '' }
];
