
import { GoogleGenAI, Modality } from "@google/genai";
import { StoryGenre, GenerationSettings, MaturityLevel, LanguageStyle } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are an elite Bengali novelist specializing in high-quality narratives.
Tone: ${settings.tone}.
Language Style: ${language}.
Maturity Level: ${maturity}.
Genre: ${genre}.
Output Style: Immersive Bengali Prose.

Rules:
1. Write exclusively in Bengali.
2. Ensure deep emotional intensity.
3. For Adult/Erotica, maintain a sophisticated literary tone.
4. Return ONLY the story content without any conversational filler or metadata.`;

  const prompt = `
  Novel Title: ${projectTitle}
  Chapter: ${chapterTitle}
  Plot Context: ${context}
  ${previousSummary ? `Previous Events: ${previousSummary}` : ''}
  
  Write a long, immersive chapter in Bengali.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: settings.creativity,
        thinkingConfig: { thinkingBudget: 15000 }
      },
    });

    return response.text;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    throw new Error(error.message || "কাহিনী তৈরিতে সমস্যা হয়েছে।");
  }
};

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
  
  const systemInstruction = `Continue the following Bengali story naturally. 
Match the established tone (${settings.tone}) and style (${language}). 
Return only the continuation text.`;

  const prompt = `
  Context: ${projectDescription}
  Current Text: "...${currentText.slice(-2000)}"
  
  Write the next part of the story in Bengali:`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: settings.creativity,
        thinkingConfig: { thinkingBudget: 5000 }
      },
    });

    return response.text;
  } catch (error) {
    console.error("Continuation Error:", error);
    throw error;
  }
};

export const rewriteContent = async (
  content: string,
  instruction: string,
  genre: StoryGenre
): Promise<string | undefined> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const prompt = `
  Original Content: ${content}
  Instruction: ${instruction}
  Genre: ${genre}
  
  Rewrite the content in Bengali according to the instruction:`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are a master Bengali editor. Polishing text for high-end literature.",
        thinkingConfig: { thinkingBudget: 2000 }
      },
    });

    return response.text;
  } catch (error) {
    console.error("Rewrite Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this Bengali story emotionally: ${text.slice(0, 2000)}` }] }],
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
