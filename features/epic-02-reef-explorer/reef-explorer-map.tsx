"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { ReefSite } from "./types";
import styles from "./reef-explorer.module.css";

const malaysiaBounds: [[number, number], [number, number]] = [
  [0.5, 99.2],
  [7.7, 119.6],
];

function FocusMap({ selectedSite, areaSites, mapOpen }: { selectedSite: ReefSite | null; areaSites: ReefSite[]; mapOpen: boolean }) {
  const map = useMap();

  useEffect(() => {
    map.stop();
    map.invalidateSize({ animate: false });
    const size = map.getSize();
    // Leaflet's flyTo divides by the viewport size. Never run it on a hidden map.
    if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || size.x <= 0 || size.y <= 0) return;
    const compact = window.matchMedia?.("(max-width: 1120px)").matches ?? false;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const animate = !compact && !reducedMotion;
    if (selectedSite) {
      if (animate) map.flyTo(selectedSite.position, 12, { animate, duration: 0.6 });
      else map.setView(selectedSite.position, 12, { animate: false });
    } else {
      map.fitBounds(areaSites.length ? areaSites.map((site) => site.position) : malaysiaBounds, { padding: [38, 38], maxZoom: 11, animate });
    }
    // MapContainer owns destruction and cancels animation in Leaflet.remove().
    // Parent cleanup runs first on unmount; calling stop() afterwards accesses
    // panes that Leaflet has already removed when hiding the map or changing page.
  }, [map, selectedSite, areaSites, mapOpen]);

  return null;
}

export function ReefExplorerMap({
  sites,
  selectedSiteId,
  selectedArea,
  mapOpen,
  onSelectSite,
}: {
  sites: ReefSite[];
  selectedSiteId: string | null;
  selectedArea: string | null;
  mapOpen: boolean;
  onSelectSite: (siteId: string) => void;
}) {
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? null;
  const areaSites = useMemo(() => selectedArea ? sites.filter((site) => site.island === selectedArea) : [], [sites, selectedArea]);

  return (
    <div className={styles.mapFrame} aria-label="Interactive map of selected Malaysian reef areas">
      <MapContainer
        className={styles.mapCanvas}
        bounds={malaysiaBounds}
        minZoom={5}
        maxZoom={13}
        scrollWheelZoom
        zoomControl
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: () => setTilesUnavailable(true) }}
        />
        <FocusMap selectedSite={selectedSite} areaSites={areaSites} mapOpen={mapOpen} />
        {sites.map((site) => {
          const selected = site.id === selectedSiteId;
          return (
            <CircleMarker
              key={site.id}
              center={site.position}
              radius={selected ? 11 : 8}
              pathOptions={{
                color: "#ffffff",
                weight: selected ? 4 : 3,
                fillColor: selected ? "#f06a5b" : "#0f8b8d",
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelectSite(site.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <strong>{site.name}</strong><br />{site.publicAreaLabel}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <p className={styles.mapPrivacy}>Markers show general named-site areas. Exact report coordinates are never shown.</p>
      {tilesUnavailable && (
        <p className={styles.mapFallback} role="status">
          The map background is temporarily unavailable. The dive-site list is still available.
        </p>
      )}
    </div>
  );
}

