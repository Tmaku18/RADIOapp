import { LoggerService } from './logger.service';

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(() => 'combine'),
    timestamp: jest.fn(() => 'timestamp'),
    errors: jest.fn(() => 'errors'),
    json: jest.fn(() => 'json'),
    colorize: jest.fn(() => 'colorize'),
    printf: jest.fn((formatter: any) => formatter),
  },
  transports: {
    Console: jest.fn(),
  },
}));

describe('LoggerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs at different levels', () => {
    const configService = { get: jest.fn().mockReturnValue('development') };
    const service = new LoggerService(configService as any);

    service.log('info message', 'Test');
    service.warn('warn message', 'Test');
    service.debug('debug message', 'Test');
    service.verbose('verbose message', 'Test');
    service.error('error message', 'stack', 'Test');

    expect(mockLogger.info).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalled();
    expect(mockLogger.verbose).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('logs with request id', () => {
    const configService = { get: jest.fn().mockReturnValue('development') };
    const service = new LoggerService(configService as any);

    service.logWithRequestId('info', 'message', 'req-1', 'Test', { userId: 'u1' });

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'message',
        requestId: 'req-1',
        context: 'Test',
        userId: 'u1',
      }),
    );
  });

  it('logs request details', () => {
    const configService = { get: jest.fn().mockReturnValue('development') };
    const service = new LoggerService(configService as any);

    service.logRequest('GET', '/api/test', 200, 12, 'req-2', 'user-1');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'http_request',
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        duration: 12,
        requestId: 'req-2',
        userId: 'user-1',
      }),
    );
  });
});
