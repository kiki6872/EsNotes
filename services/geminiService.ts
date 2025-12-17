import { GoogleGenAI, Type, Modality, FunctionDeclaration } from "@google/genai";
import { ChatMessage, Flashcard, Note, QuizQuestion, QuizQuestionType } from "../types";

// Helper to check if API key exists without throwing
export const hasApiKey = (): boolean => {
  return !!process.env.API_KEY;
};

// Helper to get client
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

// Helper to aggregate content from multiple notes
const aggregateNoteContent = (notes: Note[]) => {
  let combinedText = "";
  const combinedImages: { mimeType: string; data: string }[] = [];

  notes.forEach(note => {
    combinedText += `\n\n--- NOTE SOURCE: ${note.title} ---\n`;
    combinedText += note.content || "No written text.";

    // Code cells
    if (note.templateId === 'tpl_developer' && note.cells) {
       combinedText += `\nCode Notebook (${note.language}):\n`;
       note.cells.forEach((cell, i) => {
          combinedText += `\nCell ${i+1} [${cell.type}]:\n${cell.content}\n`;
          if (cell.output) combinedText += `Output: ${cell.output}\n`;
       });
    }

    // Slide summaries
    const slideSummaries = note.slides
      .filter(s => s.summary)
      .map((s, i) => `Slide ${i + 1} Summary: ${s.summary}`)
      .join('\n');
    if (slideSummaries) combinedText += `\nSlide Summaries:\n${slideSummaries}`;

    // Collect Images (Multimodal)
    // Increased limit to 50 to cover "all slides" as requested by user
    if (combinedImages.length < 50) {
        const remaining = 50 - combinedImages.length;
        // Slice based on remaining capacity, effectively taking all if capacity allows
        note.slides.slice(0, remaining).forEach(slide => {
            if (slide.imageData && slide.imageData.includes('base64,')) {
                const mimeType = slide.imageData.split(';')[0].split(':')[1];
                const data = slide.imageData.split(',')[1];
                combinedImages.push({ mimeType, data });
            }
        });
    }
  });

  return { combinedText, combinedImages };
};

export interface ChatResponse {
  text: string;
  toolCall?: {
    name: string;
    args: any;
  };
}

const flashcardTool: FunctionDeclaration = {
  name: 'createFlashcards',
  description: 'Generate study flashcards from the current note content. Use this when the user asks to create, make, or generate flashcards.',
};

export const chatWithGemini = async (
  history: ChatMessage[],
  newMessage: string,
  contextNoteContent: string
): Promise<ChatResponse> => {
  try {
    const ai = getClient();
    
    // Construct a system instruction that gives the AI context about the user's current note
    const systemInstruction = `You are a helpful study assistant inside a note-taking app. 
    The user is currently viewing a note. 
    Here is the content of the current note for context (but answer general questions too if asked):
    ---
    ${contextNoteContent.substring(0, 15000)}
    ---
    Answer concisely and helpfully. If the user asks about the note, use the context above.
    If the user explicitly asks to create flashcards, call the createFlashcards tool.`;

    const model = "gemini-2.5-flash"; 
    
    const contents = [
      ...history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      })),
      {
        role: "user",
        parts: [{ text: newMessage }]
      }
    ];

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [flashcardTool] }]
      }
    });

    const call = response.functionCalls?.[0];
    if (call) {
        return { text: "Sure! I'm generating flashcards for this note now...", toolCall: { name: call.name, args: call.args } };
    }

    return { text: response.text || "I couldn't generate a response." };
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};

