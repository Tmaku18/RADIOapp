/** How long a self-service deletion can be undone by signing in again. */
export const ACCOUNT_DELETION_GRACE_MS = 48 * 60 * 60 * 1000;

export const ACCOUNT_DELETION_PENDING_MESSAGE =
  'This account is scheduled for deletion. Sign in again within 48 hours to restore it.';

export const ACCOUNT_DELETION_EXPIRED_MESSAGE =
  'This account is past the 48-hour recovery window and is being permanently deleted.';
