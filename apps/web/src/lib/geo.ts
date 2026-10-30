import type { Coordinates } from '@fraud/shared';

/**
 * Silent geolocation.
 *
 * Called when a form is submitted rather than on page load, so the browser only asks once the
 * customer actually acts. Every failure (denied permission, no fix in time, an insecure origin)
 * resolves to `undefined` and the API falls back to the last city stored on the account — the
 * customer is never blocked by a location problem.
 */
export async function currentCoordinates(timeoutMs = 4000): Promise<Coordinates | undefined> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return undefined;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value?: Coordinates) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        finish({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        finish(undefined);
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: timeoutMs },
    );
  });
}
