import { extractText, type ReadMethod } from './extract';
import { parseMaterials, type MaterialSuggestion } from './parse';

export { ACCEPTED_FILES, MAX_FILE_MB, UnsupportedFileError } from './extract';
export type { Confidence, MaterialSuggestion } from './parse';

export interface ReadResult {
  /** The text that was read, shown to the owner so they can check it. */
  text: string;
  method: ReadMethod;
  suggestions: MaterialSuggestion[];
}

/**
 * Anything that turns a document into material suggestions. The screens only
 * use this interface, so an AI-based reader (sent through a server function
 * that holds the API key) can replace the on-device one without UI changes.
 */
export interface DocumentReader {
  /** True when documents stay on the owner's device. */
  onDevice: boolean;
  read(file: File, onProgress?: (p: number) => void): Promise<ReadResult>;
}

export const localReader: DocumentReader = {
  onDevice: true,
  async read(file, onProgress) {
    const { text, method } = await extractText(file, onProgress);
    return { text, method, suggestions: parseMaterials(text) };
  },
};

/** The reader the dashboard uses. */
export const documentReader: DocumentReader = localReader;
