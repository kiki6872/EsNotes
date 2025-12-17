
export type NoteTemplate = 'tpl_standard' | 'tpl_student' | 'tpl_developer';

export interface Cell {
  id: string;
  type: 'code' | 'markdown' | 'drawing';
  content: string;
  output?: string;
  language?: string;
  // View state
  isCodeCollapsed?: boolean;
  isOutputCollapsed?: boolean;
  // For Drawing Cells
  drawData?: {
    paths: DrawingPath[];
    height: number;
  };
}

export interface NoteBlock {
  id: string;
  type: 'text' | 'slide';
  content?: string; // For text blocks
  slideId?: string; // For slide blocks
}

export interface Note {
  id: string;
  title: string;
  content: string; // Used for AI context (concatenation of text blocks)
  blocks?: NoteBlock[]; // Ordered list of content
  cells?: Cell[]; // Used for Dev
  slides: Slide[]; // Database of slides
  lastModified: number;
  templateId?: NoteTemplate;
  language?: string; // For Dev mode (e.g., 'python', 'javascript')
  folderId?: string; // ID of the folder this note belongs to (null/undefined for root)
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Slide {
  id: string;
  imageData?: string; // Base64 (Optional for Whiteboards)
  paths: DrawingPath[];
  height: number;
  width: number;
  summary?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface DrawingPath {
  points: Point[];
  color: string;
  width: number;
  type: 'pen' | 'highlighter' | 'eraser';
}

export interface Flashcard {
  id: string;
  noteId: string; // Link to the specific note
  front: string;
  back: string;
  box: number; // For Leitner system (simplified here to just existing)
  nextReview?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export enum ViewMode {
  EDITOR = 'EDITOR',
  FLASHCARDS = 'FLASHCARDS',
}

// --- NEW QUIZ TYPES ---

export type QuizQuestionType = 
  | 'MCQ' 
  | 'MultiSelect' 
  | 'TrueFalse' 
  | 'ShortAnswer' 
  | 'FillBlank' 
  | 'Matching' 
  | 'Sequence'         // Drag and Drop (Sequence)
  | 'DiagramLabeling'  // Diagram Labeling
  | 'Scenario'         // Scenario-Based
  | 'Coding'           // Coding Question
  | 'Mixed';           // For Exam Mode config

export interface MatchingPair {
  left: string;
  right: string;
}

export interface QuizQuestion {
  id?: string;
  type: QuizQuestionType;
  question: string; // For DiagramLabeling, this is the description. For Scenario, this is the case study.
  options?: string[]; // Used for MCQ, MultiSelect, Sequence items, FillBlank word bank
  correctAnswer?: string | string[]; // String for most, array for MultiSelect/Sequence
  matchingPairs?: MatchingPair[]; // Specific for Matching type
  explanation: string; // Explanation or Model Answer for subjective types
  codeSnippet?: string; // Specific for Coding type
}

export interface Quiz {
  id: string;
  noteId: string;
  title: string;
  questions: QuizQuestion[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  createdAt: number;
  slideIds?: string[]; 
  quizType?: QuizQuestionType;
}

export type StudyTool = 'home' | 'quiz' | 'exam' | 'grader' | 'podcast' | 'solver';