import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { extractPdfPages } from "@/lib/ingest/pdf";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}` },
        { status: 400 }
      );
    }

    console.log("🔍 Testing PDF upload:");
    console.log("📄 File name:", file.name);
    console.log("📄 File size:", file.size, "bytes");
    console.log("📄 File type:", file.type);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("📄 Buffer size:", buffer.length, "bytes");
    console.log(
      "📄 Buffer first 100 bytes (hex):",
      buffer.slice(0, 100).toString("hex")
    );

    // Check PDF header
    const pdfHeader = buffer.slice(0, 4).toString();
    console.log("📄 PDF header:", pdfHeader);

    if (!pdfHeader.startsWith("%PDF")) {
      return NextResponse.json(
        {
          error: `Invalid PDF header: ${pdfHeader}`,
          bufferInfo: {
            size: buffer.length,
            firstBytes: buffer.slice(0, 50).toString(),
            hex: buffer.slice(0, 100).toString("hex"),
          },
        },
        { status: 400 }
      );
    }

    // Try to extract pages
    const pages = await extractPdfPages(buffer);

    return NextResponse.json({
      success: true,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
        bufferSize: buffer.length,
        pdfHeader,
      },
      extraction: {
        pagesCount: pages.length,
        totalTextLength: pages.reduce((sum, page) => sum + page.text.length, 0),
        firstPagePreview: pages[0]?.text.slice(0, 200) || "No content",
      },
    });
  } catch (error) {
    console.error("❌ PDF test failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
