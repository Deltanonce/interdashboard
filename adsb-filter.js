// Operational Reach: Middle East, South Asia, and Asia-Pacific
const MIN_LAT = -11.0;
const MAX_LAT = 55.0;
const MIN_LNG = 20.0;
const MAX_LNG = 155.0;

function getCoordinate(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function filterAdsbFlight(flight) {
    if (!flight) return false;

    // Loosen military check: The /v2/mil endpoint is already pre-filtered for military.
    // We accept the aircraft if any military flag is set, or if it has basic identity (hex/flight) 
    // to avoid dropping valid targets from the military-only feed.
    const isMil = flight.isMilitary === true || 
                  flight.mil === true || 
                  flight.military === true ||
                  (flight.t && flight.t.length > 0) || // Has aircraft type
                  (flight.hex && flight.hex.length > 0); // Has hex code

    if (!isMil) return false;

    const latitude = getCoordinate(flight.latitude ?? flight.lat);
    const longitude = getCoordinate(flight.longitude ?? flight.lng ?? flight.lon);

    if (latitude == null || longitude == null) return false;

    // Geographical validation
    const inLat = latitude >= MIN_LAT && latitude <= MAX_LAT;
    
    // Longitude logic: primarily 20 to 155, but prepared for IDL transition if MIN > MAX
    let inLon = false;
    if (MIN_LNG <= MAX_LNG) {
        inLon = longitude >= MIN_LNG && longitude <= MAX_LNG;
    } else {
        // Handles International Date Line transition
        inLon = longitude >= MIN_LNG || longitude <= MAX_LNG;
    }

    return inLat && inLon;
}

module.exports = filterAdsbFlight;
