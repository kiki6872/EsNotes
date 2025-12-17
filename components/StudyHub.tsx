import React, { useState, useRef, useEffect } from 'react';
import { Note, Quiz, QuizQuestion, QuizQuestionType, StudyTool } from '../types';
import { generateQuizFromNotes, gradeEssay, generatePodcastScript, solveProblemFromImage, generatePodcastAudio, analyzeQuizResults, generateFlashcardsFromNotes } from '../services/geminiService';
import { Brain, FileText, Mic, Camera, X, CheckCircle, Loader2, Upload, ChevronLeft, Plus, Play, Trash2, Sparkles, GraduationCap, ArrowRight, Settings, AlignJustify, CheckSquare, GripVertical, Code, Layers } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface StudyHubProps {
  note: Note | null;
  allNotes: Note[];
  isOnline?: boolean;
  onGenerateFlashcards?: (cards: any[]) => void;
}

type ViewState = 'menu' | 'quiz_setup' | 'quiz_active' | 'exam_setup' | 'grader' | 'solver' | 'podcast' | 'flashcards';

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede', 'Leda', 'Orpheus', 'Pegasus', 'Thalia'];

// Helper to construct a WAV header for raw PCM data
const addWavHeader = (pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1) => {
    const buffer = new ArrayBuffer(44 + pcmData.length);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); // Byte rate
    view.setUint16(32, numChannels * 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length, true);

    const pcmArray = new Uint8Array(buffer, 44);
    pcmArray.set(pcmData);

    return buffer;
};

