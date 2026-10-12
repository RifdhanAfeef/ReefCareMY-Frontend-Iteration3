"use client";

import { Component, type ReactNode } from "react";
import styles from "./reef-explorer.module.css";

// Map/chunk failures must not take away the site details or reporting links.
export class ReefMapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={`${styles.mapLoading} ${styles.mapError}`} role="alert">
        <div>
          <strong>The map could not be loaded.</strong>
          <p>You can still browse dive sites and read their details.</p>
          <button type="button" className={styles.secondaryButton} onClick={() => this.setState({ failed: false })}>Try loading the map again</button>
        </div>
      </div>
    );
  }
}
