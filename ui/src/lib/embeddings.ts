import { loadDevEnv } from "./env";

/**
 * Generate embeddings using Gemini's text-embedding-004 model (768 dimensions).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  loadDevEnv();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT",
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini embedding error ${res.status}: ${err}`);
  }

  const data = await res.json() as { embedding: { values: number[] } };
  return data.embedding.values;
}

/**
 * Generate embedding for a search query (uses RETRIEVAL_QUERY task type for better search).
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  loadDevEnv();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not configured");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: query }] },
        taskType: "RETRIEVAL_QUERY",
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini embedding error: ${res.status}`);

  const data = await res.json() as { embedding: { values: number[] } };
  return data.embedding.values;
}

/**
 * Batch embed multiple texts.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Gemini doesn't have a batch endpoint for embeddings, so parallelize
  return Promise.all(texts.map(generateEmbedding));
}
