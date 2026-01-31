export type SupabaseBuilderMock = {
  select: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  ilike: jest.Mock;
  single: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  range: jest.Mock;
};

export const createSupabaseMock = () => {
  const builder: SupabaseBuilderMock & {
    __result: { data: any; error: any };
    then: (resolve: (value: any) => void, reject?: (reason: any) => void) => void;
  } = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    is: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    single: jest.fn(),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    range: jest.fn(() => builder),
    __result: { data: null, error: null },
    then: (resolve, reject) => {
      Promise.resolve(builder.__result).then(resolve, reject);
    },
  };

  const storage = {
    from: jest.fn(() => ({
      createSignedUrl: jest.fn(),
      createSignedUploadUrl: jest.fn(),
      upload: jest.fn(),
      remove: jest.fn(),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/file' } })),
    })),
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
