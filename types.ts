
export type StoryGenre = 'Romance' | 'Thriller' | 'Adult/Erotica' | 'Drama' | 'Social' | 'Mystery' | 'Historical';

export interface StoryChapter {
  id: string;
  title: string;
  content: string;
}

export interface StoryProject {
  id: string;
  title: string;
  description: string;
  genre: StoryGenre;
  chapters: StoryChapter[];
  maturityLevel: 'General' | 'Adult' | '18+ Explicit';
  languageStyle: 'Sadhu' | 'Cholitobhasha' | 'Modern/Colloquial';
  createdAt: number;
}

export interface GenerationSettings {
  creativity: number;
  length: 'Short' | 'Medium' | 'Long' | 'Epic';
  tone: string;
}
