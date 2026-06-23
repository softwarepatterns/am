/** Converts a string from snake_case to camelCase. */
export function camelCaseStr(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Converts all keys in an object from snake_case to camelCase. */
export function camelCaseObj(input: unknown): any {
  if (input === null || typeof input !== "object") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => camelCaseObj(item));
  }

  const obj = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[camelCaseStr(key)] = camelCaseObj(obj[key]);
    }
  }

  return result;
}

/** Converts a string from camelCase to snake_case. */
export function snakeCaseStr(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Converts all keys in an object from camelCase to snake_case. */
export function snakeCaseObj(input: unknown): any {
  if (input === null || typeof input !== "object") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => snakeCaseObj(item));
  }

  const obj = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[snakeCaseStr(key)] = snakeCaseObj(obj[key]);
    }
  }

  return result;
}
