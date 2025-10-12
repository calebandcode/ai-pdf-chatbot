export type PdfPageText = {
  page: number;
  text: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

// Lazy load pdf-parse to avoid initialization issues
let pdfParse: any = null;

async function getPdfParse() {
  if (!pdfParse) {
    try {
      pdfParse = (await import("pdf-parse")).default;
    } catch (error) {
      throw new Error(`Failed to load pdf-parse library: ${error}`);
    }
  }
  return pdfParse;
}

export async function extractPdfPages(
  source: ArrayBuffer | Buffer
): Promise<PdfPageText[]> {
  const buffer = Buffer.isBuffer(source)
    ? source
    : Buffer.from(source as ArrayBuffer);

  const pages: PdfPageText[] = [];

  try {
    const pdfParseLib = await getPdfParse();

    await pdfParseLib(buffer, {
      pagerender: async (pageData: any) => {
        try {
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
            typeof pageData.pageNumber === "number"
              ? pageData.pageNumber
              : pages.length + 1;

          pages.push({ page: pageNumber, text: pageText });

          return pageText;
        } catch (pageError) {
          console.warn("Error processing page:", pageError);
          pages.push({
            page: pages.length + 1,
            text: `[Error processing page: ${pageError}]`,
          });
          return "";
        }
      },
    });
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error}`);
  }

  return pages;
}
