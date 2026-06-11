import { SignJWT, jwtVerify } from "jose";

import type { AgentAccessTokenClaims, AgentCapability, AgentTokenPair } from "./types";

const issuer = "teampitch-agent";
const accessTokenTtlSeconds = 60 * 60;
const refreshTokenTtlSeconds = 60 * 60 * 24 * 30;
const authorizationCodeTtlSeconds = 10 * 60;

export function authorizationCodeExpiresAt(now = new Date()): string {
  return addSeconds(now, authorizationCodeTtlSeconds).toISOString();
}

function accessTokenExpiresAt(now = new Date()): string {
  return addSeconds(now, accessTokenTtlSeconds).toISOString();
}

function refreshTokenExpiresAt(now = new Date()): string {
  return addSeconds(now, refreshTokenTtlSeconds).toISOString();
}

export async function createAgentTokenPair(
  claims: Omit<AgentAccessTokenClaims, "iss" | "typ" | "iat" | "exp" | "jti">,
  secret: string,
  now = new Date()
): Promise<AgentTokenPair> {
  const accessTokenExpires = accessTokenExpiresAt(now);
  const refreshTokenExpires = refreshTokenExpiresAt(now);

  return {
    accessToken: await signAgentAccessToken(claims, secret, now),
    accessTokenExpiresAt: accessTokenExpires,
    refreshToken: createOpaqueToken("art"),
    refreshTokenExpiresAt: refreshTokenExpires,
    tokenType: "Bearer"
  };
}

async function signAgentAccessToken(
  claims: Omit<AgentAccessTokenClaims, "iss" | "typ" | "iat" | "exp" | "jti">,
  secret: string,
  now = new Date()
): Promise<string> {
  return new SignJWT({
    ...claims,
    typ: "agent_access"
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setIssuedAt(epochSeconds(now))
    .setExpirationTime(epochSeconds(addSeconds(now, accessTokenTtlSeconds)))
    .setJti(crypto.randomUUID())
    .sign(secretKey(secret));
}

export async function verifyAgentAccessToken(
  token: string,
  secret: string
): Promise<AgentAccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    issuer
  });

  if (payload.typ !== "agent_access") {
    throw new Error("Invalid agent token type");
  }

  return payload as unknown as AgentAccessTokenClaims;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64Url(new Uint8Array(digest));
}

export async function verifyPkceChallenge(verifier: string, challenge: string): Promise<boolean> {
  return (await pkceChallenge(verifier)) === challenge;
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function createAuthorizationCode(): string {
  return createOpaqueToken("ac");
}

export function parseCapabilityScope(scope: string | null): AgentCapability[] {
  if (!scope) return [];

  const capabilities = scope.split(/\s+/).filter(Boolean).filter(isAgentCapability);

  return [...new Set(capabilities)];
}

function isAgentCapability(value: string): value is AgentCapability {
  return (
    value === "memory:read" ||
    value === "memory:write" ||
    value === "memory:lifecycle" ||
    value === "routing:write" ||
    value === "tools:schedule"
  );
}

export function tokenScope(capabilities: readonly AgentCapability[]): string {
  return capabilities.join(" ");
}

function createOpaqueToken(prefix: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${prefix}_${base64Url(bytes)}`;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function epochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
