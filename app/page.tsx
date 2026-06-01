import { redirect } from "next/navigation";

/** Offentlig forside — samme app som /lykkecup26. */
export default function HomePage() {
  redirect("/lykkecup26");
}
