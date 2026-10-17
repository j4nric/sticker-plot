import { data } from "react-router";
import { currentUser } from "~/lib/session.server";
import { audit } from "~/models/audit.server";
import { deleteUnusedImages, MAX_IMAGE_BYTES, sanitizeSvg, saveImage, sniffImageType } from "~/models/image.server";
import { getTea, setTeaImage, updateTea } from "~/models/tea.server";
import { parseId } from "~/lib/params";
import type { Route } from "./+types/tea-image";

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const tea = getTea(parseId(params.teaId));
  if (!tea) throw data("Tee nicht gefunden", { status: 404 });
  const form = await request.formData();

  if (form.get("intent") === "remove") {
    setTeaImage(tea.id, null);
    deleteUnusedImages();
    if (tea.motif === "bild") updateTea(tea.id, { motif: "auto" });
    audit(user.username, "bild entfernen", "tee", tea.id, tea.name);
    return { error: undefined };
  }

  const file = form.get("bild");
  if (!(file instanceof File) || file.size === 0) return data({ error: "Bitte eine Bilddatei auswählen." }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return data({ error: "Das Bild ist größer als 3 MB." }, { status: 400 });
  let buf: Buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageType(buf);
  if (!mime) return data({ error: "Unbekanntes Bildformat. Erlaubt sind PNG, JPG, WebP und SVG." }, { status: 400 });
  if (mime === "image/svg+xml") buf = Buffer.from(sanitizeSvg(buf.toString("utf8")), "utf8");

  const imageId = saveImage(mime, buf);
  setTeaImage(tea.id, imageId);
  updateTea(tea.id, { motif: "bild" });
  deleteUnusedImages();
  audit(user.username, "bild hochladen", "tee", tea.id, `${tea.name}: ${file.name}`);
  return { error: undefined };
}
