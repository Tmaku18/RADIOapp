export type SupabaseBuilderMock = {
  select: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  is: jest.Mock;
  in: jest.Mock;
  ilike: jest.Mock;
  or: jest.Mock;
  not: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  range: jest.Mock;
};

export const createSupabaseMock = () => {
  const builder: SupabaseBuilderMock & {
    __result: { data: any; error: any };
    then: (
      resolve: (value: any) => void,
      reject?: (reason: any) => void,
    ) => void;
  } = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    is: jest.fn(() => builder),
    in: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    or: jest.fn(() => builder),
    not: jest.fn(() => builder),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    range: jest.fn(() => builder),
    __result: { data: null, error: null },
    then: (resolve, reject) => {
      Promise.resolve(builder.__result).then(resolve, reject);
    },
  };

  const bucketApi = () => ({
    createSignedUrl: jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
      error: null,
    }),
    createSignedUploadUrl: jest.fn(async (path: string) => ({
      data: {
        signedUrl: 'https://example.com/upload',
        path,
      },
      error: null,
    })),
    upload: jest.fn(async (_path: string, _body: unknown, _opts?: unknown) => ({
      data: { path: _path },
      error: null,
    })),
    // Default to "the searched object exists and is small", which is the happy
    // path for verifying a direct-to-storage upload.
    list: jest.fn(async (_prefix?: string, opts?: { search?: string }) => ({
      data: opts?.search ? [{ name: opts.search, metadata: { size: 1024 } }] : [],
      error: null,
    })),
    remove: jest.fn().mockResolvedValue({ data: null, error: null }),
    getPublicUrl: jest.fn(() => ({
      data: { publicUrl: 'https://example.com/file' },
    })),
  });

  const storage = {
    from: jest.fn(() => bucketApi()),
    getBucket: jest.fn().mockResolvedValue({ data: null, error: null }),
    updateBucket: jest.fn().mockResolvedValue({ data: null, error: null }),
    createBucket: jest.fn().mockResolvedValue({ data: null, error: null }),
  };

  const channel = jest.fn(() => ({
    subscribe: jest.fn((cb: (status: string) => void) => {
      cb('SUBSCRIBED');
      return { unsubscribe: jest.fn() };
    }),
    unsubscribe: jest.fn(),
    send: jest.fn().mockResolvedValue({}),
  }));

  return {
    from: jest.fn(() => builder),
    rpc: jest.fn(),
    storage,
    channel,
    __builder: builder,
  };
};
