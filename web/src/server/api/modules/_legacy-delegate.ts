import type { NextRequest } from 'next/server';
import type { ApiHandler } from '../types';
import { proxyToLegacyBackend } from '@/lib/strangler/legacy-proxy';

/** Routes through Next.js then forwards to NestJS (strangler hop). */
export const legacyDelegateHandler: ApiHandler = async (
  request: NextRequest,
  pathSegments: string[],
) => proxyToLegacyBackend(request, pathSegments);
