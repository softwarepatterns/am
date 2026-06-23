export type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function defaultFetchFn(): FetchFn {
  const f = (globalThis as any).fetch as FetchFn | undefined;
  if (typeof f === "function") {
    return f.bind(globalThis);
  }

  return async () => {
    throw new Error(
      "Missing fetch implementation. Provide config.fetchFn or use a runtime with global fetch.",
    );
  };
}

export const fetchGETHeaders = {
  Accept: "application/json",
};

export const fetchPOSTHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/** Adds an Authorization header to RequestInit. Supports Headers, arrays, and plain objects. */
export function updateBearer(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}
