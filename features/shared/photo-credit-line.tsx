import { creditsFor } from "@/features/epic-03-threat-explorer/photo-credits";

/** Inline attribution for real photographs: author linked to the source, licence linked to its terms. */
export function PhotoCreditLine({ images, className, lead = "Photos:" }: { images: string[]; className?: string; lead?: string }) {
  const credits = creditsFor(images);
  if (credits.length === 0) return null;
  return (
    <p className={className}>
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
    </p>
  );
}
