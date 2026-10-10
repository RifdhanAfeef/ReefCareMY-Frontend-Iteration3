"use client";

import { useEffect, useRef, useState } from "react";
import { latLng, point } from "leaflet";
import type { TileLayer as LeafletTileLayer } from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
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

function InitialView({
  pin,
  siteCentre,
  diveSiteRadiusMetres,
  islandRadiusMetres,
  interactive,
  tileLayer,
}: {
  pin: MapPin | null;
  siteCentre: MapPin | null;
  diveSiteRadiusMetres: number | null;
  islandRadiusMetres: number;
  interactive: boolean;
  tileLayer: React.RefObject<LeafletTileLayer | null>;
}) {
  const map = useMap();
  const viewedSite = useRef<string | null>(null);

  useEffect(() => {
    map.invalidateSize();
    if (!siteCentre) {
      viewedSite.current = null;
      if (pin) {
        map.setView([pin.latitude, pin.longitude], Math.max(map.getZoom(), 9), { animate: false });
      } else {
        map.fitBounds(malaysiaBounds, { padding: [18, 18], animate: false });
      }
      return;
    }

    const siteKey = `${siteCentre.latitude}:${siteCentre.longitude}:${diveSiteRadiusMetres}:${islandRadiusMetres}`;
    if (viewedSite.current === siteKey) return;

    if (pin) {
      viewedSite.current = siteKey;
      map.setView([pin.latitude, pin.longitude], Math.max(map.getZoom(), 11), { animate: false });
      return;
    }

    const centre = latLng(siteCentre.latitude, siteCentre.longitude);
    const outerBounds = centre.toBounds(islandRadiusMetres * 2);
    const innerBounds = diveSiteRadiusMetres ? centre.toBounds(diveSiteRadiusMetres * 2) : null;
    const padding: [number, number] = [12, 12];
    map.fitBounds(outerBounds, { padding, animate: false });

    if (!innerBounds) {
      viewedSite.current = siteKey;
      return;
    }
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!interactive || reduceMotion) {
      viewedSite.current = siteKey;
      map.fitBounds(innerBounds, { padding, animate: false });
      return;
    }

    const container = map.getContainer();
    let cancelled = false;
    let stepTimer: number | undefined;
    let tileLoadListener: (() => void) | undefined;
    const clearPendingStep = () => {
      window.clearTimeout(stepTimer);
      if (tileLoadListener) tileLayer.current?.off("load", tileLoadListener);
      tileLoadListener = undefined;
    };
    const cancelOnUserInput = () => {
      cancelled = true;
      viewedSite.current = siteKey;
      window.clearTimeout(startTimer);
      clearPendingStep();
      map.stop();
    };
    for (const eventName of ["pointerdown", "touchstart", "wheel", "keydown"]) {
      container.addEventListener(eventName, cancelOnUserInput);
    }
    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      const finalZoom = map.getBoundsZoom(innerBounds, false, point(...padding));
      const startZoom = map.getZoom();
      viewedSite.current = siteKey;
      if (finalZoom <= startZoom) {
        map.fitBounds(innerBounds, { padding, animate: false });
        return;
      }

      // A flyTo scales low-resolution raster tiles through multiple zoom levels.
      // Move one whole zoom level at a time and wait for its tiles before continuing.
      const nextStep = (zoom: number) => {
        if (cancelled) return;
        if (zoom > finalZoom) {
          map.fitBounds(innerBounds, { padding, animate: false });
          return;
        }
        map.setView(centre, zoom, { animate: false });
        const layer = tileLayer.current;
        const advance = () => {
          clearPendingStep();
          stepTimer = window.setTimeout(() => nextStep(zoom + 1), 180);
        };
        if (layer?.isLoading()) {
          tileLoadListener = advance;
          layer.once("load", advance);
          // Do not leave the map stuck if the tile service is slow or unavailable.
          stepTimer = window.setTimeout(advance, 1500);
        } else {
          stepTimer = window.setTimeout(() => nextStep(zoom + 1), 180);
        }
      };
      nextStep(startZoom + 1);
    }, 300);

    return () => {
      window.clearTimeout(startTimer);
      clearPendingStep();
      for (const eventName of ["pointerdown", "touchstart", "wheel", "keydown"]) {
        container.removeEventListener(eventName, cancelOnUserInput);
      }
      map.stop();
    };
  }, [map, pin, siteCentre, diveSiteRadiusMetres, islandRadiusMetres, interactive, tileLayer]);

  return null;
}

export function MalaysiaMap({
  pin,
  siteCentre,
  siteName,
  diveSiteRadiusMetres,
  islandRadiusMetres,
  interactive = false,
  onSetPin,
}: {
  pin: MapPin | null;
  siteCentre: MapPin | null;
  siteName: string | null;
  diveSiteRadiusMetres: number | null;
  islandRadiusMetres: number;
  interactive?: boolean;
  onSetPin?: (pin: MapPin) => void;
}) {
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const tileLayer = useRef<LeafletTileLayer | null>(null);

  return (
    <div className={styles.map}>
      <MapContainer
        className={styles.mapCanvas}
        bounds={siteCentre ? latLng(siteCentre.latitude, siteCentre.longitude).toBounds(islandRadiusMetres * 2) : malaysiaBounds}
        minZoom={5}
        maxZoom={18}
        zoomAnimation={false}
        scrollWheelZoom
        zoomControl
        worldCopyJump
      >
        <TileLayer
          ref={tileLayer}
          detectRetina
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => setTilesUnavailable(true),
          }}
        />
        <MapInteraction interactive={interactive} onSetPin={onSetPin} />
        <InitialView pin={pin} siteCentre={siteCentre} diveSiteRadiusMetres={diveSiteRadiusMetres} islandRadiusMetres={islandRadiusMetres} interactive={interactive} tileLayer={tileLayer} />
        {siteCentre && <>
          <Circle center={[siteCentre.latitude, siteCentre.longitude]} radius={islandRadiusMetres} pathOptions={{ color: "#c98b2a", weight: 2, dashArray: "7 6", fillColor: "#f4c66f", fillOpacity: 0.08 }} />
          {diveSiteRadiusMetres && <Circle center={[siteCentre.latitude, siteCentre.longitude]} radius={diveSiteRadiusMetres} pathOptions={{ color: "#0f8b8d", weight: 2, fillColor: "#29a3a5", fillOpacity: 0.16 }} />}
          <CircleMarker center={[siteCentre.latitude, siteCentre.longitude]} radius={6} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#0b6466", fillOpacity: 1 }}>
            {siteName && <Tooltip direction="top" offset={[0, -8]} opacity={1}>{siteName}</Tooltip>}
          </CircleMarker>
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
