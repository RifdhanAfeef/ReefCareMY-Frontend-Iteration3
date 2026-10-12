import { invalidateStoredAuth, readStoredAuth } from "./token-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://reefcare-backend.vercel.app";
const REQUEST_TIMEOUT_MS = 15_000;

export type ApiValidationIssue = {
  path: Array<string | number>;
  type: string;
  minimumLength?: number;
};

export class ApiError extends Error {
  status: number;
  /** The message the API itself sent, or null when `message` is a client-side fallback. */
  serverMessage: string | null;
  validationIssues: ApiValidationIssue[];
  responseReceived: boolean;

  constructor(message: string, status: number, serverMessage: string | null = null, validationIssues: ApiValidationIssue[] = [], responseReceived = true) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.serverMessage = serverMessage;
    this.validationIssues = validationIssues;
    this.responseReceived = responseReceived;
  }
}

// Retain field names and constraint types, never submitted values or raw backend details.
function validationIssues(payload: unknown): ApiValidationIssue[] {
  if (!payload || typeof payload !== "object" || !("detail" in payload) || !Array.isArray(payload.detail)) return [];
  return payload.detail.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const issue = entry as { loc?: unknown; type?: unknown; ctx?: { min_length?: unknown } };
    if (!Array.isArray(issue.loc)) return [];
    const path = issue.loc.filter((part): part is string | number => typeof part === "string" || typeof part === "number");
    const minimumLength = issue.ctx?.min_length;
    return [{ path, type: typeof issue.type === "string" ? issue.type : "",
      ...(typeof minimumLength === "number" && Number.isSafeInteger(minimumLength) && minimumLength > 0 ? { minimumLength } : {}),
    }];
  });
}

export type ApiRequestOptions = Omit<RequestInit, "body" | "signal"> & {
  path: string;
  body?: BodyInit | object;
  auth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

/** The API's own message: `detail` from error handlers, or `message` from state responses such as an unavailable analysis. */
function extractServerMessage(payload: unknown): string | null {
  const detail = extractErrorMessage(payload, "");
  if (detail) return detail;
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return null;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((entry) =>
          entry && typeof entry === "object" && "msg" in entry
            ? String((entry as { msg: unknown }).msg)
            : null,
        )
        .filter((msg): msg is string => Boolean(msg));

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
  }

  return fallback;
}

async function executeRequest({
  path,
  headers,
  body,
  auth = true,
  signal,
  timeoutMs = REQUEST_TIMEOUT_MS,
  ...options
}: ApiRequestOptions): Promise<Response> {
  const requestHeaders = new Headers(headers);
  let requestBody: BodyInit | undefined;

  if (body instanceof URLSearchParams || body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  if (auth) {
    const token = readStoredAuth()?.accessToken;
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const requestController = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => requestController.abort();
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, timeoutMs);
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: requestHeaders,
      body: requestBody,
      signal: requestController.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ApiError("The request took too long. Please check your connection and try again.", 408, null, [], false);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  if (!response.ok) {
    if (auth && response.status === 401) {
      invalidateStoredAuth();
    }
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      extractErrorMessage(payload, "ReefCare MY could not complete the request. Please try again."),
      response.status,
      extractServerMessage(payload),
      validationIssues(payload),
    );
  }

  return response;
}

export async function apiRequest<T>({
  ...options
}: ApiRequestOptions): Promise<T> {
  const response = await executeRequest(options);

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiBlobRequest(options: ApiRequestOptions): Promise<Blob> {
  const response = await executeRequest(options);
  return response.blob();
}
