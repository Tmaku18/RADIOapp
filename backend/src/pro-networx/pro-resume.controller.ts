import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import type { FirebaseUser } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { getSupabaseClient } from '../config/supabase.config';
import { UploadsService } from '../uploads/uploads.service';

/**
 * Resume PDF upload + delete for the user's own Pro Networks profile.
 * The resumes bucket is private; we return short-lived signed URLs.
 */
@Controller('pro-networx/me/resume')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles('artist', 'service_provider', 'admin')
export class ProResumeController {
  constructor(private readonly uploads: UploadsService) {}

  private async getUser(firebaseUid: string): Promise<{
    id: string;
    resumePath: string | null;
    resumeFilename: string | null;
  }> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, resume_url, resume_filename')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (error || !data) throw new UnauthorizedException('User not found');
    return {
      id: data.id as string,
      resumePath: (data as any).resume_url ?? null,
      resumeFilename: (data as any).resume_filename ?? null,
    };
  }

  @Get()
  async get(@CurrentUser() user: FirebaseUser) {
    const me = await this.getUser(user.uid);
    if (!me.resumePath) {
      return { url: null, filename: null };
    }
    const url = await this.uploads.getResumeSignedUrl(me.resumePath);
    return { url, filename: me.resumeFilename };
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser() user: FirebaseUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Send a PDF in the "file" field');
    }
    const me = await this.getUser(user.uid);
    const { path, signedUrl } = await this.uploads.uploadResume(file, me.id);

    if (me.resumePath && me.resumePath !== path) {
      await this.uploads.deleteResume(me.resumePath).catch(() => undefined);
    }

    const supabase = getSupabaseClient();
    const filename = file.originalname || 'resume.pdf';
    await supabase
      .from('users')
      .update({ resume_url: path, resume_filename: filename })
      .eq('id', me.id);
    // Mirror onto pro_networx.profiles too via the seed function (fire and forget).
    try {
      await supabase.rpc('seed_profile_from_user', { p_user_id: me.id });
    } catch {
      // Non-fatal: legacy databases may not yet have the seed RPC.
    }

    return { url: signedUrl, filename };
  }

  @Delete()
  async remove(@CurrentUser() user: FirebaseUser) {
    const me = await this.getUser(user.uid);
    if (me.resumePath) {
      await this.uploads.deleteResume(me.resumePath).catch(() => undefined);
    }
    const supabase = getSupabaseClient();
    await supabase
      .from('users')
      .update({ resume_url: null, resume_filename: null })
      .eq('id', me.id);
    return { ok: true };
  }
}
