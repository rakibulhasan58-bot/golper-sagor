
import { GoogleGenAI, Modality } from "@google/genai";
import { StoryGenre, GenerationSettings, MaturityLevel, LanguageStyle } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates high-quality Bengali story content using gemini-3-pro-preview.
 * Specialized for Adult 18+ novels (Uponnash).
 */
export const generateStoryChapter = async (
  projectTitle: string,
  chapterTitle: string,
  context: string,
  genre: StoryGenre,
  settings: GenerationSettings,
  maturity: MaturityLevel,
  language: LanguageStyle,
  previousSummary?: string
): Promise<string | undefined> => {
  const model = "gemini-3-pro-preview";
  
  const systemPrompt = `You are a world-class Bengali novelist renowned for writing epic-length Adult (18+) fiction, complex novels (Boro Uponnash), and deep stories (Boro Kahini). 

Tone & Style: ${settings.tone}.
Language Style: ${language}.
Maturity Level: ${maturity} (Ensure appropriate depth, emotional intensity, and descriptive sensuality for this rating).
Genre: ${genre}.

${settings.customSystemPrompt ? `Special Style Instructions: ${settings.customSystemPrompt}` : ''}

Strict Literary Rules:
1. Write in rich, flowery, and evocative Bengali prose.
2. Focus on internal monologues, sensory details, and atmospheric descriptions.
3. Chapters must feel part of a larger, cohesive 'Boro Uponnash'.
4. Use authentic Bengali idioms and sophisticated vocabulary.
5. Avoid repetition. Ensure the prose flows naturally for an adult audience.`;

  const prompt = `
  Project: ${projectTitle}
  Chapter: ${chapterTitle}
  
  Instructions: Write a ${settings.length} novel chapter in Bengali.
  
  Context of the Novel: ${context}
  ${previousSummary ? `Recap of previous events: ${previousSummary}` : ''}
  
  Generate the full, detailed chapter text now in high-quality Bengali.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: settings.creativity,
        maxOutputTokens: 40000, 
        thinkingConfig: { thinkingBudget: 32768 } 
      },
    });

    return response.text;
  } catch (error) {
    console.error("Critical Generation Error:", error);
    throw error;
  }
};

/**
 * Rewrites or edits content based on specific user feedback.
 */
export const rewriteContent = async (
  content: string,
  instruction: string,
  genre: StoryGenre
): Promise<string | undefined> => {
  const model = "gemini-3-flash-preview";
  const prompt = `
  Current Content: ${content}
  Edit Instruction: ${instruction}
  
  Rewrite the content in Bengali according to the instruction while maintaining the ${genre} (Adult 18+) literary tone.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are a master editor of Bengali adult fiction. Polish the text to perfection.",
      },
    });

    return response.text;
  } catch (error) {
    console.error("Rewrite Error:", error);
    throw error;
  }
};

/**
 * High-quality Bengali Text-to-Speech using the preview TTS model.
 * Returns raw base64 PCM data.
 */
export const generateSpeech = async (text: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this Bengali novel excerpt naturally with emotion: ${text.slice(0, 3500)}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, 
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS System Error:", error);
    throw error;
  }
};
