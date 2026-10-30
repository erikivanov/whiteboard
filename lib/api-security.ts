export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const MAX_BODY_BYTES = 2_000_000;

// Count bytes actually received; Content-Length is optional and cannot be trusted.
export async function readBoundedJson(request: Request, timeoutMs = 10_000): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new RequestError("JSON erforderlich", 415);
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES)
    throw new RequestError("Board ist zu groß", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Fehlende Anfrage", 400);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = async () => {
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new RequestError("Board ist zu groß", 413);
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let result: unknown;
    try { result = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new RequestError("Ungültiges JSON", 400); }
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new RequestError("Ungültige Anfrage", 400);
    return result as Record<string, unknown>;
  };
  try {
    return await Promise.race([read(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RequestError("Anfrage dauert zu lange", 408)), timeoutMs);
    })]);
  } finally { clearTimeout(timer); void reader.cancel().catch(() => {}); }
}

export function sameOriginRequest(request: Request, origin: string) {
  const supplied = request.headers.get("origin");
  return request.headers.get("sec-fetch-site") !== "cross-site" && (supplied === null || supplied === origin);
}
