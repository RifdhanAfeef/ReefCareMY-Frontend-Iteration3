"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getOpenInformationRequest,
  getReportDetail,
  submitInformationResponse,
} from "@/lib/api/reportsApi";
import type {
  ObserverInformationRequest,
  ReportDetail as ReportDetailData,
} from "@/lib/api/types";
import { userFacingError } from "@/lib/api/user-facing-error";
import { formatDateTime } from "@/lib/format/date";
import {
  readSubmittedStructuredDetails,
  type SubmittedStructuredDetails,
} from "@/features/epic-02-reporting/submitted-structured-details";
import styles from "./report-detail.module.css";

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

  async function respondToRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = responseText.trim();
    setResponseError("");
    setResponseSuccess("");
    if (!text) {
      setResponseError("Add the requested details before submitting.");
      return;
    }

    setSubmittingResponse(true);
    try {
      const payload = {
        responseText: text,
      };
      const result = await submitInformationResponse(reportReference, payload);
      setReport((current) => current ? {
        ...current,
        status: result.status,
        statusLabel: "Being reviewed",
        informationRequestReason: null,
      } : current);
      setInformationRequest(null);
      setResponseText("");
      setResponseSuccess("Your additional information was submitted and attached to this report.");
      window.dispatchEvent(new CustomEvent("reefcare:report-updated", {
        detail: { reportReference },
      }));
    } catch (requestError) {
      setResponseError(userFacingError(requestError, "Your response could not be submitted. Please try again."));
    } finally {
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
          <p className={styles.eyebrow}>Observation summary</p>
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

      {(informationRequest?.requestText || report.informationRequestReason) && (
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
              <small>Photograph uploads are temporarily unavailable. Please respond in writing.</small>
            </div>
            {responseError && <p className={styles.responseError} role="alert">{responseError}</p>}
            <button type="submit" disabled={submittingResponse}>
              {submittingResponse ? "Submitting…" : "Submit additional information"}
            </button>
          </form>
        </section>
      )}

      {responseSuccess && <p className={styles.responseSuccess} role="status">{responseSuccess}</p>}

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
