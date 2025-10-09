import { ensureDocChunksVectorIndex } from "@/lib/db/queries";

let indexEnsured = false;

export async function ensureVectorIndex(lists = 100) {
  if (indexEnsured) {
    return;
  }

  await ensureDocChunksVectorIndex({ lists });
  indexEnsured = true;
}
