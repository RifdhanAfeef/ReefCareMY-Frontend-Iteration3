"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { HotspotAnalysis } from "@/lib/api/hotspot-types";
import { HotspotLoading } from "./hotspot-status";
import styles from "./hotspots.module.css";

const HotspotMap = dynamic(() => import("./hotspot-map").then((module) => module.HotspotMap), {
  ssr: false,
  loading: () => <HotspotLoading message="Loading the map…" />,
});

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className={styles.emptyMap} role="status"><strong>The map could not be displayed</strong><p>You can still explore reporting activity in the named-site list.</p><button className={styles.secondaryButton} type="button" onClick={() => this.setState({ failed: false })}>Retry map</button></div>;
    return this.props.children;
  }
}

export function HotspotMapPanel({ analysis, onSelect }: { analysis: HotspotAnalysis; onSelect: (id: number) => void }) {
  const canMap = ["ready", "partial"].includes(analysis.mapState) && analysis.sites.some((site) => site.mapLocation);
  return <section className={styles.mapCard} aria-labelledby="map-heading">
    <div className={styles.cardHeading}><div><h2 id="map-heading">Reporting concentrations</h2><p>Generalised locations of named dive sites</p></div><span className={styles.badge}>Report counts</span></div>
    {canMap ? <MapBoundary><HotspotMap sites={analysis.sites} onSelect={onSelect} /></MapBoundary> : <div className={styles.emptyMap} role="status">
      <svg width="52" height="52" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="m6 12 12-5 12 5 12-5v29l-12 5-12-5-12 5V12Z" stroke="currentColor" strokeWidth="2" /><path d="M18 7v29m12-24v29" stroke="currentColor" strokeWidth="2" /></svg>
      <strong>{analysis.mapState === "unavailable" ? "Map information unavailable" : "Map locations are not available for this selection"}</strong>
      <p>{analysis.mapMessage}</p>
      <a className={styles.textLink} href="#reporting-sites">Explore the named-site counts ↓</a>
    </div>}
    <div className={styles.mapCaption}><p>{analysis.mapMessage}</p><p>Markers are generalised site anchors, not underwater incident positions. Circle sizes do not measure ecological risk.</p></div>
  </section>;
}
