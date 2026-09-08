import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Extracts text from a PDF using poppler's pdftotext, which is installed in the
 * image. Isolated here so the parsers stay pure functions over text.
 *
 * `-layout` preserves column positions, which is what keeps the summary block
 * readable; without it the reading order interleaves unrelated cells.
 */
export async function pdfToText(pdf: Buffer): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "fintrack-pdf-"));
  const path = join(dir, "input.pdf");
  try {
    await writeFile(path, pdf);
    const { stdout } = await run("pdftotext", ["-layout", path, "-"], {
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
