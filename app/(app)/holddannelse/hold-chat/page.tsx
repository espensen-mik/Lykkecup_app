import type { Metadata } from "next";
import { HoldChatClient } from "@/components/holddannelse/hold-chat-client";
import { getCurrentAuthAppUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HoldChat",
  description: "Intern chat om holddannelse for KontrolCenter",
};

export default async function HoldChatPage() {
  const user = await getCurrentAuthAppUser();
  const currentUser = user
    ? { id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl }
    : null;
  return <HoldChatClient currentUser={currentUser} />;
}
