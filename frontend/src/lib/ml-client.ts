import "server-only";

import { mlConfigured, serverEnv } from "./server-env";

export class MlUnavailable extends Error {}

/** Apel către serviciul ML intern, cu tokenul partajat și timeout. */
export async function callMl<T>(path: string, body: unknown, timeoutMs = 15_000): Promise<T> {
  if (!mlConfigured()) throw new MlUnavailable("ML_SERVICE_TOKEN nu e configurat.");
  let res: Response;
  try {
    res = await fetch(`${serverEnv.mlServiceUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serverEnv.mlServiceToken}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new MlUnavailable("Serviciul ML nu răspunde.");
  }
  if (res.status === 503 || res.status === 401) throw new MlUnavailable(`Serviciul ML a răspuns ${res.status}.`);
  if (!res.ok) throw new Error(`ML ${res.status}`);
  return (await res.json()) as T;
}
