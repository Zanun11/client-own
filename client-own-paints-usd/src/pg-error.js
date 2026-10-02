export class PgError extends Error {
  constructor(message, code = "P0001", extra = {}) {
    super(message);
    this.name = "PgError";
    this.code = code;
    this.isPgError = true;
    Object.assign(this, extra);
  }

  toString() {
    return `${this.code}: ${this.message}${this.detail ? ` — ${this.detail}` : ""}`;
  }
}

export const PG_ERROR_HINTS = {
  "23502": "not-null constraint",
  "23503": "foreign key constraint",
  "23505": "unique constraint",
  "23514": "check constraint",
  "42501": "row-level security / permission denied",
  "42P01": "undefined table",
  "42703": "undefined column",
  "42883": "undefined function",
  "22023": "invalid parameter value",
  "08006": "connection failure",
  "0A000": "feature not supported by this backend",
};
