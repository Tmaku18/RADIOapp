import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { NotificationService } from '../notifications/notification.service';
import { PushNotificationService } from '../push-notifications/push-notification.service';

export interface ServiceRequestRow {
  id: string;
  artistId: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  artistDisplayName?: string | null;
}

export interface ServiceRequestApplicationRow {
  id: string;
  requestId: string;
  applicantId: string;
  message: string | null;
  status: string;
  createdAt: string;
  applicantDisplayName?: string | null;
}

@Injectable()
export class JobBoardService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly pushNotification: PushNotificationService,
  ) {}

  async listRequests(params: {
    serviceType?: string;
    status?: 'open' | 'closed' | 'completed' | 'all';
    mine?: boolean;
    artistId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ServiceRequestRow[]; total: number }> {
    const limit = Math.min(params.limit ?? 20, 50);
    const offset = params.offset ?? 0;
    const supabase = getSupabaseClient();

    let q = supabase
      .from('service_requests')
      .select(
        'id, artist_id, title, description, service_type, status, created_at, updated_at',
        { count: 'exact' },
      );

    if (params.status === 'open') q = q.eq('status', 'open');
    if (params.status === 'closed') q = q.eq('status', 'closed');
    if (params.status === 'completed') q = q.eq('status', 'completed');
    if (params.serviceType?.trim())
      q = q.eq('service_type', params.serviceType.trim());
    if (params.mine && params.artistId) q = q.eq('artist_id', params.artistId);

    const { data: rows, count } = await q
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!rows?.length) return { items: [], total: count ?? 0 };

    const artistIds = [...new Set((rows as any[]).map((r) => r.artist_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', artistIds);
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    const items: ServiceRequestRow[] = (rows as any[]).map((r) => ({
      id: r.id,
      artistId: r.artist_id,
      title: r.title,
      description: r.description ?? null,
      serviceType: r.service_type ?? null,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      artistDisplayName: userMap.get(r.artist_id)?.display_name ?? null,
    }));

    return { items, total: count ?? items.length };
  }

  async createRequest(params: {
    artistId: string;
    title: string;
    description?: string | null;
    serviceType?: string | null;
  }): Promise<ServiceRequestRow> {
    const title = params.title?.trim();
    if (!title) throw new BadRequestException('Title is required');
    if (title.length > 120)
      throw new BadRequestException('Title must be 120 characters or fewer');

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        artist_id: params.artistId,
        title,
        description: params.description?.trim() || null,
        service_type: params.serviceType?.trim() || null,
        status: 'open',
      })
      .select(
        'id, artist_id, title, description, service_type, status, created_at, updated_at',
      )
      .single();

    if (error || !data)
      throw new Error(`Failed to create request: ${error?.message}`);

    const displayName = await this.getDisplayName(params.artistId);
    return {
      id: data.id,
      artistId: data.artist_id,
      title: data.title,
      description: data.description ?? null,
      serviceType: data.service_type ?? null,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      artistDisplayName: displayName,
    };
  }

  async deleteRequest(
    requestId: string,
    userId: string,
    isAdmin = false,
  ): Promise<{ success: true }> {
    const supabase = getSupabaseClient();
    const request = await this.getRequest(requestId);
    if (!request) throw new NotFoundException('Request not found');
    if (!isAdmin && request.artistId !== userId) {
      throw new ForbiddenException('You can only delete your own requests');
    }

    // Remove applications first in case there is no FK cascade in the schema.
    await supabase
      .from('service_request_applications')
      .delete()
      .eq('request_id', requestId);

    const { error } = await supabase
      .from('service_requests')
      .delete()
      .eq('id', requestId);
    if (error) throw new Error(`Failed to delete request: ${error.message}`);

    return { success: true };
  }

  async setRequestStatus(
    requestId: string,
    userId: string,
    status: 'open' | 'closed' | 'completed',
    isAdmin = false,
  ): Promise<ServiceRequestRow> {
    const supabase = getSupabaseClient();
    const request = await this.getRequest(requestId);
    if (!request) throw new NotFoundException('Request not found');
    if (!isAdmin && request.artistId !== userId) {
      throw new ForbiddenException('You can only update your own requests');
    }

    const { error } = await supabase
      .from('service_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', requestId);
    if (error) throw new Error(`Failed to update request: ${error.message}`);

    const updated = await this.getRequest(requestId);
    if (!updated) throw new NotFoundException('Request not found');
    return updated;
  }

  async getRequest(requestId: string): Promise<ServiceRequestRow | null> {
    const supabase = getSupabaseClient();
    const { data: r, error } = await supabase
      .from('service_requests')
      .select(
        'id, artist_id, title, description, service_type, status, created_at, updated_at',
      )
      .eq('id', requestId)
      .single();

    if (error || !r) return null;
    const { data: u } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', r.artist_id)
      .maybeSingle();
    return {
      id: r.id,
      artistId: r.artist_id,
      title: r.title,
      description: r.description ?? null,
      serviceType: r.service_type ?? null,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      artistDisplayName: u?.display_name ?? null,
    };
  }

  async apply(
    requestId: string,
    applicantId: string,
    message?: string | null,
  ): Promise<ServiceRequestApplicationRow> {
    const supabase = getSupabaseClient();
    const request = await this.getRequest(requestId);
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'open')
      throw new ForbiddenException(
        'This request is no longer open for applications',
      );

    const { data: existing } = await supabase
      .from('service_request_applications')
      .select('id')
      .eq('request_id', requestId)
      .eq('applicant_id', applicantId)
      .maybeSingle();
    if (existing)
      throw new ForbiddenException('You have already applied to this request');

    const { data: inserted, error } = await supabase
      .from('service_request_applications')
      .insert({
        request_id: requestId,
        applicant_id: applicantId,
        message: message?.trim() ?? null,
        status: 'pending',
      })
      .select('id, request_id, applicant_id, message, status, created_at')
      .single();

    if (error)
      throw new Error(`Failed to submit application: ${error.message}`);

    const applicantName = await this.getDisplayName(applicantId);
    const title = 'New job application';
    const body = applicantName
      ? `${applicantName} applied to "${request.title}"`
      : `Someone applied to "${request.title}"`;

    await this.notificationService.create({
      userId: request.artistId,
      type: 'job_application',
      title,
      message: body,
      metadata: { requestId, applicationId: inserted.id, applicantId },
    });

    await this.pushNotification.sendPushNotification({
      userId: request.artistId,
      title,
      body,
      data: { type: 'job_application', requestId, applicationId: inserted.id },
    });

    return {
      id: inserted.id,
      requestId: inserted.request_id,
      applicantId: inserted.applicant_id,
      message: inserted.message ?? null,
      status: inserted.status,
      createdAt: inserted.created_at,
      applicantDisplayName: applicantName,
    };
  }

  async listApplicationsForRequest(
    requestId: string,
    userId: string,
  ): Promise<ServiceRequestApplicationRow[]> {
    const request = await this.getRequest(requestId);
    if (!request) throw new NotFoundException('Request not found');
    if (request.artistId !== userId)
      throw new ForbiddenException(
        'Only the request owner can view applications',
      );

    const supabase = getSupabaseClient();
    const { data: rows } = await supabase
      .from('service_request_applications')
      .select('id, request_id, applicant_id, message, status, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (!rows?.length) return [];

    const applicantIds = [
      ...new Set((rows as any[]).map((r) => r.applicant_id)),
    ];
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', applicantIds);
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    return (rows as any[]).map((r) => ({
      id: r.id,
      requestId: r.request_id,
      applicantId: r.applicant_id,
      message: r.message ?? null,
      status: r.status,
      createdAt: r.created_at,
      applicantDisplayName: userMap.get(r.applicant_id)?.display_name ?? null,
    }));
  }

  private async getDisplayName(userId: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    return data?.display_name ?? null;
  }
}
