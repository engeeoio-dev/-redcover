import { GoogleGenAI } from '@google/genai';

/**
 * Smart heuristic rule-based text cleaner that normalizes messy raw PDF text
 * into readable story text, even when offline or without an active API key.
 */
export function cleanRawPdfTextHeuristically(rawText: string): string {
  if (!rawText) return '';

  return rawText
    // 1. Reconnect words broken by hyphenation at line breaks: "trans-\nformation" -> "transformation"
    .replace(/([a-zA-Z]{2,})-\s*\r?\n\s*([a-zA-Z]{2,})/g, '$1$2')
    // 2. Remove standalone header/footer page numbers: e.g. "\n 42 \n" or "\n Page 14 of 250 \n"
    .replace(/\r?\n\s*(?:page\s+)?\d+\s*(?:of\s+\d+)?\s*\r?\n/gi, '\n\n')
    // 3. Remove inline citation marks like "[1]", "[24]"
    .replace(/\[\d+\]/g, '')
    // 4. Remove excessive underscores or dashes used as horizontal lines
    .replace(/[-_]{4,}/g, '')
    // 5. Unbreak lines that belong to the same sentence (sentence continuing without punctuation)
    .replace(/([^\.\?!:;—"'\n])\r?\n([a-z"'])/g, '$1 $2')
    // 6. Clean multiple redundant whitespace
    .replace(/[ \t]{2,}/g, ' ')
    // 7. Normalize multiple newlines into clean paragraph breaks
    .replace(/(\r?\n\s*){3,}/g, '\n\n')
    .trim();
}

/**
 * Converts raw PDF text extract into natural, flowing story text optimized for
 * text-to-speech audio reader narration using free Google Gemini Flash API.
 */
export async function convertPdfTextToNarrative(
  rawPdfText: string,
  userApiKey?: string
): Promise<{ text: string; source: 'ai' | 'heuristic' }> {
  const cleanInput = rawPdfText.trim();
  if (!cleanInput) {
    return { text: '', source: 'heuristic' };
  }

  // Check user supplied key, localStorage key, or environment variable
  const apiKey =
    userApiKey ||
    localStorage.getItem('rc_gemini_api_key') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    '';

  if (!apiKey) {
    // Graceful offline NLP fallback
    return {
      text: cleanRawPdfTextHeuristically(cleanInput),
      source: 'heuristic',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Truncate to reasonable chunk size for prompt
    const snippet = cleanInput.slice(0, 12000);

    const prompt = `You are a professional audio book director and story editor.
Your task is to take the following noisy extracted PDF text and transform it into clean, smooth, engaging spoken narrative text for an audiobook reader.

Rules:
1. Fix all broken words, awkward line-wrap hyphens (e.g. "dis- appoint" -> "disappoint").
2. Strip out all page numbers, running headers, footers, ISBNs, publisher copyright notices, and footnotes.
3. Preserve all dialogue, character emotions, atmosphere, and the exact plot line faithfully.
4. Enhance sentence rhythm and punctuation (commas, em-dashes, periods) so the text-to-speech voice narrates with natural breathing and pauses.
5. Return ONLY the polished story text, with no explanations or preamble.

Raw PDF Extract:
${snippet}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const result = response.text?.trim();
    if (result) {
      return { text: result, source: 'ai' };
    }
  } catch (err) {
    console.warn('Gemini API normalization fallback to heuristic cleaner:', err);
  }

  // Fallback to rule-based cleaner if API call fails
  return {
    text: cleanRawPdfTextHeuristically(cleanInput),
    source: 'heuristic',
  };
}
