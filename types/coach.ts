export type Coach = {
  id: string;
  event_id: string;
  ticket_id: string | null;
  name: string;
  home_club: string | null;
  email: string | null;
  phone: string | null;
  birthdate: string | null;
  age: number | null;
  tshirt_size: string | null;
};
