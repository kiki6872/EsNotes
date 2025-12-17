import React, { useState, useMemo, useEffect } from 'react';
import { Flashcard, Note } from '../types';
import { RotateCcw, ChevronLeft, ChevronRight, Check, X, Layers, ArrowLeft, Trash2, Repeat, Pencil, Save, Plus, MoreHorizontal } from 'lucide-react';

interface FlashcardDeckProps {
  cards: Flashcard[];
  notes: Note[];
  onClose: () => void;
  onDeleteCard: (id: string) => void;
  onUpdateCard: (card: Flashcard) => void;
  onRenameDeck: (noteId: string, newTitle: string) => void;
  onAddCard: (noteId: string) => void;
  onDeleteDeck: (noteId: string) => void;
  initialDeckId?: string | null;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({ 
    cards, 
    notes, 
    onClose, 
    onDeleteCard, 
    onUpdateCard, 
    onRenameDeck, 
    onAddCard, 
    onDeleteDeck,
    initialDeckId
}) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(initialDeckId || null);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  
  // Effect to handle external navigation if needed (optional improvement)
  useEffect(() => {
      if (initialDeckId) setSelectedDeckId(initialDeckId);
  }, [initialDeckId]);

  // Group cards by noteId
  const decks = useMemo<Record<string, Flashcard[]>>(() => {
    const groups: Record<string, Flashcard[]> = {};
    cards.forEach(card => {
        const key = card.noteId || 'unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(card);
    });
    return groups;
  }, [cards]);

  const startEditingDeck = (e: React.MouseEvent, noteId: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingDeckId(noteId);
    setTempTitle(currentTitle);
  };

