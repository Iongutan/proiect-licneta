// Ruta din v1 — păstrată doar ca redirect. Folderul poate fi șters (vezi README → Curățenie).
import { redirect } from "next/navigation";

export default function Page(): never {
  redirect("/account");
}
