import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class GeocodeRepository {
  private endpoint = 'https://nominatim.openstreetmap.org/reverse';
  private readonly http = inject(HttpClient);

  async reverse(lat: number, lon: number, lang = 'ja'): Promise<string> {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lon),
      'accept-language': lang,
      zoom: '18',
      addressdetails: '1'
    });
    const url = `${this.endpoint}?${params.toString()}`;
    try {
      const data: any = await this.http.get(url).toPromise();
      const addr = data?.address ?? {};
      const formatted = this.formatJapaneseAddress(addr);
      return formatted || data?.display_name || '';
    } catch (e) {
      return '';
    }
  }

  private formatJapaneseAddress(addr: any): string {
    if (!addr) return '';
    // Prefer Japanese components
    const pref = addr.state || addr.province || '';
    const city = addr.city || addr.town || addr.village || addr.municipality || '';
    const ward = addr.city_district || addr.district || addr.borough || addr.suburb || '';
    const locality = addr.neighbourhood || addr.quarter || addr.hamlet || '';
    const road = addr.road || addr.residential || addr.footway || addr.path || '';
    const house = addr.house_number || '';

    const parts = [pref, city, ward, locality, road, house].filter(Boolean);
    // Remove consecutive duplicates just in case
    const deduped: string[] = [];
    for (const p of parts) {
      if (!deduped.length || deduped[deduped.length - 1] !== p) deduped.push(p);
    }
    return deduped.join('');
  }
}
