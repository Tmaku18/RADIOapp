import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServiceSupabase, resolveAuthUserFromHeader } from '@radioapp/db';

export async function usersHandler(
  request: NextRequest,
  pathSegments: string[],
): Promise<Response | null> {
  const sub = pathSegments.slice(1).join('/');
  const method = request.method;

  if (method === 'GET' && (sub === 'me' || sub === '')) {
    const authUser = await resolveAuthUserFromHeader(request.headers.get('authorization'));
    if (!authUser) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    let query = supabase.from('users').select('*');

    if (authUser.firebaseUid) {
      query = query.eq('firebase_uid', authUser.firebaseUid);
    } else if (authUser.supabaseUid) {
      query = query.eq('id', authUser.supabaseUid);
    } else {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ ...data, strangler: 'local' });
  }

  return null;
}
