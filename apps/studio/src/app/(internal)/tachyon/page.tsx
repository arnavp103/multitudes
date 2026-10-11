import { TachyonSpecimen } from "@multitudes/ui/tachyon-specimen";

import { requireStaff } from "~/server/access";

/** Tachyon reference: tokens and components rendered with the live theme. */
export default async function TachyonPage() {
  await requireStaff();
  return <TachyonSpecimen />;
}
