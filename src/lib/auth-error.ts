import type { ProblemDetails } from "./problem-details";

/**
 * AuthError represents structured authentication failures from Accountmaker endpoints.
 *
 * AuthError wraps RFC 7807 Problem Details. invalidParams may be present for field-level validation.
 * Network failures throw other error types.
 *
 * Also note that the `type` field often contains a URI that points to documentation about the
 * specific error type, including how to resolve it, code samples, and links to the RFCs or other
 * standards that define the error.
 *
 * @example
 * ```ts
 * try {
 *  const session = await am.signIn({ email: 'test@example.com', password: 'password123' });
 * } catch (e) {
 *  if (e instanceof AuthError) {
 *   console.error("Authentication failed:", e.title);
 *   if (e.invalidParams) {
 *    for (const param of e.invalidParams) {
 *      console.error(` - Invalid parameter: ${param.path} (${param.type})`);
 *     }
 *    }
 *   } else {
 *    console.error("Unexpected error:", e);
 *   }
 * }
 * ```
 *
 * Note that HTTP error codes are distinctly:
 * - 400: Client error (bad request, invalid input, etc.)
 * - 401: Unauthenticated (we don't know who you are)
 * - 402: Payment required (e.g. billing issue)
 * - 403: Unauthorized (we know who you are, but you don't have permission)
 * - 404: Not found
 * - 409: Conflict (email already registered, user already invited, etc.)
 * - 429: Too many requests (rate limiting)
 * - 500: Internal server error (server's fault)
 */
export class AuthError extends Error {
  public readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.title);
    this.name = "AuthError";
    this.problem = Object.freeze(problem);
  }
  get type(): string {
    return this.problem.type;
  }
  get title(): string {
    return this.problem.title;
  }
  get status(): number {
    return this.problem.status;
  }
  get code(): string | undefined {
    return this.problem.code;
  }
  get detail(): string | undefined {
    return this.problem.detail;
  }
  get invalidParams(): ProblemDetails["invalidParams"] | undefined {
    return this.problem.invalidParams;
  }
}
