import type { ApiHandler } from '../types';
import { API_MODULE_PREFIXES } from '@/lib/strangler/config';
import { legacyDelegateHandler } from './_legacy-delegate';
import { healthHandler } from './health';
import { authHandler } from './auth';
import { usersHandler } from './users';
import { paymentsHandler } from './payments';

/** Fully ported handlers override the legacy delegate. */
const PORTED_HANDLERS: Partial<Record<string, ApiHandler>> = {
  health: healthHandler,
  auth: authHandler,
  users: usersHandler,
  payments: paymentsHandler,
};

/** Every NestJS module prefix gets a handler (ported or legacy delegate). */
export function buildModuleHandlers(): Record<string, ApiHandler> {
  const handlers: Record<string, ApiHandler> = {};
  for (const prefix of API_MODULE_PREFIXES) {
    handlers[prefix] = PORTED_HANDLERS[prefix] ?? legacyDelegateHandler;
  }
  return handlers;
}

export const MODULE_HANDLERS = buildModuleHandlers();
