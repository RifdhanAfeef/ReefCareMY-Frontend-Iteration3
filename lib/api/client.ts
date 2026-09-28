import { invalidateStoredAuth, readStoredAuth } from "./token-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://reefcare-backend.vercel.app";
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type ApiRequestOptions = Omit<RequestInit, "body" | "signal"> & {
  path: string;
  body?: BodyInit | object;
  auth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

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
      throw new ApiError("The request took too long. Please check your connection and try again.", 408);
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
