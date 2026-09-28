"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { HotspotSiteSummary } from "@/lib/api/hotspot-types";
import styles from "./hotspots.module.css";

export function usableMapSites(sites: HotspotSiteSummary[]) {
  return sites.filter(({ mapLocation: point, reportCount }) => point && reportCount > 0 &&
    Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180);
}

function FitSites({ sites }: { sites: HotspotSiteSummary[] }) {
  const map = useMap();
  useEffect(() => {
    const points = usableMapSites(sites).flatMap((site) => site.mapLocation ? [[site.mapLocation.latitude, site.mapLocation.longitude] as [number, number]] : []);
    map.invalidateSize();
    if (points.length) map.fitBounds(points, { padding: [48, 48], maxZoom: 10, animate: false });
  }, [map, sites]);
  return null;
}

export function HotspotMap({ sites, onSelect }: { sites: HotspotSiteSummary[]; onSelect: (siteId: number) => void }) {
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [tileKey, setTileKey] = useState(0);
  const points = usableMapSites(sites);
  const largest = Math.max(1, ...points.map((site) => site.reportCount));
  return <div className={styles.mapFrame}>
    <MapContainer className={styles.mapCanvas} center={[4.2, 104]} zoom={6} minZoom={3} maxZoom={12} scrollWheelZoom={false}>
      <TileLayer key={tileKey} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        eventHandlers={{ tileerror: () => setTilesUnavailable(true) }} />
      <FitSites sites={sites} />
      {points.map(({ site, mapLocation, reportCount }) => mapLocation && <CircleMarker
        key={site.siteId} center={[mapLocation.latitude, mapLocation.longitude]}
        radius={7 + 20 * Math.sqrt(reportCount / largest)}
        pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#087e81", fillOpacity: 0.78 }}>
        <Popup><div className={styles.mapPopup}><strong>{site.name}</strong><span>{site.area}</span><b>{reportCount} {reportCount === 1 ? "report" : "reports"}</b><small>Generalised site location · uncertainty {mapLocation.uncertaintyMetres.toLocaleString()} m</small><small>{mapLocation.basis}</small><button className={styles.primaryButton} type="button" onClick={() => onSelect(site.siteId)}>Explore this site</button></div></Popup>
      </CircleMarker>)}
    </MapContainer>
    <div className={styles.mapLegend}><span className={styles.legendDot} />Larger circles mean more reports</div>
    {tilesUnavailable && <div className={styles.tileWarning} role="status">Map background unavailable. Site counts remain available below. <button type="button" onClick={() => { setTilesUnavailable(false); setTileKey((key) => key + 1); }}>Retry map</button></div>}
  </div>;
}
