import { LOCATION_RADIUS_METERS } from "./thresholds";

type Point = { lat: number; lng: number };

const EARTH_RADIUS_METERS = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters. */
function distanceMeters(a: Point, b: Point): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** The only location fact we keep. The coordinates themselves are dropped after this comparison. */
export function locationCheck(reporter: Point | null, school: Point): "inside" | "outside" | "unavailable" {
  if (!reporter) return "unavailable";

  return distanceMeters(reporter, school) <= LOCATION_RADIUS_METERS ? "inside" : "outside";
}