  const saveDeckTitle = (noteId: string) => {
    if (editingDeckId === noteId) {
        if (tempTitle.trim()) {
            onRenameDeck(noteId, tempTitle.trim());
        }
        setEditingDeckId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, noteId: string) => {
    if (e.key === 'Enter') {
        saveDeckTitle(noteId);
    } else if (e.key === 'Escape') {
        setEditingDeckId(null);
    }
  };

  // View: Deck List (Dashboard)
  if (!selectedDeckId) {
    return (
        <div className="flex-1 flex flex-col bg-slate-50 h-full p-8 overflow-y-auto">
             <div className="max-w-4xl mx-auto w-full">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-gray-800">Flashcard Decks</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-900">Close</button>
                </div>

                {Object.keys(decks).length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center shadow-sm">
                        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Layers size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Flashcards Yet</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                          Open a note, open the AI panel, and click "Generate Flashcards" to instantly create study materials from your notes and slides.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(decks).map(([noteId, deckCards]: [string, Flashcard[]]) => {
                            const note = notes.find(n => n.id === noteId);
                            const title = note ? note.title : (noteId === 'unknown' ? 'Uncategorized' : 'Unknown Note');
                            const date = note ? new Date(note.lastModified).toLocaleDateString() : 'Unknown';
                            const isEditing = editingDeckId === noteId;
                            
                            return (
                                <div 
                                    key={noteId}
                                    onClick={() => !isEditing && setSelectedDeckId(noteId)}
                                    className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all text-left group relative overflow-hidden cursor-pointer flex flex-col justify-between min-h-[140px]"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-sm shrink-0">
                                                <Layers size={24} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                {isEditing ? (
                                                    <div className="relative z-20 mb-1" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={tempTitle}
                                                            onChange={(e) => setTempTitle(e.target.value)}
                                                            onBlur={() => saveDeckTitle(noteId)}
                                                            onKeyDown={(e) => handleKeyDown(e, noteId)}
                                                            autoFocus
                                                            className="w-full text-lg font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                                                        />
                                                    </div>
                                                ) : (
                                                    <h3 className="font-bold text-gray-900 truncate text-lg leading-tight mb-1" title={title || 'Untitled'}>
                                                        {title || 'Untitled'}
                                                    </h3>
                                                )}
                                                <p className="text-sm text-gray-500 font-medium">
                                                    {deckCards.length} Flashcards
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {date}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-row gap-1 items-start relative z-20">
                                            <button 
                                                onClick={(e) => startEditingDeck(e, noteId, title || '')}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Rename Deck"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteDeck(noteId);
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Delete Deck"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="w-full h-1 bg-gray-100 rounded-full mt-4 overflow-hidden">
                                        <div className="h-full bg-purple-400 w-1/3 rounded-full"></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
             </div>
        </div>
    );
  }

  // View: Active Deck Review
  return (
    <ActiveDeckView 
        cards={decks[selectedDeckId] || []} 
        title={notes.find(n => n.id === selectedDeckId)?.title || 'Review'}
        deckId={selectedDeckId}
        onBack={() => setSelectedDeckId(null)}
        onDeleteCard={onDeleteCard}
        onUpdateCard={onUpdateCard}
        onAddCard={onAddCard}
        onDeleteDeck={onDeleteDeck}
    />
  );
};

interface ActiveDeckViewProps {
    cards: Flashcard[];
    title: string;
    deckId: string;
    onBack: () => void;
    onDeleteCard: (id: string) => void;
    onUpdateCard: (card: Flashcard) => void;
    onAddCard: (noteId: string) => void;
    onDeleteDeck: (id: string) => void;
}

const ActiveDeckView: React.FC<ActiveDeckViewProps> = ({ cards, title, deckId, onBack, onDeleteCard, onUpdateCard, onAddCard, onDeleteDeck }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit State
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');

  const handleAddAndEdit = () => {
    onAddCard(deckId);
    // After adding, we want to jump to the new card (last index) and start editing
    // We set a small timeout to allow state to propagate
    setTimeout(() => {
        setCurrentIndex(cards.length); // length because new card is added
        setEditFront("New Question");
        setEditBack("Answer");
        setIsEditing(true);
        setIsFlipped(false);
    }, 50);
  };

  // Handle case where all cards are deleted while in view
  if (cards.length === 0) {
      return (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
             <div className="text-center p-8">
                <div className="bg-gray-100 p-4 rounded-full inline-flex mb-4">
                  <Layers size={32} className="text-gray-400" />
                </div>
                <p className="text-gray-500 mb-6 font-medium">No cards remaining in this deck.</p>
                <div className="flex gap-4 justify-center">
                    <button onClick={onBack} className="text-gray-600 hover:text-gray-900 font-medium">Return to Decks</button>
                    <button onClick={() => onAddCard(deckId)} className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2">
                        <Plus size={18} /> Add First Card
                    </button>
                    <button onClick={() => { onDeleteDeck(deckId); onBack(); }} className="text-red-500 hover:text-red-700 font-medium flex items-center gap-2">
                        <Trash2 size={18} /> Delete Deck
                    </button>
                </div>
             </div>
          </div>
      );
  }

  // Handle safe index if cards are deleted
  const safeIndex = Math.min(currentIndex, cards.length - 1);
  const currentCard = cards[safeIndex];

  const handleNext = () => {
    setIsFlipped(false);
    if (safeIndex < cards.length - 1) {
      setTimeout(() => setCurrentIndex(c => c + 1), 300); // Wait for flip back
    } else {
      setTimeout(() => setFinished(true), 300);
    }
  };

  const handlePrev = () => {
    if (safeIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(c => c - 1), 300);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
     e.stopPropagation();
     onDeleteCard(currentCard.id);
     setIsFlipped(false);
     setIsEditing(false);
     if (safeIndex === cards.length - 1 && safeIndex > 0) {
         setCurrentIndex(safeIndex - 1);
     }
  };

  const startEditing = () => {
    setEditFront(currentCard.front);
    setEditBack(currentCard.back);
    setIsEditing(true);
    setIsFlipped(false);
  };

  const saveEdit = () => {
    onUpdateCard({
        ...currentCard,
        front: editFront,
        back: editBack
    });
    setIsEditing(false);
  };

  if (finished) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-gray-100 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Great Job! 🎉</h2>
          <p className="text-gray-500 mb-8">You've reviewed all {cards.length} cards in this deck.</p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => { setFinished(false); setCurrentIndex(0); }}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
            >
              <Repeat size={18} />
              Review Again
            </button>
            <button 
              onClick={onBack}
              className="w-full py-3 bg-gray-50 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"
            >
              Back to Decks
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full relative overflow-hidden">
      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex flex-col items-center">
             <span className="font-bold text-gray-900 text-sm truncate max-w-[150px] md:max-w-xs">{title}</span>
             {!isEditing && (
                 <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                            style={{ width: `${((safeIndex + 1) / cards.length) * 100}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-medium text-gray-400">{safeIndex + 1}/{cards.length}</span>
                 </div>
             )}
        </div>
        <div className="flex items-center gap-2">
            {!isEditing && (
                <>
                <button 
                    onClick={handleAddAndEdit}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Add Card"
                >
                    <Plus size={18} />
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button 
                    onClick={startEditing}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Card"
                >
                    <Pencil size={18} />
                </button>
                </>
            )}
            <button 
                onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete this card"
            >
                <Trash2 size={18} />
            </button>
            
            {/* New Delete Deck Button */}
             <div className="w-px h-4 bg-gray-200 mx-1"></div>
             <button 
                onClick={() => {
                     if(window.confirm("Delete this entire deck?")) {
                         onDeleteDeck(deckId);
                         onBack();
                     }
                }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Entire Deck"
            >
                <Trash2 size={18} className="text-red-300 hover:text-red-600" />
            </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-8 overflow-hidden">
        
        {isEditing ? (
            // Edit Mode Form
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-lg border border-gray-200 p-8 flex flex-col gap-6 max-h-full overflow-y-auto">
                 <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Pencil size={18} className="text-blue-500" />
                    Edit Flashcard
                 </h3>
                 
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Front (Question)</label>
                    <textarea 
                        value={editFront}
                        onChange={(e) => setEditFront(e.target.value)}
                        className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Back (Answer)</label>
                    <textarea 
                        value={editBack}
                        onChange={(e) => setEditBack(e.target.value)}
                        className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                    />
                 </div>
            </div>
        ) : (
            // Normal 3D Card Mode
            <div 
            className="perspective-1000 w-full max-w-2xl aspect-[3/2] md:aspect-[16/10] cursor-pointer group"
            onClick={() => setIsFlipped(!isFlipped)}
            >
            <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                
                {/* FRONT (Question) */}
                <div className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center justify-center p-8 md:p-12 text-center hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                <span className="mb-6 px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider rounded-full">Question</span>
                <div className="flex-1 flex items-center justify-center w-full overflow-y-auto hide-scrollbar">
                    <p className="text-2xl md:text-3xl font-medium text-gray-800 leading-snug selection:bg-blue-100">
                        {currentCard.front}
                    </p>
                </div>
                <p className="mt-6 text-xs font-medium text-gray-400 uppercase tracking-widest opacity-60">Tap to flip</p>
                </div>

                {/* BACK (Answer) */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-100 flex flex-col items-center justify-center p-8 md:p-12 text-center">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                <span className="mb-6 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold uppercase tracking-wider rounded-full">Answer</span>
                <div className="flex-1 flex items-center justify-center w-full overflow-y-auto custom-scrollbar">
                    <p className="text-xl md:text-2xl text-gray-700 leading-relaxed selection:bg-emerald-100">
                        {currentCard.back}
                    </p>
                </div>
                </div>

            </div>
            </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-24 bg-white border-t border-gray-200 flex items-center justify-center gap-6 shrink-0 px-4">
         {isEditing ? (
             <>
                <button 
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={saveEdit}
                    className="px-8 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 transition-transform active:scale-95"
                >
                    <Save size={18} />
                    Save Changes
                </button>
             </>
         ) : (
             <>
                <button 
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                disabled={safeIndex === 0}
                className="w-14 h-14 rounded-2xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                >
                <ChevronLeft size={28} />
                </button>

                <button 
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    className="flex-1 max-w-xs flex items-center justify-center gap-2 h-14 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-semibold text-lg transition-transform active:scale-95 shadow-xl shadow-gray-200"
                >
                    {safeIndex === cards.length - 1 ? 'Finish' : 'Next Card'}
                    {safeIndex < cards.length - 1 && <ChevronRight size={20} />}
                </button>
             </>
         )}
      </div>
    </div>
  );
};