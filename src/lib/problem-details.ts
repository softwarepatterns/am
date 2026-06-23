/**
 * Standard error object following RFC 7807 (Problem Details for HTTP APIs).
 *
 * Returned in AuthError.problem when the server responds with application/problem+json.
 *
 * - `type`: A URI reference that identifies the problem type. Often links to human-readable documentation.
 * - `title`: A short, human-readable summary of the problem type.
 * - `status`: The HTTP status code.
 * - `code`: Application-specific error code for programmatic handling. Maps to the final part of the error type.
 * - `detail`: Human-readable explanation specific to this occurrence. Do not rely on this for programmatic handling.
 * - `invalidParams`: Present on validation errors (typically 400). Provides field-level details
 *   for building precise UI feedback and can be used for programmatic handling. Each entry includes:
 *   - `in`: Location of the invalid parameter (body, cookie, header, query, path).
 *   - `path`: Dot-separated path to the invalid parameter.
 *   - `type`: Error type code for this parameter (e.g. "required", "email", "min_length").
 *   - `received`: The actual value received.
 *   - `expected`: (optional) Description of the expected value.
 *
 * @example
 * ```ts
 * catch (e) {
 *   if (e instanceof AuthError && e.invalidParams) {
 *     const errors = e.invalidParams.reduce((acc, p) => {
 *       acc[p.path] = p.type;
 *       return acc;
 *     }, {} as Record<string, string>);
 *     setFieldErrors(errors);
 *   }
 * }
 * ```
 */
export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code?: string;
  detail?: string;
  invalidParams?: {
    in: "body" | "cookie" | "header" | "query" | "path";
    path: string;
    type: string;
    received: unknown;
    expected?: string;
  }[];
};

/** Converts a Response object to a generic ProblemDetails object. */
export function toGenericProblemDetails(
  res: Response,
  detail?: unknown,
): ProblemDetails {
  return {
    type: "about:blank",
    title: res.statusText || "Request failed",
    status: res.status,
    detail: typeof detail === "string" ? detail : undefined,
  };
}

/** Type guard to check if an object is a ProblemDetails. */
export function isProblemDetails(x: unknown): x is ProblemDetails {
  if (!x || typeof x !== "object") {
    return false;
  }
  const obj = x as Record<string, unknown>;
  return (
    typeof obj.type === "string" &&
    typeof obj.title === "string" &&
    typeof obj.status === "number"
  );
}
