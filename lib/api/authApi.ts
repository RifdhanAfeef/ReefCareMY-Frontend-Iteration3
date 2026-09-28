import { apiRequest } from "./client";
import type { AuthResult, AuthUser, RegisteredUser, RegisterPayload } from "./types";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_DISPLAY_NAME_LENGTH = 100;
export const MIN_DISTINCT_PASSWORD_CHARACTERS = 4;

export function passwordMeetsRequirements(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH &&
    new Set(password).size >= MIN_DISTINCT_PASSWORD_CHARACTERS;
}

type NestedAuthResult = {
  user: AuthUser;
  session: {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
  };
};

function normaliseAuthResult(result: AuthResult | NestedAuthResult): AuthResult {
  if ("session" in result) {
    return { user: result.user, ...result.session };
  }
  return result;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const body = new URLSearchParams({ username: email, password });

  const result = await apiRequest<AuthResult | NestedAuthResult>({
    path: "/api/v1/auth/login",
    method: "POST",
    body,
    auth: false,
  });
  return normaliseAuthResult(result);
}

export async function register(payload: RegisterPayload): Promise<RegisteredUser> {
  const { email, displayName, password } = payload;

  return apiRequest<RegisteredUser>({
    path: "/api/v1/auth/register",
    method: "POST",
    body: { email, displayName, password },
    auth: false,
  });
}

export async function getCurrentUser(): Promise<AuthUser> {
  return apiRequest<AuthUser>({ path: "/api/v1/auth/me" });
}
