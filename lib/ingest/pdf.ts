import pdfParse from "pdf-parse";

export type PdfPageText = {
  page: number;
  text: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function extractPdfPages(
  source: ArrayBuffer | Buffer
): Promise<PdfPageText[]> {
  const buffer = Buffer.isBuffer(source)
    ? source
    : Buffer.from(source as ArrayBuffer);

  const pages: PdfPageText[] = [];

  await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const items = textContent.items as Array<{ str?: string }>;
      const pageText = normalizeWhitespace(
        items
          .map((item) => {
            if (typeof item.str === "string") {
              return item.str;
            }
            return "";
          })
          .join(" ")
      );

      const pageNumber =
        // @ts-expect-error pdf-parse runtime shape
        typeof pageData.pageNumber === "number"
          ? // @ts-expect-error pdf-parse runtime shape
            pageData.pageNumber
          : pages.length + 1;

      pages.push({ page: pageNumber, text: pageText });

      return pageText;
    },
  });

  return pages;
}
