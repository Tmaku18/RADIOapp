declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      user?: { uid: string; email?: string; emailVerified?: boolean };
    }
  }
}

export {};
