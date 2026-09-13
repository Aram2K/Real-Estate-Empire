import { redirect } from "next/navigation";

/** Preserve old bookmarks while keeping Deals as the single canonical view. */
export default function DealFinderRedirect() {
  redirect("/properties");
}
