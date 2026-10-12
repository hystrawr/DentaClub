import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import pdfmake from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces.js";

/**
 * PDF rendering, via pdfmake. (Ported from DentalOS's PdfService.)
 *
 * pdfmake takes a **document definition** rather than HTML, so a document's
 * layout is TypeScript, living beside the domain that owns it
 * (`services/consent.ts`).
 *
 * ## Why Roboto
 *
 * The peso sign is not in the fonts every PDF reader has built in. Roboto ships
 * inside pdfmake and covers it, so it is embedded in every file and there is no
 * system font dependency.
 *
 * ## Why the access policies
 *
 * pdfmake will fetch a remote image or read a local file if a document
 * definition names one. Neither is ever wanted: URLs are refused outright and
 * the filesystem is narrowed to the font directory. A signature arrives as a
 * `data:` URI, which is neither.
 */
const require = createRequire(import.meta.url);
const fontDir = join(dirname(require.resolve("pdfmake/package.json")), "fonts", "Roboto");

pdfmake.fonts = {
  Roboto: {
    normal: join(fontDir, "Roboto-Regular.ttf"),
    bold: join(fontDir, "Roboto-Medium.ttf"),
    italics: join(fontDir, "Roboto-Italic.ttf"),
    bolditalics: join(fontDir, "Roboto-MediumItalic.ttf"),
  },
};
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((path) => path.startsWith(fontDir));

/** Render a document definition to the bytes that get stored. */
export async function renderPdf(definition: TDocumentDefinitions): Promise<Buffer> {
  return pdfmake
    .createPdf({
      pageSize: "A4",
      pageMargins: [40, 40, 40, 48],
      defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.25 },
      ...definition,
    })
    .getBuffer();
}
