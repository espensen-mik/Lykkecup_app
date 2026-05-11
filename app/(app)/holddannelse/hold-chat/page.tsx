import { redirect } from "next/navigation";

/** Tidligere sti; CupChat ligger på `/cup-chat`. */
export default function CupChatLegacyPathRedirect() {
  redirect("/cup-chat");
}
