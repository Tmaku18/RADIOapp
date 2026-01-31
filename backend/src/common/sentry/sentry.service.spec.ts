import { SentryService } from './sentry.service';

jest.mock('@sentry/node', () => {
  const mockScope = { setExtras: jest.fn() };
  const withScope = jest.fn((cb: (scope: any) => void) => cb(mockScope));
  return {
    init: jest.fn(),
    withScope,
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setUser: jest.fn(),
    addBreadcrumb: jest.fn(),
    httpIntegration: jest.fn(() => 'http'),
    __mockScope: mockScope,
  };
});

const sentry = jest.requireMock('@sentry/node');

describe('SentryService', () => {
  const logger = {
    warn: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips init when DSN is missing', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'SENTRY_DSN') return undefined;
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      }),
    };
    const service = new SentryService(configService as any, logger as any);

    service.onModuleInit();

    expect(logger.warn).toHaveBeenCalled();
  });

  it('initializes and captures events when DSN provided', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'SENTRY_DSN') return 'https://example.com/123';
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      }),
    };
    const service = new SentryService(configService as any, logger as any);

    service.onModuleInit();
    service.captureException(new Error('boom'), { extra: true });
    service.captureMessage('hello', 'info', { foo: 'bar' });
    service.setUser({ id: 'user-1' });
    service.clearUser();
    service.addBreadcrumb({ message: 'test' } as any);

    expect(sentry.withScope).toHaveBeenCalled();
  });
});