export const generateFlashcardsFromNotes = async (notes: Note[]): Promise<Omit<Flashcard, 'id' | 'box' | 'noteId'>[]> => {
  const ai = getClient();
  const parts: any[] = [];
  
  const { combinedText, combinedImages } = aggregateNoteContent(notes);

  let promptText = `Create a massive, exhaustive set of flashcards (Front/Back) based on the provided notes and ALL attached slides.
  
  GOAL: Help the student memorize EVERY single detail for an exam via active recall.
  
  RULES:
  1. **MAXIMUM QUANTITY**: Do NOT limit yourself. Generate as many cards as possible (aim for 30-50+ cards if content permits) to fully cover the material.
  2. **SLIDE COVERAGE**: You must look at EVERY image provided. Create specific cards for every diagram, chart, text block, or visual detail found in the slides.
  3. **Comprehensive**: Cover every definition, key term, date, figure, code concept, and concept found in the text and slide images.
  4. **Atomic**: Keep questions specific. Avoid broad "Explain X" questions; instead ask "What is the function of X?", "When did X happen?", "What are the 3 components of X?".
  
  Text Content:
  ${combinedText.substring(0, 100000)}`;

  parts.push({ text: promptText });
  for (const img of combinedImages) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.STRING },
            back: { type: Type.STRING }
          },
          required: ["front", "back"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse flashcards JSON", e);
    return [];
  }
};

export const convertSlideToNotes = async (base64Data: string, mimeType: string): Promise<string> => {
  const ai = getClient();
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType, 
            data: base64Data
          }
        },
        {
          text: "Analyze this document. Create a simplified, easy-to-understand text summary of the key points. Use Markdown formatting with headings and bullet points."
        }
      ]
    }
  });

  return response.text || "Could not analyze document.";
};

export const executeCodeWithAI = async (language: string, code: string): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [{
          text: `You are a code execution engine. 
          Act as a ${language} interpreter/compiler. 
          Execute the following code mentally and return ONLY the Standard Output (stdout).
          
          Rules:
          1. Return ONLY the output text. No explanations, no markdown formatting (like \`\`\`), no conversational filler.
          2. If the code has a syntax error or runtime error, output the error message exactly as the compiler/interpreter would.
          
          Code:
          ${code}`
        }]
      }
    });

    return response.text || "";
  } catch (error: any) {
    return `Error connecting to execution engine: ${error.message}`;
  }
};

// --- STUDY HUB FEATURES ---

export interface QuizConfig {
  amount: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  quizType: QuizQuestionType;
  typeCounts?: Partial<Record<QuizQuestionType, number>>; 
  topic?: string; 
}

export const generateQuizFromNotes = async (notes: Note[], config: QuizConfig): Promise<QuizQuestion[]> => {
    const ai = getClient();
    const parts: any[] = [];

    let promptInstructions = `You are an expert exam-question generator. 
    Generate a quiz based on the provided notes with EXACT formatting.
    
    DIFFICULTY: ${config.difficulty}
    
    STRICT FORMATTING RULES PER TYPE:
    
    1. **MCQ**: 
       - 'options': [A, B, C, D]
       - 'correctAnswer': Exact string match of correct option.
    
    2. **MultiSelect**:
       - 'options': [A, B, C, D]
       - 'correctAnswer': Comma-separated list of ALL correct options (e.g. "Option A, Option C").
    
    3. **TrueFalse**: 
       - 'options': ["True", "False"]
       - 'correctAnswer': "True" or "False"
    
    4. **ShortAnswer**: 
       - 'question': Open ended question.
       - 'explanation': MUST contain a "Model Answer" for the user to compare against.
    
    5. **FillBlank**: 
       - 'question': Sentence with exactly one "_____" placeholder.
       - 'options': A Word Bank containing the correct word + 3 distractors.
       - 'correctAnswer': The correct word.
    
    6. **Matching**: 
       - 'matchingPairs': Array of {left: "Term", right: "Definition"}.
       - 'question': "Match the terms on the left with definitions on the right."
    
    7. **Sequence**: 
       - 'options': List of steps in RANDOM order.
       - 'correctAnswer': Comma-separated string of steps in CORRECT order.
       - 'question': "Arrange the following steps in correct order:"
    
    8. **DiagramLabeling**: 
       - 'question': A text description of a diagram (e.g., "In a cell diagram where 1 is center, 2 is outer...").
       - 'explanation': "1=Nucleus, 2=Membrane..."
    
    9. **Scenario**: 
       - 'question': A short case study or story.
       - 'explanation': A detailed analysis of the scenario.
    
    10. **Coding**: 
        - 'codeSnippet': Provide a code block (if needed).
        - 'question': "What is the output?" or "Fix the bug".
        - 'explanation': The correct code or output.
    `;

    if (config.quizType === 'Mixed' && config.typeCounts) {
        promptInstructions += "\n\nMODE: EXAM SIMULATOR (Mixed Types). Generate exactly:\n";
        for (const [type, count] of Object.entries(config.typeCounts)) {
            if (count > 0) promptInstructions += `- ${count} questions of type '${type}'\n`;
        }
    } else {
        promptInstructions += `\nMODE: Single Type. Generate ${config.amount} questions of type '${config.quizType}'.`;
    }

    if (config.topic) promptInstructions += `\n\nFOCUS TOPIC: "${config.topic}"`;

    promptInstructions += `\n\nOUTPUT: JSON Array of objects matching the schema.`;

    const { combinedText, combinedImages } = aggregateNoteContent(notes);

    let promptText = `
    ${promptInstructions}
    
    CONTENT CONTEXT:
    ${combinedText.substring(0, 30000)}`;

    parts.push({ text: promptText });
    for (const img of combinedImages) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswer: { type: Type.STRING },
                        matchingPairs: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { left: { type: Type.STRING }, right: { type: Type.STRING } }
                            }
                        },
                        explanation: { type: Type.STRING },
                        codeSnippet: { type: Type.STRING }
                    },
                    required: ["question", "explanation", "type"]
                }
            }
        }
    });

    try {
        if (!response.text) return [];
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Quiz parsing error", e);
        return [];
    }
};

