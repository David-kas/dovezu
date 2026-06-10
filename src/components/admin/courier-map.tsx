"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface CourierLocation {
  id: string;
  name: string;
  isOnline: boolean;
  location: {
    latitude: number;
    longitude: number;
    createdAt: string;
  };
}

export function CourierMap({ couriers }: { couriers: CourierLocation[] }) {
  const center: [number, number] = couriers.length > 0
    ? [couriers[0].location.latitude, couriers[0].location.longitude]
    : [55.7558, 37.6173];

  return (
    <div className="h-[500px] rounded-xl overflow-hidden border">
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {couriers.map((c) => (
          <Marker
            key={c.id}
            position={[c.location.latitude, c.location.longitude]}
            icon={icon}
          >
            <Popup>
              <strong>{c.name}</strong>
              <br />
              {c.isOnline ? "Онлайн" : "Офлайн"}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
