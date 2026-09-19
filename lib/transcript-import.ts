import { MAX_TRANSCRIPT_LENGTH } from "./analysis-contract";

export type TextFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};
export async function importTextFile(file: TextFile): Promise<string> {
  if (
    !/\.txt$/i.test(file.name) ||
    (file.type && !["text/plain", "application/octet-stream"].includes(file.type))
  )
    throw new Error("Choose a .txt text file.");
  if (file.size > MAX_TRANSCRIPT_LENGTH * 4 + 3) throw new Error("TRANSCRIPT_TOO_LONG");
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    throw new Error("The file could not be read.");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The file must use UTF-8 encoding.");
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
    throw new Error("Choose a .txt text file.");
  if (text.length > MAX_TRANSCRIPT_LENGTH) throw new Error("TRANSCRIPT_TOO_LONG");
  return text;
}
