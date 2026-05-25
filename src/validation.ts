export function requiredString(value: string | undefined, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} is required.`);
  }
}

export function optionalString(value: string | undefined, name: string): void {
  if (value !== undefined && typeof value !== "string") {
    throw new TypeError(`${name} must be a string.`);
  }
}

export function stringLength(
  value: string | undefined,
  name: string,
  options: { min?: number; max?: number },
): void {
  if (value === undefined) {
    return;
  }

  optionalString(value, name);

  if (options.min !== undefined && value.length < options.min) {
    throw new RangeError(`${name} must be at least ${options.min} characters.`);
  }

  if (options.max !== undefined && value.length > options.max) {
    throw new RangeError(`${name} must be at most ${options.max} characters.`);
  }
}

export function stringPattern(value: string | undefined, name: string, pattern: RegExp): void {
  if (value !== undefined && !pattern.test(value)) {
    throw new RangeError(`${name} has an invalid format.`);
  }
}

export function positiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

export function optionalInteger(value: number | undefined, name: string): void {
  if (value !== undefined && !Number.isInteger(value)) {
    throw new RangeError(`${name} must be an integer.`);
  }
}

export function nonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer.`);
  }
}

export function integerInRange(value: number, name: string, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
  }
}

export function optionalBoolean(value: boolean | undefined, name: string): void {
  if (value !== undefined && typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean.`);
  }
}

export function oneOf<T extends string | number>(
  value: T | undefined,
  name: string,
  allowedValues: readonly T[],
): void {
  if (value !== undefined && !allowedValues.includes(value)) {
    throw new RangeError(`${name} must be one of: ${allowedValues.join(", ")}.`);
  }
}
