export const createRedisMock = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  lpop: jest.fn(),
  rpush: jest.fn(),
  lrange: jest.fn(),
  expire: jest.fn(),
  publish: jest.fn(),
});

export const createFirebaseAdminMock = () => ({
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    setCustomUserClaims: jest.fn(),
    revokeRefreshTokens: jest.fn(),
  })),
  messaging: jest.fn(() => ({
    send: jest.fn(),
    sendEachForMulticast: jest.fn(),
  })),
});

export const createStripeMock = () => ({
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
});