export const analyzeQuizResults = async (questions: QuizQuestion[], userAnswers: Record<number, any>): Promise<string> => {
  const ai = getClient();
  
  const performanceData = questions.map((q, i) => {
    return {
      question: q.question,
      type: q.type,
      correctAnswer: q.correctAnswer || "See explanation",
      userAnswer: userAnswers[i] || "(No Answer)",
    };
  });

  const prompt = `Analyze this student's exam performance.
  
  DATA:
  ${JSON.stringify(performanceData, null, 2)}
  
  TASK:
  1. Identify specific WEAKNESSES.
  2. Suggest specific TOPICS from the questions that need review.
  3. Provide a motivational closing.
  
  OUTPUT FORMAT (Markdown):
  ## Analysis
  [General comment]
  
  ### 📉 Weak Areas
  - **[Concept]**: [Why it was incorrect]
  
  ### 🎯 Study Recommendations
  - Review [Topic]...
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [{ text: prompt }] }
  });

  return response.text || "Could not analyze performance.";
};

export const gradeEssay = async (essay: string, rubric: string): Promise<string> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [{
                text: `Act as a strict academic grader. Grade the assignment based on the rubric.

                OUTPUT FORMAT (Markdown):
                # Grade: [Score]/100
                ## Summary
                [Brief summary]
                ## Detailed Feedback
                [Analysis against rubric]
                ## Improvements
                [Bullet points]

                RUBRIC:
                ${rubric || "Standard academic rubric."}

                SUBMISSION:
                ${essay.substring(0, 25000)}`
            }]
        }
    });
    return response.text || "Could not grade assignment.";
};

export const generatePodcastScript = async (notes: Note[]): Promise<string> => {
    const ai = getClient();
    const { combinedText } = aggregateNoteContent(notes);

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [{
                text: `Create a 2-person podcast script (Alex & Sam).
                Style: Engaging, educational, slightly funny.
                Content:
                ${combinedText.substring(0, 30000)}`
            }]
        }
    });
    return response.text || "Could not generate script.";
};

export const generatePodcastAudio = async (script: string, hostVoice: string, guestVoice: string): Promise<string> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text: script }] },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        { speaker: 'Alex', voiceConfig: { prebuiltVoiceConfig: { voiceName: hostVoice } } },
                        { speaker: 'Sam', voiceConfig: { prebuiltVoiceConfig: { voiceName: guestVoice } } }
                    ]
                }
            }
        }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");
    return base64Audio;
};

export const solveProblemFromImage = async (base64Data: string, mimeType: string): Promise<string> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: "Solve this problem step-by-step. Show work. Use Markdown." }
            ]
        }
    });
    return response.text || "Could not solve problem.";
};