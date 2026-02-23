import { RadioService } from './radio.service';

describe('RadioService', () => {
  const createService = () =>
    new RadioService({} as any, {} as any, {
      getCurrentState: jest.fn(),
      setCurrentState: jest.fn(),
      logPlayDecision: jest.fn(),
    } as any);

  it('calculates credits required per play', () => {
    const service = createService() as any;
    expect(service.calculateCreditsRequired(5)).toBe(1);
    expect(service.calculateCreditsRequired(7)).toBe(1);
    expect(service.calculateCreditsRequired(180)).toBe(1);
  });

  it('builds no_content response', () => {
    const service = createService() as any;
    const result = service.buildNoContentResponse();
    expect(result.no_content).toBe(true);
    expect(result.audio_url).toBeNull();
  });
});
