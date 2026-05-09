export function getPosition(opts = {}) {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
      ...opts,
    })
  )
}

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat  = toRad(lat2 - lat1)
  const dLng  = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function checkGeofence(userLat, userLng, site) {
  if (!site?.lat || !site?.lng) return { inside: true, distance: 0 }
  const distance = haversineDistance(userLat, userLng, site.lat, site.lng)
  const radius   = site.radius_meters ?? 200
  return { inside: distance <= radius, distance: Math.round(distance), radius }
}
