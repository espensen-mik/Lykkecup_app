/** Brugerprofil til KontrolCenter — kan importeres fra både client og server. */
export type AuthAppUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: "admin" | "user" | null;
};
