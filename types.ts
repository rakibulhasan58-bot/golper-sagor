
export type StoryGenre = 'Romance' | 'Thriller' | 'Adult/Erotica' | 'Drama' | 'Social' | 'Mystery' | 'Historical';
export type MaturityLevel = 'General' | 'Adult' | '18+ Explicit';
export type LanguageStyle = 'Sadhu' | 'Cholitobhasha' | 'Modern/Colloquial';
export type ChapterLength = 'Short' | 'Medium' | 'Long' | 'Epic';

export interface StoryChapter {
  id: string;
  title: string;
  content: string;
  // Overrides for project defaults
  genre?: StoryGenre;
  maturityLevel?: MaturityLevel;
  languageStyle?: LanguageStyle;
  settings?: GenerationSettings;
}

export interface GenerationSettings {
  creativity: number;
  length: ChapterLength;
  tone: string;
  customSystemPrompt?: string;
}

export interface StoryProject {
  id: string;
  title: string;
  description: string;
  genre: StoryGenre;
  chapters: StoryChapter[];
  maturityLevel: MaturityLevel;
  languageStyle: LanguageStyle;
  settings: GenerationSettings;
  createdAt: number;
}
