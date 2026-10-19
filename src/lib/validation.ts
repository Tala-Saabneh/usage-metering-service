export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

export function validExternalUserId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 150
  );
}

export function parseMonth(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}

export function parsePagination(query: Record<string, unknown>) {
  const limitValue = query.limit;
  const offsetValue = query.offset;

  const limit =
    typeof limitValue === "string" && /^\d+$/.test(limitValue)
      ? Number(limitValue)
      : 50;

  const offset =
    typeof offsetValue === "string" && /^\d+$/.test(offsetValue)
      ? Number(offsetValue)
      : 0;

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    return null;
  }

  return { limit, offset };
}
