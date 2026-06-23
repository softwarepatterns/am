export async function readResJsonAsObject(
  res: Response,
): Promise<Record<string, unknown> | null> {
  try {
    const json = await res.json();
    if (typeof json === "object" && json !== null && !Array.isArray(json)) {
      return json;
    }
    return null;
  } catch {
    return null;
  }
}

export function isProblemJsonResponse(res: Response): boolean {
  const contentType = res.headers.get("Content-Type") || "";
  return contentType.includes("application/problem+json");
}
