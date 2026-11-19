'use client';

import { StudiosDirectory } from '@/components/studios/StudiosDirectory';

export default function RadioStudiosPage() {
  return (
    <StudiosDirectory
      studioPrefix="/studios"
      newStudioHref="/studios/me?new=1"
    />
  );
}
