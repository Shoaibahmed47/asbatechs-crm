"use client";

import {
  WorkspaceWelcomeBanner,
  type WorkspaceWelcomeProfile
} from "@/components/WorkspaceWelcomeBanner";

type Props = {
  profile: WorkspaceWelcomeProfile;
  role: string;
};

/** Personalized greeting card below breadcrumbs on every app page. */
export function WorkspaceMainWelcome({ profile, role }: Props) {
  return (
    <div className="mb-6">
      <WorkspaceWelcomeBanner profile={profile} role={role} variant="main" />
    </div>
  );
}
