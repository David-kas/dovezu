"use client";

import { useEffect } from "react";

export function LocationTracker() {
  useEffect(() => {
    if (!navigator.geolocation) return;

    function sendLocation(position: GeolocationPosition) {
      fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      }).catch(console.error);
    }

    function onError(error: GeolocationPositionError) {
      console.warn("Geolocation error:", error.message);
    }

    navigator.geolocation.getCurrentPosition(sendLocation, onError, {
      enableHighAccuracy: true,
      maximumAge: 30000,
    });

    const watchId = navigator.geolocation.watchPosition(sendLocation, onError, {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 60000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return null;
}
