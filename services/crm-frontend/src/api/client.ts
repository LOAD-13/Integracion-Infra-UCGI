const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  username: string;
  role: string;
  mustChangePassword?: boolean;
}

export async function parseError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // El backend a veces devuelve text/plain en errores de filtro Spring Security
  }
  const message =
    (body && typeof body === "object" && "message" in body
      ? String((body as { message: unknown }).message)
      : null) ?? response.statusText;
  return new ApiError(response.status, message, body);
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as LoginResponse;
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export async function authorizedFetch(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler();
  }
  return response;
}

export interface SipCredentialsResponse {
  extension: string;
  displayName: string;
  secret: string;
}

export async function fetchSipCredentials(
  token: string,
): Promise<SipCredentialsResponse> {
  const response = await authorizedFetch(token, "/v1/me/sip-credentials");
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as SipCredentialsResponse;
}
