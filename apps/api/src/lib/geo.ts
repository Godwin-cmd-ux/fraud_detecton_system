import { DEFAULT_LOCATION, LOCATION_COORDS, LOCATIONS } from '@fraud/shared';
import type { Coordinates, Location } from '@fraud/shared';

/**
 * Location resolution.
 *
 * The browser reports latitude/longitude, but every fraud rule is written against the city list in
 * `LOCATIONS` (a change of city inside the window is what triggers the location score). So the
 * coordinates are mapped to the nearest supported city here, keeping the rules untouched, and the
 * raw coordinates are stored alongside for evidence.
 */

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Beyond this, the reading is not treated as the customer being in that city. */
export const MAX_CITY_DISTANCE_KM = 250;

export interface NearestLocation {
  location: Location;
  distanceKm: number;
}

export function nearestLocation(coordinates: Coordinates): NearestLocation {
  const point = { lat: coordinates.latitude, lng: coordinates.longitude };
  let closest: Location = DEFAULT_LOCATION;
  let best = Number.POSITIVE_INFINITY;
  for (const name of LOCATIONS) {
    const km = distanceKm(point, LOCATION_COORDS[name]);
    if (km < best) {
      best = km;
      closest = name;
    }
  }
  return { location: closest, distanceKm: Math.round(best) };
}

/**
 * Best city for a reading, or `fallback` when the coordinates are absent or far from every city
 * we score (a device abroad should not silently become "Dar es Salaam", it keeps the last known
 * city, exactly as a customer who never picked a location did before).
 */
export function resolveLocation(coordinates: Coordinates | undefined, fallback: Location): Location {
  if (!coordinates) return fallback;
  const { location, distanceKm } = nearestLocation(coordinates);
  return distanceKm <= MAX_CITY_DISTANCE_KM ? location : fallback;
}

/** The last city stored on the account, when it is still a supported one. */
export function storedLocation(last: string | null): Location {
  return (LOCATIONS as readonly string[]).includes(last ?? '') ? (last as Location) : DEFAULT_LOCATION;
}
