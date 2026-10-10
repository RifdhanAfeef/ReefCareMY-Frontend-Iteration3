"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  getOpenInformationRequest,
  getReportDetail,
  submitInformationResponseWithPhotos,
} from "@/lib/api/reportsApi";
import type {
  ObserverInformationRequest,
  ReportDetail as ReportDetailData,
} from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import { formatDateTime, inputDateToDisplayValue } from "@/lib/format/date";
import {
  readSubmittedStructuredDetails,
  type SubmittedStructuredDetails,
} from "@/features/epic-02-reporting/submitted-structured-details";
import styles from "./report-detail.module.css";

const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
const maxPhotoSize = 10 * 1024 * 1024;
const maxReplyPhotos = 5;

type SelectedReplyPhoto = { file: File; previewUrl: string };

type LoadState = "loading" | "loaded" | "error";
export function ReportDetail({ reportReference }: { reportReference: string }) {
  const [report, setReport] = useState<ReportDetailData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [informationRequest, setInformationRequest] = useState<ObserverInformationRequest | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseError, setResponseError] = useState("");
  const [responseSuccess, setResponseSuccess] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responsePhotos, setResponsePhotos] = useState<SelectedReplyPhoto[]>([]);
  const [photoError, setPhotoError] = useState("");
  const responseBusy = useRef(false);
  const photoUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = photoUrls.current;
    return () => { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); };
  }, []);
  const structuredDetails = useMemo<SubmittedStructuredDetails>(
    () => readSubmittedStructuredDetails(reportReference),
    [reportReference],
  );

  useEffect(() => {
    let cancelled = false;

    getReportDetail(reportReference)
      .then(async (result) => {
        if (!cancelled) {
          setReport(result);
          setState("loaded");
        }
        if (result.status === "needs_more_info") {
          const request = await getOpenInformationRequest(reportReference).catch(() => null);
          if (!cancelled) setInformationRequest(request);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(userFacingError(err, "We couldn’t load this report right now."));
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reportReference]);

  function clearPhotoSelection() {
    for (const url of photoUrls.current) URL.revokeObjectURL(url);
    photoUrls.current.clear();
    setResponsePhotos([]);
    setPhotoError("");
  }

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (responseBusy.current || selected.length === 0) return;
    if (responsePhotos.length + selected.length > maxReplyPhotos) {
      setPhotoError("Attach up to 5 photos. Remove a selected photo before adding more.");
      return;
    }
    if (selected.some((file) => !allowedPhotoTypes.includes(file.type) || file.size === 0 || file.size > maxPhotoSize)) {
      setPhotoError("Choose non-empty JPG, PNG or WebP photos, up to 10 MB each. These files were not added.");
      return;
    }
    setPhotoError("");
    const photos = selected.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      photoUrls.current.add(previewUrl);
      return { file, previewUrl };
    });
    setResponsePhotos((current) => [...current, ...photos]);
  }

  async function respondToRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (responseBusy.current) return;
    const text = responseText.trim();
    setResponseError("");
    setResponseSuccess("");
    if (photoError) return;
    if (!text) {
      setResponseError("Add the requested details before submitting.");
      return;
    }

    responseBusy.current = true;
    setSubmittingResponse(true);
    try {
      const payload = {
        responseText: text,
      };
      const result = await submitInformationResponseWithPhotos(reportReference, payload, responsePhotos.map((photo) => photo.file));
      setReport((current) => current ? {
        ...current,
        status: result.status,
        statusLabel: "Being reviewed",
        informationRequestReason: null,
      } : current);
      setInformationRequest(null);
      setResponseText("");
      clearPhotoSelection();
      setResponseSuccess("Your additional information was submitted and attached to this report.");
      window.dispatchEvent(new CustomEvent("reefcare:report-updated", {
        detail: { reportReference },
      }));
    } catch (requestError) {
      const message = requestError instanceof ApiError && requestError.status === 413
        ? "A photo exceeds the upload limit. Choose smaller photos and try again."
        : requestError instanceof ApiError && requestError.status === 400
          ? "Check that each photo is a non-empty JPG, PNG or WebP file and that no more than 5 are attached."
          : requestError instanceof ApiError && requestError.status === 409
            ? "This information request may already be answered or closed. Refresh the report before trying again."
            : userFacingError(requestError, "Your response could not be submitted. Please try again.");
      // Keep the text and files for a clean retry; the backend saves them atomically.
      setResponseError(message);
    } finally {
      responseBusy.current = false;
      setSubmittingResponse(false);
    }
  }

  if (state === "loading") {
    return <p>Loading report…</p>;
  }

  if (state === "error" || !report) {
    return <p role="alert">{error ?? "We couldn’t load this report right now."}</p>;
  }

  return (
    <section className={styles.detail} aria-labelledby="report-overview-heading">
      <header className={styles.cardHeader}>
        <div>
          <h2 id="report-overview-heading">What you reported</h2>
        </div>
        <span className={styles.statusChip}>{report.statusLabel}</span>
      </header>

      <dl className={styles.summary}>
        <div className={styles.row}>
          <dt>Threat type</dt>
          <dd>{report.threatCategory}</dd>
        </div>
        <div className={styles.row}>
          <dt>Location</dt>
          <dd>{report.diveSite ?? report.generalLocation}</dd>
        </div>
        <div className={styles.row}>
          <dt>Observed</dt>
          <dd>
            <time dateTime={report.observedAt}>{formatDateTime(new Date(report.observedAt))}</time>
          </dd>
        </div>
        {report.estimatedDepthMetres != null && (
          <div className={styles.row}>
            <dt>Estimated depth</dt>
            <dd>{report.estimatedDepthMetres} m</dd>
          </div>
        )}
      </dl>

      <section className={styles.descriptionBlock} aria-labelledby="observation-description-heading">
        <h3 id="observation-description-heading">Your observation</h3>
        <p className={styles.description}>{report.description}</p>
      </section>

      {report.preciseLocation?.latitude != null && report.preciseLocation?.longitude != null && (
        <div className={styles.locationNote}>
          <strong>Submitted location</strong>
          <p>
            {report.preciseLocation.latitude}, {report.preciseLocation.longitude}
            {report.preciseLocation.uncertaintyMetres != null &&
              ` (± ${report.preciseLocation.uncertaintyMetres} m)`}
          </p>
        </div>
      )}

      {report.preciseLocation?.relocationNotes && (
        <div className={styles.surfaceContextNote}>
          <strong>Surface entry and exit context</strong>
          <p>{report.preciseLocation.relocationNotes}</p>
          <small>Context only — not the exact underwater threat location.</small>
        </div>
      )}

      <details className={styles.structuredDetails}>
        <summary>Structured report details</summary>
        <dl>
          <div>
            <dt>Estimated depth</dt>
            <dd>{structuredDetails.estimated_depth_metres ?? (report.estimatedDepthMetres != null ? `${report.estimatedDepthMetres} m` : "Not included")}</dd>
          </div>
          <div><dt>Approximate size</dt><dd>{structuredDetails.approximate_size ?? "Not included"}</dd></div>
          <div><dt>Coral interaction</dt><dd>{structuredDetails.coral_interaction ?? "Not included"}</dd></div>
          <div><dt>Marine-animal interaction</dt><dd>{structuredDetails.animal_interaction ?? "Not included"}</dd></div>
          <div><dt>Site reference</dt><dd>{structuredDetails.site_reference ?? "Not included"}</dd></div>
        </dl>
      </details>

      {report.status === "needs_more_info" && (informationRequest?.requestText || report.informationRequestReason) && (
        <section className={styles.infoRequest} aria-labelledby="information-request-heading">
          <h2 id="information-request-heading">More information needed</h2>
          <p>{informationRequest?.requestText ?? report.informationRequestReason}</p>
          {informationRequest?.requestedAt && (
            <p className={styles.requestedAt}>Requested {formatDateTime(new Date(informationRequest.requestedAt))}</p>
          )}
          <form className={styles.responseForm} onSubmit={respondToRequest}>
            <label htmlFor="information-response">Additional details</label>
            <textarea
              id="information-response"
              value={responseText}
              onChange={(event) => setResponseText(event.target.value)}
              maxLength={2000}
              disabled={submittingResponse}
              aria-invalid={Boolean(responseError)}
              aria-describedby="information-response-help"
              placeholder="Add the details requested above."
            />
            <div className={styles.responseMeta} id="information-response-help">
              <small>{responseText.length}/2000 characters</small>
              <small>Written details are required. Photos are optional.</small>
            </div>
            <label htmlFor="information-response-photos">Additional photos (optional)</label>
            <input id="information-response-photos" type="file" multiple
              accept="image/jpeg,image/png,image/webp" onChange={choosePhotos}
              disabled={submittingResponse} aria-describedby="information-response-photos-help"
              aria-invalid={Boolean(photoError)} />
            <small id="information-response-photos-help">Up to 5 JPG, PNG or WebP photos, 10 MB each. Photos stay private with your report.</small>
            {responsePhotos.length > 0 && <ul className={styles.replyPhotos} aria-label="Selected additional photos">
              {responsePhotos.map(({ file, previewUrl }, index) => <li key={previewUrl}>
                <Image src={previewUrl} width={120} height={90} unoptimized alt={`Selected photo: ${file.name}`} />
                <span>{file.name}</span>
                <button className={styles.removePhoto} type="button" disabled={submittingResponse}
                  aria-label={`Remove photo ${index + 1}: ${file.name}`} onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    photoUrls.current.delete(previewUrl);
                    setResponsePhotos((current) => current.filter((_, position) => position !== index));
                    setPhotoError("");
                  }}>Remove</button>
              </li>)}
            </ul>}
            {photoError && <div><p className={styles.responseError} role="alert">{photoError}</p>
              <button className={styles.removePhoto} type="button" disabled={submittingResponse} onClick={clearPhotoSelection}>Clear photo selection</button></div>}
            {responseError && <p className={styles.responseError} role="alert">{responseError}</p>}
            <button type="submit" disabled={submittingResponse || Boolean(photoError)}>
              {submittingResponse ? "Submitting…" : "Submit additional information"}
            </button>
          </form>
        </section>
      )}

      {responseSuccess && <p className={styles.responseSuccess} role="status">{responseSuccess}</p>}

      {/* E6 uses the backend's latest observer-safe projection. Publication is
          an E8 public-activity rule, not a condition for viewing your own report. */}
      {report.contribution && (
        <section className={styles.descriptionBlock} aria-labelledby="report-contribution-heading">
          <h3 id="report-contribution-heading">Your contribution</h3>
          <p className={styles.description}><strong>{report.contribution.label}</strong></p>
          {report.contribution.detail && <p className={styles.description}>{report.contribution.detail}</p>}
          {["planned", "action_planned"].includes(report.contribution.state) && (
            <p className={styles.description}>This work is planned. It has not been recorded as completed.</p>
          )}
          {report.contribution.contributionType === "sourced_outcome" && (
            <p className={styles.description}>This outcome was reported by an external source. It is not a record of work completed by ReefCare MY.</p>
          )}
          {report.contribution.recordedAt && (
            <p className={styles.requestedAt}>
              Recorded <time dateTime={report.contribution.recordedAt}>{formatDateTime(new Date(report.contribution.recordedAt))}</time>
            </p>
          )}
          {report.contribution.nextFollowUpRequired && (
            <p className={styles.description}>
              Next follow-up: {report.contribution.nextFollowUpDate
                ? <time dateTime={report.contribution.nextFollowUpDate}>{inputDateToDisplayValue(report.contribution.nextFollowUpDate)}</time>
                : "Required; date not yet recorded."}
            </p>
          )}
        </section>
      )}

      {report.closure && (
        <section className={styles.closure} aria-labelledby="report-outcome-heading">
          <h2 id="report-outcome-heading">Outcome</h2>
          <p>
            <strong>{report.closure.closureLabel}</strong>
            {report.closure.publicNote && ` — ${report.closure.publicNote}`}
          </p>
        </section>
      )}
    </section>
  );
}
