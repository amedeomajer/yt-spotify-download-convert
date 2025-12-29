import OpenAI from "openai";
import type { ParsedTitle } from './title-parser';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function parseWithAI(youtubeTitle: string): Promise<ParsedTitle> {
  try {
    const prompt = `Parse this YouTube video title into artist and song title. Extract any remix/live/acoustic info as version. Return JSON only.

YouTube title: "${youtubeTitle}"

Expected JSON format:
{
  "artist": "artist name or null if unknown",
  "title": "song title without version info",
  "version": "Remix/Live/Acoustic/etc or null",
  "features": ["featured artist"] or []
}

Examples:
"Daughter - Medicine (Sound Remedy Remix)" → {"artist": "Daughter", "title": "Medicine", "version": "Sound Remedy Remix", "features": []}
"Zedd - Clarity ft. Foxes" → {"artist": "Zedd", "title": "Clarity", "version": null, "features": ["Foxes"]}
"Walk on by (Sound Remedy Remix)" → {"artist": null, "title": "Walk on by", "version": "Sound Remedy Remix", "features": []}

Return only valid JSON, no explanation.`;

    const response = await client.responses.create({
      model: "gpt-5-nano",
      input: prompt
    });

    // Parse the AI response
    const parsed = JSON.parse(response.output_text);

    return {
      artist: parsed.artist || null,
      title: parsed.title,
      version: parsed.version || undefined,
      features: parsed.features || []
    };
  } catch (error) {
    console.error('AI parsing failed:', error);
    // Fallback to basic parsing if AI fails
    return {
      artist: null,
      title: youtubeTitle,
      version: undefined,
      features: []
    };
  }
}
