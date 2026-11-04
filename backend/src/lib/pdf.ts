import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import pdfmake from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces.js";

/**
 * PDF rendering with pdfmake. Each document's layout lives beside its feature
 * (the consent PDF is in `services/consent.ts`).
 *
 * Roboto is embedded because it has the peso sign, which built-in PDF fonts lack.
 * Remote URLs are refused and file reads are limited to the font folder, so a
 * document can never pull in anything else.
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
