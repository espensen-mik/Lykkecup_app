import { LoginForm } from "@/components/auth/login-form";
import { EVENT_PICKER_PATH, safeInternalPath } from "@/lib/events";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith(EVENT_PICKER_PATH)
    ? params.next
    : `${EVENT_PICKER_PATH}?next=${encodeURIComponent(safeInternalPath(params.next))}`;
  return <LoginForm nextPath={next} />;
}
