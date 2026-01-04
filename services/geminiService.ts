
import { GoogleGenAI, Modality } from "@google/genai";
import { StoryGenre, GenerationSettings, MaturityLevel, LanguageStyle } from "../types";

/**
 * Standard initialization.
 * Using gemini-3-flash-preview for general speed and gemini-3-pro-preview for depth.
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates high-quality Bengali story content.
 * Adheres to "Super Fast" and "Best Quality" by leveraging gemini-3-flash-preview with a thinking budget.
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
  const ai = getAI();
  // Using gemini-3-flash-preview as requested for "super fast" performance
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are an elite Bengali novelist specializing in long-form fictional narratives ("Boro Uponnash").
Your prose is rich, descriptive, and culturally authentic.

Tone: ${settings.tone}.
Language Style: ${language}.
Maturity Level: ${maturity}.
Genre: ${genre}.
Estimated Length: ${settings.length}.

${settings.customSystemPrompt ? `Special Directives: ${settings.customSystemPrompt}` : ''}

Strict Formatting & Literary Rules:
1. Write exclusively in Bengali.
2. Ensure deep emotional intensity and vivid sensory imagery.
3. For Adult/Erotica, maintain a sophisticated and literary tone—sensual but never crude.
4. Focus on character-driven developments.
5. Return ONLY the story content. Do not include titles, introductions, or pleasantries.
6. Use sophisticated Bengali vocabulary (Shudhu Shobdo).`;

  const prompt = `
  Novel: ${projectTitle}
  Chapter: ${chapterTitle}
  Context: ${context}
  ${previousSummary ? `Previously: ${previousSummary}` : ''}
  
  Write a high-quality, immersive chapter/scene in Bengali.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: settings.creativity,
        // Reserves tokens for reasoning to ensure "Best Quality"
        thinkingConfig: { thinkingBudget: 12000 }
      },
    });

    return response.text;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    throw new Error(error.message || "কাহিনী তৈরিতে সমস্যা হয়েছে।");
  }
};

/**
 * Seamlessly continues existing story flow.
 */
export const continueStory = async (
  currentText: string,
  projectDescription: string,
  genre: StoryGenre,
  settings: GenerationSettings,
  maturity: MaturityLevel,
  language: LanguageStyle
): Promise<string | undefined> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are continuing a Bengali story. 
Match the established tone, pace, and vocabulary. 
Transition naturally from the last sentence provided.

Tone: ${settings.tone}.
Style: ${language}.
Maturity: ${maturity}.
Genre: ${genre}.

Instruction: Return only the continuation text in Bengali.`;

  const prompt = `
  Story Background: ${projectDescription}
  Current Text Flow: "...${currentText.slice(-2000)}"
  
  Continue the story for 5-6 paragraphs:`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: settings.creativity,
        thinkingConfig: { thinkingBudget: 4000 }
      },
    });

    return response.text;
  } catch (error) {
    console.error("Continuation Error:", error);
    throw error;
  }
};

/**
 * Edits or transforms text based on user instruction.
 */
export const rewriteContent = async (
  content: string,
  instruction: string,
  genre: StoryGenre
): Promise<string | undefined> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const prompt = `
  Text: ${content}
  Instruction: ${instruction}
  Genre: ${genre}
  
  Rewrite the text in Bengali while keeping the literary quality.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are a master Bengali editor. Polishing text for high-end literature.",
        thinkingConfig: { thinkingBudget: 0 } // No reasoning needed for simple editing
      },
    });

    return response.text;
  } catch (error) {
    console.error("Rewrite Error:", error);
    throw error;
  }
};

/**
 * High-quality Bengali Text-to-Speech using native audio modality.
 */
export const generateSpeech = async (text: string): Promise<string | undefined> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this Bengali story excerpt emotionally: ${text.slice(0, 2500)}` }] }],
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
    console.error("TTS System Failure:", error);
    throw error;
  }
};
