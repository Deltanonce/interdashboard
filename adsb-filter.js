const MIN_LAT = 12.0;
const MAX_LAT = 45.0;
const MIN_LNG = 32.0;
const MAX_LNG = 63.0;

function getCoordinate(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function filterAdsbFlight(flight) {
    if (!flight || flight.isMilitary !== true) return false;

    const latitude = getCoordinate(flight.latitude ?? flight.lat);
    const longitude = getCoordinate(flight.longitude ?? flight.lng ?? flight.lon);

    if (latitude == null || longitude == null) return false;

    return (
        latitude >= MIN_LAT &&
        latitude <= MAX_LAT &&
        longitude >= MIN_LNG &&
        longitude <= MAX_LNG
    );
}

module.exports = filterAdsbFlight;
