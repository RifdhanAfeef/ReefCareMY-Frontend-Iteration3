"use client";

import Image from "next/image";
import { X, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { getObserverEvidence } from "@/lib/api/reportsApi";
import type { ObserverEvidenceSummary } from "@/lib/api/types";
import styles from "./report-detail.module.css";

type Photo = { url: string; number: number };

function EnlargedPhoto({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    return () => {
      if (element?.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return <dialog ref={dialog} className={styles.photoDialog}
    aria-labelledby="enlarged-observer-photo-heading"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <header className={styles.photoDialogHeader}>
      <h2 id="enlarged-observer-photo-heading">Submitted photo {photo.number}</h2>
      <button type="button" onClick={onClose} aria-label="Close photo">
        <X size={22} aria-hidden="true" />
      </button>
    </header>
    <Image src={photo.url} alt={`Submitted photo ${photo.number}`} width={1200} height={900}
      unoptimized className={styles.enlargedPhoto} />
  </dialog>;
}

function SubmittedPhoto({ reportReference, evidenceId, number }: {
  reportReference: string;
  evidenceId: number;
  number: number;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    getObserverEvidence(reportReference, evidenceId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        if (!blob.size || !["image/jpeg", "image/png", "image/webp"].includes(blob.type)) {
          throw new Error("Invalid evidence image.");
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setError(requestError instanceof ApiError && [403, 404].includes(requestError.status)
          ? "This photo is unavailable."
          : "This photo could not be loaded. Try again.");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reportReference, evidenceId, retryKey]);

  function retry() {
    setError("");
    setUrl("");
    setRetryKey((value) => value + 1);
  }

  return <li className={styles.submittedPhoto}>
    {error ? <div className={styles.photoPlaceholder}>
      <p role="alert">{error}</p>
      <button type="button" onClick={retry} aria-label={`Retry photo ${number}`}>Try again</button>
    </div> : url ? <button type="button" className={styles.photoThumbnail}
      aria-label={`View submitted photo ${number}`} aria-haspopup="dialog" onClick={() => setEnlarged(true)}>
      <Image src={url} alt={`Submitted photo ${number}`} width={360} height={220} unoptimized
        onError={() => setError("This photo could not be loaded. Try again.")} />
      <span><ZoomIn size={17} aria-hidden="true" /> Enlarge photo</span>
    </button> : <div className={styles.photoPlaceholder} role="status">Loading photo {number}…</div>}
    <p className={styles.photoCaption}>Photo {number}</p>
    {enlarged && url && !error && <EnlargedPhoto photo={{ url, number }} onClose={() => setEnlarged(false)} />}
  </li>;
}

export function ObserverEvidenceGallery({ reportReference, evidence, evidenceCount = 0 }: {
  reportReference: string;
  evidence?: ObserverEvidenceSummary[];
  evidenceCount?: number;
}) {
  // Only use the backend's observer-safe list. Never infer IDs from a count or
  // reuse Coordinator routes, public storage URLs, or locally cached uploads.
  const seen = new Set<number>();
  const photos = (evidence ?? []).filter((item) => {
    if (item.mediaType !== "photo" || !Number.isSafeInteger(item.evidenceId) || item.evidenceId <= 0 || seen.has(item.evidenceId)) return false;
    seen.add(item.evidenceId);
    return true;
  });

  return <section className={styles.descriptionBlock} aria-labelledby="submitted-evidence-heading">
    <div className={styles.evidenceHeading}>
      <h3 id="submitted-evidence-heading">Submitted evidence</h3>
      {photos.length > 0 && <span>{photos.length} {photos.length === 1 ? "photo" : "photos"}</span>}
    </div>
    {photos.length > 0 ? <>
      <p className={styles.evidenceHelp}>Photos from your report and additional replies. Select a photo to enlarge it.</p>
      <ul className={styles.submittedPhotos} aria-label="Your submitted photos">
        {photos.map((photo, index) => <SubmittedPhoto key={`${reportReference}:${photo.evidenceId}`}
          reportReference={reportReference} evidenceId={photo.evidenceId} number={index + 1} />)}
      </ul>
    </> : <p className={styles.evidenceHelp}>{evidenceCount > 0
      ? "Your photos could not be listed. Refresh the report to try again."
      : "No photos were attached to this report."}</p>}
  </section>;
}
