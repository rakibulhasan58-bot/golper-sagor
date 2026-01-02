
import { GoogleGenAI, Type } from "@google/genai";
import { StoryGenre, StoryChapter, GenerationSettings } from "../types";

// Initialize the Gemini API client using the environment variable directly.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateStoryChapter = async (
  projectTitle: string,
  chapterTitle: string,
  context: string,
  genre: StoryGenre,
  settings: GenerationSettings,
  maturity: string,
  language: string,
  previousSummary?: string
) => {
  const model = "gemini-3-pro-preview";
  
  const systemPrompt = `You are a world-class Bengali novelist specializing in high-quality literature. 
  Your task is to write a deeply immersive, emotionally resonant, and descriptive chapter in Bengali.
  Style: ${language}
  Genre: ${genre}
  Maturity: ${maturity}. (If adult/18+, focus on intense emotional connection, sensual tension, and detailed physical descriptions while maintaining high literary quality).
  
  Instructions:
  1. Use rich, evocative Bengali vocabulary.
  2. Focus on "Show, Don't Tell".
  3. Ensure the dialogue feels natural for the specified style.
  4. The tone should be ${settings.tone}.
  5. Language must be strictly Bengali (Bangla).`;

  const prompt = `
  Write a ${settings.length} novel chapter.
  Book Title: ${projectTitle}
  Chapter Title: ${chapterTitle}
  Context/Plot Points: ${context}
  ${previousSummary ? `Previous Events Summary: ${previousSummary}` : ''}
  
  Start writing the chapter immediately. Ensure it is long, detailed, and captivating.`;

  // Use generateContent for complex creative writing tasks with a reasoning budget.
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: settings.creativity,
      thinkingConfig: { thinkingBudget: 32768 } // Max budget for gemini-3-pro-preview reasoning.
    },
  });

  return response.text;
};

export const rewriteContent = async (
  content: string,
  instruction: string,
  genre: StoryGenre
) => {
  const model = "gemini-3-flash-preview";
  const prompt = `
  Original Content: ${content}
  Instruction: ${instruction}
  Genre Context: ${genre}
  
  Rewrite the content in Bengali while following the instruction precisely. Maintain the tone and flow.`;

  // Use flash model for faster editing and rewriting tasks.
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: "You are an expert Bengali editor and ghostwriter.",
    },
  });

  return response.text;
};
