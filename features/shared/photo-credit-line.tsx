import { creditsFor } from "@/features/epic-03-threat-explorer/photo-credits";
import type { ReactNode } from "react";
import { ImageSources } from "./image-sources";

/** Collapsible attribution: author linked to the source, licence linked to its terms. */
export function PhotoCreditLine({ images, className, lead = "Photos:", children }: { images: string[]; className?: string; lead?: string; children?: ReactNode }) {
  const credits = creditsFor(images);
  if (credits.length === 0 && !children) return null;
  return (
    <ImageSources className={className}>
      {children}
      {credits.length > 0 && <p>
      {lead}{" "}
      {credits.map((credit, index) => (
        <span key={credit.image}>
          {index > 0 && "; "}
          <a href={credit.source} target="_blank" rel="noreferrer">{credit.author}</a>
          {" ("}
          <a href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a>
          {")"}
        </span>
      ))}
      .
      </p>}
    </ImageSources>
  );
}
