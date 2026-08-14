// Standard great-circle (Haversine) distance between two lat/lng points,
// in kilometers. Pure math, no Node/browser-specific APIs, safe to use
// anywhere. See the geo check-in spec section 4 — this is the sole
// enforcement mechanism, always run server-side against the meeting's
// real Venue Latitude/Longitude, never trusting a client-reported result.

const EARTH_RADIUS_KM = 6371;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Fixed system constant, not configurable per meeting, see spec section 2.1.
export const MAX_CHECKIN_DISTANCE_KM = 1;
