import type { Metadata } from "next";
import { CupChatClient } from "@/components/cup-chat-client";
import { getCurrentAuthAppUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CupChat",
  description: "Intern chat for KontrolCenter under LykkeCup",
};

export default async function CupChatPage() {
  const user = await getCurrentAuthAppUser();
  const currentUser = user
    ? { id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl }
    : null;
  return <CupChatClient currentUser={currentUser} />;
}
