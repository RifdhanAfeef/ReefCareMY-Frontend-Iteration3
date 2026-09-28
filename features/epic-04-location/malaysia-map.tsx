"use client";

import { useEffect, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { MapPin } from "@/features/shared/mock-app-state";
import styles from "./location-flow.module.css";

const malaysiaBounds: [[number, number], [number, number]] = [
  [0.5, 99.2],
  [7.7, 119.6],
];

function toPin(latitude: number, longitude: number): MapPin {
  const x = ((longitude - 99.2) / (119.6 - 99.2)) * 100;
  const y = ((7.7 - latitude) / (7.7 - 0.5)) * 100;
  return { x, y, latitude, longitude };
}

function MapInteraction({
  interactive,
  onSetPin,
}: {
  interactive: boolean;
  onSetPin?: (pin: MapPin) => void;
}) {
  useMapEvents({
    click(event) {
      if (interactive && onSetPin) {
        onSetPin(toPin(event.latlng.lat, event.latlng.lng));
      }
    },
  });
  return null;
}

function InitialView({ pin, siteCentre }: { pin: MapPin | null; siteCentre: MapPin | null }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    if (siteCentre) {
      map.setView([siteCentre.latitude, siteCentre.longitude], 10, { animate: false });
    } else if (pin) {
      map.setView([pin.latitude, pin.longitude], Math.max(map.getZoom(), 9), { animate: false });
    } else {
      map.fitBounds(malaysiaBounds, { padding: [18, 18], animate: false });
    }
  }, [map, pin, siteCentre]);

  return null;
}

export function MalaysiaMap({
  pin,
  siteCentre,
  diveSiteRadiusMetres,
  islandRadiusMetres,
  interactive = false,
  onSetPin,
}: {
  pin: MapPin | null;
  siteCentre: MapPin | null;
  diveSiteRadiusMetres: number;
  islandRadiusMetres: number;
  interactive?: boolean;
  onSetPin?: (pin: MapPin) => void;
}) {
  const [tilesUnavailable, setTilesUnavailable] = useState(false);

  return (
    <div className={styles.map}>
      <MapContainer
        className={styles.mapCanvas}
        bounds={malaysiaBounds}
        minZoom={5}
        maxZoom={18}
        scrollWheelZoom
        zoomControl
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => setTilesUnavailable(true),
          }}
        />
        <MapInteraction interactive={interactive} onSetPin={onSetPin} />
        <InitialView pin={pin} siteCentre={siteCentre} />
        {siteCentre && <>
          <Circle center={[siteCentre.latitude, siteCentre.longitude]} radius={islandRadiusMetres} pathOptions={{ color: "#c98b2a", weight: 2, dashArray: "7 6", fillColor: "#f4c66f", fillOpacity: 0.08 }} />
          <Circle center={[siteCentre.latitude, siteCentre.longitude]} radius={diveSiteRadiusMetres} pathOptions={{ color: "#0f8b8d", weight: 2, fillColor: "#29a3a5", fillOpacity: 0.16 }} />
          <CircleMarker center={[siteCentre.latitude, siteCentre.longitude]} radius={6} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#0b6466", fillOpacity: 1 }} />
        </>}
        {pin && (
          <CircleMarker
            center={[pin.latitude, pin.longitude]}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              weight: 4,
              fillColor: "#0f8b8d",
              fillOpacity: 1,
            }}
          />
        )}
      </MapContainer>
      {interactive && !pin && (
        <p className={styles.mapInstruction}>Zoom or drag the map, then click to place a pin.</p>
      )}
      {tilesUnavailable && (
        <p className={styles.mapFallback} role="status">
          The map background is unavailable. You can still use the named dive site or enter coordinates.
        </p>
      )}
    </div>
  );
}
