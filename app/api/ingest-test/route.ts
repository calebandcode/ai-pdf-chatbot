import { NextResponse } from "next/server";
import { uploadAndIngest } from "@/app/actions/upload-and-ingest";

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await uploadAndIngest(formData);

  return NextResponse.json(result);
}
