import React, { useState, useEffect, useRef } from 'react';
import { NoteList } from './components/NoteList';
import { Editor } from './components/Editor';
import { DevEditor } from './components/DevEditor';
import { AIPanel } from './components/AIPanel';
import { FlashcardDeck } from './components/FlashcardDeck';
import { TemplateSelector } from './components/TemplateSelector';
import { Note, Flashcard, ViewMode, NoteTemplate, Folder } from './types';
import { Menu, PanelRightClose, PanelRightOpen, Undo2, X, WifiOff, Database, KeyRound, AlertTriangle } from 'lucide-react';
import { loadData, saveData, AppData } from './services/storage';
import { hasApiKey } from './services/geminiService';

const INITIAL_NOTE: Note = {
  id: '1',
  title: 'Welcome to ESNotes',
  content: `## Welcome to ESNotes 👋
This is a demo of a Samsung Notes-inspired app powered by Gemini.
### Features:
- **Templates**: Create Standard, Student, or Developer notes.
- **AI Chat**: Ask questions about your notes in the right panel.
- **Studley AI Hub**: Click the "ESNotes" logo in the top left to open the advanced study dashboard!`,
  slides: [], lastModified: Date.now(), templateId: 'tpl_standard'
};

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([INITIAL_NOTE]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(INITIAL_NOTE.id);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.EDITOR);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(true);
  const [aiPanelTab, setAiPanelTab] = useState<'chat' | 'tools'>('chat');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const notesRef = useRef(notes);
  const foldersRef = useRef(folders);
  const flashcardsRef = useRef(flashcards);
  const isDirtyRef = useRef(false);
  const isFirstRender = useRef(true);

  const activeNote = notes.find(n => n.id === activeNoteId) || null;

  useEffect(() => {
    notesRef.current = notes; foldersRef.current = folders; flashcardsRef.current = flashcards;
    if (isFirstRender.current) return;
    isDirtyRef.current = true; setSaveStatus('unsaved');
  }, [notes, folders, flashcards]);

  useEffect(() => {
    const init = async () => {
        const data = await loadData();
        if (data) {
            setNotes(data.notes.map((n: any) => ({ ...n, slides: n.slides || [], templateId: n.templateId || 'tpl_standard', cells: n.cells || [], folderId: n.folderId || null })));
            setFolders(data.folders || []); setFlashcards(data.flashcards || []);
        }
        setTimeout(() => { isFirstRender.current = false; isDirtyRef.current = false; setSaveStatus('saved'); }, 100);
    };
    init();
  }, []);

  useEffect(() => {
    const performSave = async () => {
      if (!isDirtyRef.current) return;
      setSaveStatus('saving');
      try {
          await saveData({ notes: notesRef.current, folders: foldersRef.current, flashcards: flashcardsRef.current });
          setTimeout(() => { setSaveStatus('saved'); isDirtyRef.current = false; }, 500);
      } catch (e) { setSaveStatus('unsaved'); }
    };
    const intervalId = setInterval(performSave, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const handleCreateNoteRequest = (folderId: string | null = null) => { setTargetFolderId(folderId); setShowTemplateSelector(true); };
  
  const handleTemplateSelected = (templateId: NoteTemplate, language?: string) => {
    const newNote: Note = { id: Date.now().toString(), title: '', content: '', slides: [], lastModified: Date.now(), templateId, language, cells: [], folderId: targetFolderId || undefined };
    setNotes([newNote, ...notes]); setActiveNoteId(newNote.id); setViewMode(ViewMode.EDITOR); setShowTemplateSelector(false);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const openHub = () => {
      setIsAIPanelOpen(true);
      setAiPanelTab('tools');
  };

  const handleFlashcardsGenerated = (newCards: Flashcard[]) => {
      setFlashcards(prev => [...prev, ...newCards]);
      setViewMode(ViewMode.FLASHCARDS);
  };

  const handleDeleteDeck = (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this entire flashcard deck? The note will remain.")) {
        setFlashcards(prev => prev.filter(c => c.noteId !== noteId));
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-gray-900 relative">
      {showTemplateSelector && <TemplateSelector onSelect={handleTemplateSelected} onCancel={() => setShowTemplateSelector(false)} />}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-10 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <div className={`fixed md:relative z-20 h-full transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:flex`}>
        <NoteList 
          notes={notes} folders={folders} flashcards={flashcards} activeNoteId={activeNoteId} 
          onSelectNote={(id) => { setActiveNoteId(id); setViewMode(ViewMode.EDITOR); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
          onSelectDeck={(id) => { setActiveNoteId(id); setViewMode(ViewMode.FLASHCARDS); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
          onCreateNote={handleCreateNoteRequest}
          onDeleteNote={(id, e) => { e.stopPropagation(); setNotes(notes.filter(n => n.id !== id)); }}
          onRenameNote={(id, t) => setNotes(notes.map(n => n.id === id ? { ...n, title: t } : n))}
          onCreateFolder={(n) => setFolders([...folders, { id: Date.now().toString(), name: n, createdAt: Date.now() }])}
          onDeleteFolder={(id, e) => { e.stopPropagation(); setFolders(folders.filter(f => f.id !== id)); setNotes(notes.map(n => n.folderId === id ? { ...n, folderId: undefined } : n)); }}
          onRenameFolder={(id, n) => setFolders(folders.map(f => f.id === id ? { ...f, name: n } : f))}
          onMoveNote={(nId, fId) => setNotes(notes.map(n => n.id === nId ? { ...n, folderId: fId || undefined } : n))}
          onOpenDashboard={openHub}
          onDeleteDeck={handleDeleteDeck}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 md:hidden"><Menu size={20} /></button>
            {activeNote && activeNote.templateId !== 'tpl_developer' && (
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setViewMode(ViewMode.EDITOR)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === ViewMode.EDITOR ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Notes</button>
                <button onClick={() => setViewMode(ViewMode.FLASHCARDS)} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === ViewMode.FLASHCARDS ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Flashcards</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!hasApiKey() ? <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-semibold"><KeyRound size={14} /> No API Key</div> : !isOnline && <div className="flex items-center gap-1.5 bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg text-xs font-semibold"><WifiOff size={14} /> Offline</div>}
            {activeNote && <button onClick={() => setIsAIPanelOpen(!isAIPanelOpen)} className={`p-2 rounded-lg transition-colors ${isAIPanelOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}>{isAIPanelOpen ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}</button>}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          {activeNote ? (
             activeNote.templateId === 'tpl_developer' ? <DevEditor note={activeNote} onUpdateNote={(n) => setNotes(notes.map(old => old.id === n.id ? n : old))} saveStatus={saveStatus} lastSaved={Date.now()} /> :
             viewMode === ViewMode.EDITOR ? <Editor note={activeNote} onUpdateNote={(n) => setNotes(notes.map(old => old.id === n.id ? n : old))} saveStatus={saveStatus} lastSaved={Date.now()} /> :
             <FlashcardDeck 
                cards={flashcards} 
                notes={notes} 
                onClose={() => setViewMode(ViewMode.EDITOR)} 
                onDeleteCard={(id) => setFlashcards(prev => prev.filter(c => c.id !== id))} 
                onUpdateCard={(c) => setFlashcards(prev => prev.map(old => old.id === c.id ? c : old))} 
                onRenameDeck={(noteId, newTitle) => setNotes(prev => prev.map(n => n.id === noteId ? { ...n, title: newTitle } : n))}
                onAddCard={(noteId) => {
                    const newCard: Flashcard = {
                        id: Date.now().toString() + Math.random().toString().slice(2),
                        noteId: noteId,
                        front: 'New Question',
                        back: 'New Answer',
                        box: 1
                    };
                    setFlashcards(prev => [...prev, newCard]);
                }}
                onDeleteDeck={handleDeleteDeck}
             />
          ) : <div className="flex-1 flex items-center justify-center text-gray-400 bg-slate-50">Select a note or create a new one</div>}

          {activeNote && isAIPanelOpen && (
            <div className="hidden md:block h-full">
               <AIPanel activeNote={activeNote} allNotes={notes} existingFlashcards={flashcards} onGenerateFlashcards={handleFlashcardsGenerated} isOpen={true} onClose={() => setIsAIPanelOpen(false)} isOnline={isOnline} activeTab={aiPanelTab} onTabChange={setAiPanelTab} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default App;