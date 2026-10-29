import { LOCATION_COORDS } from '@fraud/shared';
import type { Location } from '@fraud/shared';

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two known cities, rounded to whole km. */
export function distanceKm(a: Location, b: Location): number {
  const p = LOCATION_COORDS[a];
  const q = LOCATION_COORDS[b];
  const dLat = rad(q.lat - p.lat);
  const dLng = rad(q.lng - p.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(p.lat)) * Math.cos(rad(q.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_KM * c);
}

export interface LocationChange {
  changed: boolean;
  previousLocation?: Location;
  newLocation: Location;
  distanceKm?: number;
  timeElapsedMinutes: number;
}

/** +10 for any change, plus 50 / 30 / 15 for distances over 500 / 200 / 50 km. */
export function locationScore(c: LocationChange): number {
  if (!c.changed) return 0;
  const d = c.distanceKm ?? 0;
  const distancePoints = d > 500 ? 50 : d > 200 ? 30 : d > 50 ? 15 : 0;
  return 10 + distancePoints;
}

export function locationWarning(c: LocationChange): string | undefined {
  if (!c.changed) return undefined;
  const distance = c.distanceKm === undefined ? 'Unknown' : `${c.distanceKm} km`;
  return `⚠️ Location changed from ${c.previousLocation} to ${c.newLocation} (${distance} away) in ${c.timeElapsedMinutes} minutes`;
}
