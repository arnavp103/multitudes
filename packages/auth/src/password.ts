/**
 * Password policy shared by the auth server, sign-up/sign-in forms, and the
 * operator bootstrap command. Client-safe: this module has no server imports.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** Better Auth's default upper bound; longer inputs are rejected before hashing. */
export const MAX_PASSWORD_LENGTH = 128;
