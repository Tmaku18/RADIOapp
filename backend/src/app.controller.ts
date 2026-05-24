import { Controller, Get, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { getSupabaseClient } from './config/supabase.config';

type HealthStatus = {
  status: 'ok' | 'degraded';
  uptime: number;
  supabase: {
    ok: boolean;
    latencyMs: number | null;
    error: string | null;
  };
  timestamp: string;
};

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Lightweight liveness/readiness probe. Pings Supabase with a 1-row select
  // so Railway (or any uptime monitor) can detect the exact failure mode that
  // causes Public DB endpoints to hang. Always returns 200 with a JSON body
  // so the response itself never gets misinterpreted; check `status` to alert.
  @Public()
  @Get('health')
  @HttpCode(200)
  async getHealth(): Promise<HealthStatus> {
    const startedAt = Date.now();
    let ok = false;
    let error: string | null = null;
    try {
      const supabase = getSupabaseClient();
      const result = await supabase
        .from('songs')
        .select('id', { head: true, count: 'exact' })
        .limit(1);
      if (result.error) {
        error = result.error.message;
      } else {
        ok = true;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const latencyMs = Date.now() - startedAt;
    return {
      status: ok ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      supabase: {
        ok,
        latencyMs: ok || error ? latencyMs : null,
        error,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