export const StudyHub: React.FC<StudyHubProps> = ({ note, allNotes, isOnline = true, onGenerateFlashcards }) => {
  const [view, setView] = useState<ViewState>('menu');
  const [loading, setLoading] = useState(false);
  
  // -- Selection State --
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  useEffect(() => {
    if (note && selectedNoteIds.length === 0) setSelectedNoteIds([note.id]);
  }, [note]);

  const toggleNoteSelection = (id: string) => {
    setSelectedNoteIds(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  };

  const getSelectedNotes = () => allNotes.filter(n => selectedNoteIds.includes(n.id));

  // -- Quiz/Exam State --
  const [quizConfig, setQuizConfig] = useState<any>({ amount: 5, difficulty: 'Medium', type: 'MCQ' });
  const [currentQuiz, setCurrentQuiz] = useState<QuizQuestion[]>([]);
  // We store answers flexibly based on type (string, array, object)
  const [quizAnswers, setQuizAnswers] = useState<Record<number, any>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizTopic, setQuizTopic] = useState('');
  const [quizAnalysis, setQuizAnalysis] = useState<string | null>(null);

  // -- Grader State --
  const [essayText, setEssayText] = useState('');
  const [rubricText, setRubricText] = useState('');
  const [gradeResult, setGradeResult] = useState('');

  // -- Solver State --
  const [solverImage, setSolverImage] = useState<string | null>(null);
  const [solverResult, setSolverResult] = useState('');

  // -- Podcast State --
  const [podcastScript, setPodcastScript] = useState('');
  const [podcastAudioUrl, setPodcastAudioUrl] = useState<string | null>(null);
  const [hostVoice, setHostVoice] = useState('Puck');
  const [guestVoice, setGuestVoice] = useState('Kore');

  // --- Handlers ---

  const handleCreateQuiz = async (isExam = false) => {
    if (getSelectedNotes().length === 0) { alert("Select at least one note."); return; }
    setLoading(true);
    setQuizAnalysis(null);
    try {
        // For Exam mode, we create a balanced mix
        const typeCounts = isExam ? { 
            'MCQ': Math.max(1, Math.floor(quizConfig.amount * 0.3)), 
            'TrueFalse': Math.max(1, Math.floor(quizConfig.amount * 0.2)),
            'ShortAnswer': Math.max(1, Math.floor(quizConfig.amount * 0.2)),
            'Scenario': Math.max(0, Math.floor(quizConfig.amount * 0.1)),
            'FillBlank': Math.max(0, Math.floor(quizConfig.amount * 0.2))
        } : undefined;

        const questions = await generateQuizFromNotes(getSelectedNotes(), {
            amount: quizConfig.amount,
            difficulty: quizConfig.difficulty,
            quizType: isExam ? 'Mixed' : quizConfig.type,
            typeCounts: typeCounts,
            topic: quizTopic
        });
        setCurrentQuiz(questions);
        
        // Initialize sequence answers to default order if sequence type exists
        const initialAnswers: any = {};
        questions.forEach((q, i) => {
            if (q.type === 'Sequence' && q.options) {
                initialAnswers[i] = [...q.options];
            } else if (q.type === 'Matching') {
                initialAnswers[i] = {}; // Object for pairs
            } else if (q.type === 'MultiSelect') {
                initialAnswers[i] = [];
            }
        });
        setQuizAnswers(initialAnswers);
        
        setQuizSubmitted(false);
        setView('quiz_active');
    } catch (e) { 
        console.error(e);
        alert("Failed to generate quiz. Please try again."); 
    }
    setLoading(false);
  };

  const handleAnalyzeQuiz = async () => {
    if (!currentQuiz.length) return;
    setLoading(true);
    try {
        const result = await analyzeQuizResults(currentQuiz, quizAnswers);
        setQuizAnalysis(result);
    } catch(e) { alert("Analysis failed"); }
    setLoading(false);
  };

  const handleGenerateFlashcards = async () => {
    if (getSelectedNotes().length === 0) { alert("Select at least one note."); return; }
    setLoading(true);
    try {
        const rawCards = await generateFlashcardsFromNotes(getSelectedNotes());
        // Determine the ID to associate cards with. Use active note if present, or first selected.
        const targetNoteId = note ? note.id : selectedNoteIds[0];
        
        const finishedCards = rawCards.map(c => ({
            ...c,
            id: Date.now().toString() + Math.random().toString().slice(2),
            noteId: targetNoteId,
            box: 1
        }));
        
        if (onGenerateFlashcards) {
            onGenerateFlashcards(finishedCards);
        } else {
            alert(`Generated ${finishedCards.length} cards, but no handler was provided.`);
        }
    } catch (e) {
        alert("Failed to generate flashcards.");
    } finally {
        setLoading(false);
    }
  };

  const handleGrade = async () => {
      if (!essayText) return;
      setLoading(true);
      try {
          const res = await gradeEssay(essayText, rubricText);
          setGradeResult(res);
      } catch (e) { alert("Grading failed"); }
      setLoading(false);
  };

  const handleSolve = async () => {
      if (!solverImage) return;
      setLoading(true);
      try {
          const base64 = solverImage.split(',')[1];
          const mime = solverImage.split(';')[0].split(':')[1];
          const res = await solveProblemFromImage(base64, mime);
          setSolverResult(res);
      } catch (e) { alert("Solving failed"); }
      setLoading(false);
  };

  const handlePodcast = async () => {
      if (getSelectedNotes().length === 0) { alert("Select notes first"); return; }
      setLoading(true);
      try {
          const script = await generatePodcastScript(getSelectedNotes());
          setPodcastScript(script);
          
          const audioBase64 = await generatePodcastAudio(script, hostVoice, guestVoice);
          
          // Decode Base64
          const binaryString = window.atob(audioBase64);
          const len = binaryString.length;
          const pcmBytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) pcmBytes[i] = binaryString.charCodeAt(i);
          
          // Add WAV Header (Gemini TTS returns raw PCM)
          const wavBuffer = addWavHeader(pcmBytes, 24000, 1);
          
          const blob = new Blob([wavBuffer], { type: 'audio/wav' });
          setPodcastAudioUrl(URL.createObjectURL(blob));
      } catch (e) { 
          console.error(e);
          alert("Podcast generation failed. Please try again."); 
      }
      setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setText: (s: string) => void) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      setText(text);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => setSolverImage(ev.target?.result as string);
      reader.readAsDataURL(file);
  };

  const renderNoteSelector = () => (
    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm max-h-60 overflow-y-auto">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block sticky top-0 bg-white pb-2 border-b border-gray-100 z-10">Select Source Notes</label>
        <div className="space-y-2">
            {allNotes.map(n => (
                <label key={n.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer group transition-colors">
                    <input type="checkbox" checked={selectedNoteIds.includes(n.id)} onChange={() => toggleNoteSelection(n.id)} className="hidden" />
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedNoteIds.includes(n.id) ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300 group-hover:border-blue-300'}`}>
                        {selectedNoteIds.includes(n.id) && <CheckSquare size={14} />}
                    </div>
                    <span className={`text-sm font-medium truncate ${selectedNoteIds.includes(n.id) ? 'text-gray-900' : 'text-gray-600'}`}>{n.title || 'Untitled'}</span>
                </label>
            ))}
            {allNotes.length === 0 && <p className="text-sm text-gray-400 italic p-2">No notes available.</p>}
        </div>
    </div>
  );

  // --- Specialized Renderers for Question Types ---

  const renderQuestionInput = (q: QuizQuestion, i: number) => {
    const ans = quizAnswers[i];

    // 1. MCQ & True/False
    if (q.type === 'MCQ' || q.type === 'TrueFalse') {
        return (
            <div className="space-y-2 mt-3">
                {q.options?.map((opt, idx) => {
                    const isSelected = ans === opt;
                    const isCorrect = q.correctAnswer === opt;
                    let style = "border-gray-200 hover:bg-gray-50";
                    if (quizSubmitted) {
                        if (isCorrect) style = "bg-green-100 border-green-500 text-green-900 font-medium";
                        else if (isSelected) style = "bg-red-50 border-red-300 text-red-800";
                        else style = "opacity-60 border-gray-100";
                    } else if (isSelected) {
                        style = "bg-blue-50 border-blue-500 text-blue-900 font-medium";
                    }
                    return (
                        <button key={idx} disabled={quizSubmitted} onClick={() => setQuizAnswers({...quizAnswers, [i]: opt})}
                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${style}`}>
                            <span>{opt}</span>
                            {isSelected && <CheckCircle size={16} className={quizSubmitted ? (isCorrect ? "text-green-600" : "text-red-500") : "text-blue-500"} />}
                        </button>
                    )
                })}
            </div>
        );
    }

    // 2. MultiSelect
    if (q.type === 'MultiSelect') {
        const currentSelected = (Array.isArray(ans) ? ans : []) as string[];
        return (
            <div className="space-y-2 mt-3">
                <p className="text-xs text-gray-400 font-medium uppercase mb-2">Select all that apply</p>
                {q.options?.map((opt, idx) => {
                    const isSelected = currentSelected.includes(opt);
                    const correctArr = (q.correctAnswer as string || '').split(',').map(s=>s.trim());
                    const isCorrect = correctArr.includes(opt);
                    
                    let style = "border-gray-200 hover:bg-gray-50";
                    if (quizSubmitted) {
                        if (isCorrect) style = "bg-green-50 border-green-500 text-green-900";
                        else if (isSelected && !isCorrect) style = "bg-red-50 border-red-300 text-red-800";
                    } else if (isSelected) {
                        style = "bg-blue-50 border-blue-500 text-blue-900";
                    }

                    return (
                        <button key={idx} disabled={quizSubmitted} 
                            onClick={() => {
                                const newSel = isSelected ? currentSelected.filter(s => s !== opt) : [...currentSelected, opt];
                                setQuizAnswers({...quizAnswers, [i]: newSel});
                            }}
                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${style}`}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300'}`}>
                                {isSelected && <CheckSquare size={14} />}
                            </div>
                            <span>{opt}</span>
                        </button>
                    )
                })}
            </div>
        );
    }

    // 3. Matching
    if (q.type === 'Matching' && q.matchingPairs) {
        // ans is Record<string, string> where key is 'left' item
        const matches = ans || {};
        const leftItems = q.matchingPairs.map(p => p.left);
        const rightItems = q.matchingPairs.map(p => p.right); // We should shuffle these ideally, but simple map for now

        return (
            <div className="mt-3 grid grid-cols-1 gap-4">
                {leftItems.map((left, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row md:items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <span className="font-medium text-sm flex-1">{left}</span>
                        <ArrowRight size={16} className="text-gray-400 hidden md:block" />
                        <select 
                            disabled={quizSubmitted}
                            value={matches[left] || ''}
                            onChange={(e) => setQuizAnswers({...quizAnswers, [i]: { ...matches, [left]: e.target.value }})}
                            className={`flex-1 p-2 border rounded-lg text-sm bg-white ${quizSubmitted && matches[left] !== q.matchingPairs?.find(p=>p.left===left)?.right ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                        >
                            <option value="">Select match...</option>
                            {rightItems.map((r, ri) => <option key={ri} value={r}>{r}</option>)}
                        </select>
                    </div>
                ))}
            </div>
        );
    }

    // 4. Sequence / Ordering
    if (q.type === 'Sequence') {
        const sequence = Array.isArray(ans) ? ans : q.options || [];
        
        const moveItem = (fromIdx: number, toIdx: number) => {
            if (toIdx < 0 || toIdx >= sequence.length) return;
            const newSeq = [...sequence];
            const [moved] = newSeq.splice(fromIdx, 1);
            newSeq.splice(toIdx, 0, moved);
            setQuizAnswers({...quizAnswers, [i]: newSeq});
        };

        return (
            <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-400 font-medium uppercase mb-2">Drag or click arrows to reorder</p>
                {sequence.map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                        <div className="flex flex-col gap-0.5">
                            <button disabled={quizSubmitted || idx === 0} onClick={() => moveItem(idx, idx-1)} className="text-gray-400 hover:text-blue-600 disabled:opacity-20"><ChevronLeft size={14} className="rotate-90" /></button>
                            <button disabled={quizSubmitted || idx === sequence.length-1} onClick={() => moveItem(idx, idx+1)} className="text-gray-400 hover:text-blue-600 disabled:opacity-20"><ChevronLeft size={14} className="-rotate-90" /></button>
                        </div>
                        <span className="text-gray-400 font-mono text-xs w-4">{idx+1}.</span>
                        <span className="flex-1 text-sm font-medium">{item}</span>
                        <GripVertical size={16} className="text-gray-300 cursor-grab" />
                    </div>
                ))}
                {quizSubmitted && (
                    <div className="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded">
                        <strong>Correct Order:</strong> {q.correctAnswer}
                    </div>
                )}
            </div>
        );
    }

    // 5. Fill in Blank
    if (q.type === 'FillBlank') {
        return (
            <div className="mt-3 space-y-3">
                 <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-base leading-relaxed font-medium text-gray-800">
                     {/* Replace underscores with input box visually */}
                     {q.question.split('_____').map((part, pIdx, arr) => (
                         <React.Fragment key={pIdx}>
                             {part}
                             {pIdx < arr.length - 1 && (
                                 <input 
                                     type="text" 
                                     disabled={quizSubmitted}
                                     value={ans || ''}
                                     onChange={(e) => setQuizAnswers({...quizAnswers, [i]: e.target.value})}
                                     placeholder="Type answer..."
                                     className={`mx-2 px-2 py-1 border-b-2 border-blue-400 bg-white focus:outline-none focus:border-blue-600 text-blue-800 w-32 text-center ${quizSubmitted && ans !== q.correctAnswer ? 'border-red-400 text-red-600' : ''}`}
                                 />
                             )}
                         </React.Fragment>
                     ))}
                 </div>
                 {q.options && (
                     <div className="flex flex-wrap gap-2 mt-2">
                         {q.options.map((word, wIdx) => (
                             <button key={wIdx} disabled={quizSubmitted} onClick={() => setQuizAnswers({...quizAnswers, [i]: word})}
                                 className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs hover:border-blue-300 hover:text-blue-600 transition-colors">
                                 {word}
                             </button>
                         ))}
                     </div>
                 )}
            </div>
        );
    }

    // 6. Coding
    if (q.type === 'Coding') {
        return (
            <div className="mt-3 space-y-3">
                {q.codeSnippet && (
                    <div className="bg-slate-900 text-blue-200 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800">
                        <pre>{q.codeSnippet}</pre>
                    </div>
                )}
                <textarea 
                    disabled={quizSubmitted}
                    value={ans || ''}
                    onChange={(e) => setQuizAnswers({...quizAnswers, [i]: e.target.value})}
                    placeholder="Type your code or answer here..."
                    className="w-full h-32 p-3 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
            </div>
        )
    }

    // 7. General Text Inputs (Short Answer, Scenario, DiagramLabeling)
    return (
        <div className="mt-3">
            {q.type === 'DiagramLabeling' && <div className="text-xs text-gray-500 mb-2 italic">Refere to the description above. Identify the labels (e.g. "1=Nucleus").</div>}
            <textarea 
                disabled={quizSubmitted}
                value={ans || ''}
                onChange={(e) => setQuizAnswers({...quizAnswers, [i]: e.target.value})}
                placeholder={q.type === 'Scenario' ? "Explain your analysis..." : "Type your answer..."}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none min-h-[80px]"
            />
        </div>
    );
  };

  // --- Main View ---

  if (view === 'menu') {
      return (
          <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto bg-slate-50">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Study Hub Tools</h3>
              
              {[
                  { id: 'quiz_setup', icon: <Brain size={20}/>, title: 'Quiz Generator', desc: 'Practice specific topics', color: 'text-purple-600 bg-purple-50' },
                  { id: 'exam_setup', icon: <GraduationCap size={20}/>, title: 'Mock Exam', desc: 'Simulate full tests', color: 'text-indigo-600 bg-indigo-50' },
                  { id: 'flashcards', icon: <Layers size={20}/>, title: 'Flashcard Creator', desc: 'Generate decks from notes', color: 'text-orange-600 bg-orange-50' },
                  { id: 'grader', icon: <FileText size={20}/>, title: 'Assignment Grader', desc: 'Get feedback on essays', color: 'text-blue-600 bg-blue-50' },
                  { id: 'solver', icon: <Camera size={20}/>, title: 'Snap & Solve', desc: 'Solution from image', color: 'text-emerald-600 bg-emerald-50' },
                  { id: 'podcast', icon: <Mic size={20}/>, title: 'Podcast Creator', desc: 'Listen to your notes', color: 'text-pink-600 bg-pink-50' },
              ].map((tool) => (
                  <button key={tool.id} onClick={() => setView(tool.id as ViewState)} 
                      className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl hover:shadow-md hover:scale-[1.02] transition-all text-left group">
                      <div className={`p-3 rounded-xl ${tool.color} group-hover:scale-110 transition-transform`}>{tool.icon}</div>
                      <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{tool.title}</h4>
                          <p className="text-xs text-gray-500">{tool.desc}</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                  </button>
              ))}
          </div>
      );
  }

  return (
      <div className="flex flex-col h-full bg-slate-50">
          <div className="h-14 flex items-center gap-3 px-4 bg-white border-b border-gray-200 shrink-0 shadow-sm z-10">
              <button onClick={() => setView('menu')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><ChevronLeft size={20}/></button>
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  {view === 'quiz_active' ? (quizSubmitted ? 'Results' : 'Active Quiz') : 
                   view === 'grader' ? 'Essay Grader' : 
                   view === 'solver' ? 'Snap & Solve' : 
                   view === 'podcast' ? 'Podcast Studio' : 
                   view === 'flashcards' ? 'Flashcard Creator' : 'Setup'}
              </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
              {/* QUIZ & EXAM SETUP */}
              {(view === 'quiz_setup' || view === 'exam_setup') && (
                  <div className="space-y-6">
                      {renderNoteSelector()}
                      
                      <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-5 shadow-sm">
                          <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Questions</label>
                                <input type="number" min="1" max="100" value={quizConfig.amount} onChange={(e) => setQuizConfig({...quizConfig, amount: parseInt(e.target.value)})} 
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                              </div>
                              <div className="flex-1">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Difficulty</label>
                                <select value={quizConfig.difficulty} onChange={(e) => setQuizConfig({...quizConfig, difficulty: e.target.value})} 
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                                    <option>Easy</option><option>Medium</option><option>Hard</option>
                                </select>
                              </div>
                          </div>

                          {view === 'quiz_setup' && (
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Question Type</label>
                                <select value={quizConfig.type} onChange={(e) => setQuizConfig({...quizConfig, type: e.target.value})} 
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                                    <option value="MCQ">Multiple Choice</option>
                                    <option value="MultiSelect">Multiple Select</option>
                                    <option value="TrueFalse">True / False</option>
                                    <option value="ShortAnswer">Short Answer</option>
                                    <option value="FillBlank">Fill in the Blanks</option>
                                    <option value="Matching">Matching Pairs</option>
                                    <option value="Sequence">Sequence / Ordering</option>
                                    <option value="DiagramLabeling">Diagram Labeling</option>
                                    <option value="Scenario">Scenario / Case Study</option>
                                    <option value="Coding">Coding Problem</option>
                                </select>
                            </div>
                          )}
                          <div>
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Specific Topic (Optional)</label>
                              <input type="text" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} placeholder="e.g. Photosynthesis, WW2..." 
                                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                          </div>
                      </div>

                      <button onClick={() => handleCreateQuiz(view === 'exam_setup')} disabled={loading} 
                          className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-lg shadow-gray-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                          {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18}/>}
                          Generate {view === 'exam_setup' ? 'Mock Exam' : 'Quiz'}
                      </button>
                  </div>
              )}

              {/* FLASHCARDS GENERATOR */}
              {view === 'flashcards' && (
                  <div className="space-y-6">
                      {renderNoteSelector()}
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-center">
                          <Layers size={48} className="mx-auto text-orange-200 mb-4" />
                          <h4 className="text-lg font-bold text-gray-900 mb-2">Create Study Deck</h4>
                          <p className="text-sm text-gray-500 mb-6">
                            AI will analyze your selected notes and slides to create a comprehensive flashcard deck for active recall.
                          </p>
                          <button onClick={handleGenerateFlashcards} disabled={loading} 
                              className="w-full py-4 bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                              {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18}/>}
                              Generate Flashcards
                          </button>
                      </div>
                  </div>
              )}

              {/* QUIZ ACTIVE */}
              {view === 'quiz_active' && (
                  <div className="space-y-6 pb-20">
                      {currentQuiz.map((q, i) => (
                          <div key={i} className={`bg-white p-5 rounded-2xl border transition-all ${quizSubmitted ? (
                              // Correctness logic is complex for some types, defaulting to neutral/blue for subjective
                              (q.type === 'MCQ' || q.type === 'TrueFalse') && quizAnswers[i] === q.correctAnswer ? 'border-green-200 ring-1 ring-green-100' : 'border-gray-200'
                          ) : 'border-gray-200 shadow-sm'}`}>
                              <div className="flex gap-3 mb-2">
                                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center">{i+1}</span>
                                  <div className="space-y-1">
                                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-md">{q.type}</span>
                                      <p className="font-medium text-gray-900 text-sm leading-relaxed">{q.question}</p>
                                  </div>
                              </div>
                              
                              {renderQuestionInput(q, i)}

                              {quizSubmitted && (
                                  <div className="mt-4 pt-3 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
                                      <div className="text-xs text-gray-500 space-y-1">
                                          {(q.type !== 'Matching' && q.type !== 'Sequence') && (
                                              <p><span className="font-bold text-gray-700">Correct Answer:</span> <span className="text-green-700">{Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}</span></p>
                                          )}
                                          <p className="bg-gray-50 p-2 rounded-lg mt-1 border border-gray-100"><span className="font-bold text-gray-700">Explanation:</span> {q.explanation}</p>
                                      </div>
                                  </div>
                              )}
                          </div>
                      ))}
                      
                      {!quizSubmitted ? (
                          <button onClick={() => setQuizSubmitted(true)} className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-xl hover:bg-black transition-all sticky bottom-4">
                              Submit Answers
                          </button>
                      ) : (
                          <div className="space-y-4">
                              {!quizAnalysis && (
                                  <button onClick={handleAnalyzeQuiz} disabled={loading} className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-200 flex items-center justify-center gap-2">
                                      {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />} Get AI Feedback
                                  </button>
                              )}
                              {quizAnalysis && (
                                  <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100 text-sm text-gray-800">
                                      <MarkdownRenderer>{quizAnalysis}</MarkdownRenderer>
                                  </div>
                              )}
                              <button onClick={() => setView('menu')} className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50">
                                  Back to Menu
                              </button>
                          </div>
                      )}
                  </div>
              )}

              {/* GRADER */}
              {view === 'grader' && (
                  <div className="space-y-5">
                      <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:bg-gray-50 transition-colors relative group">
                          <input type="file" onChange={(e) => handleFileUpload(e, setEssayText)} className="absolute inset-0 opacity-0 cursor-pointer"/>
                          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                             <Upload size={24} />
                          </div>
                          <p className="text-sm font-bold text-gray-700">Upload Assignment</p>
                          <p className="text-xs text-gray-400 mt-1">.txt or .doc files supported</p>
                      </div>
                      
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rubric / Marking Scheme</label>
                          <textarea value={rubricText} onChange={(e) => setRubricText(e.target.value)} 
                              placeholder="Paste the grading criteria here for better results..." 
                              className="w-full h-32 p-4 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none shadow-sm" />
                      </div>

                      <button onClick={handleGrade} disabled={loading || !essayText} 
                          className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                           {loading ? <Loader2 className="animate-spin" /> : <FileText size={18} />} Grade Essay
                      </button>
                      
                      {gradeResult && (
                          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-in slide-in-from-bottom-5">
                              <MarkdownRenderer>{gradeResult}</MarkdownRenderer>
                          </div>
                      )}
                  </div>
              )}

              {/* SOLVER */}
              {view === 'solver' && (
                  <div className="space-y-5">
                      <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/30 rounded-2xl p-8 text-center relative group overflow-hidden">
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10"/>
                          {solverImage ? (
                              <img src={solverImage} className="max-h-60 mx-auto rounded-lg shadow-md" />
                          ) : (
                              <>
                                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                    <Camera size={24} />
                                </div>
                                <p className="text-sm font-bold text-emerald-800">Upload Problem</p>
                                <p className="text-xs text-emerald-600/70 mt-1">Take a picture of math, science, or logic problems</p>
                              </>
                          )}
                      </div>
                      <button onClick={handleSolve} disabled={loading || !solverImage} 
                          className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2">
                           {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />} Snap & Solve
                      </button>
                      {solverResult && (
                          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-in slide-in-from-bottom-5">
                              <MarkdownRenderer>{solverResult}</MarkdownRenderer>
                          </div>
                      )}
                  </div>
              )}

              {/* PODCAST */}
              {view === 'podcast' && (
                  <div className="space-y-5">
                      {renderNoteSelector()}
                      <div className="flex gap-3">
                          <div className="flex-1 space-y-1">
                              <label className="text-xs font-bold text-gray-400 uppercase">Host Voice</label>
                              <select value={hostVoice} onChange={(e) => setHostVoice(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm">
                                  {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                          </div>
                          <div className="flex-1 space-y-1">
                              <label className="text-xs font-bold text-gray-400 uppercase">Guest Voice</label>
                              <select value={guestVoice} onChange={(e) => setGuestVoice(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm">
                                  {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                          </div>
                      </div>
                      <button onClick={handlePodcast} disabled={loading} className="w-full py-3 bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-200 flex items-center justify-center gap-2">
                          {loading ? <Loader2 className="animate-spin"/> : <Mic size={18}/>} Generate Podcast
                      </button>
                      {podcastAudioUrl && (
                          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                              <audio controls src={podcastAudioUrl} className="w-full h-10"/>
                          </div>
                      )}
                      {podcastScript && (
                          <div className="bg-white p-5 rounded-2xl border border-gray-200 max-h-80 overflow-y-auto shadow-inner">
                              <MarkdownRenderer>{podcastScript}</MarkdownRenderer>
                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>
  );
};