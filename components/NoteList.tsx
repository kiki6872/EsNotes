import React, { useState } from 'react';
import { Note, Flashcard, Folder } from '../types';
import { Plus, FileText, Trash2, Search, GraduationCap, Terminal, Layers, Pencil, FolderPlus, Folder as FolderIcon, CornerUpLeft } from 'lucide-react';

interface NoteListProps {
  notes: Note[];
  folders: Folder[];
  flashcards: Flashcard[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onSelectDeck: (id: string) => void;
  onCreateNote: (folderId: string | null) => void;
  onDeleteNote: (id: string, e: React.MouseEvent) => void;
  onRenameNote: (id: string, newTitle: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string, e: React.MouseEvent) => void;
  onRenameFolder: (id: string, newName: string) => void;
  onMoveNote: (noteId: string, folderId: string | null) => void;
  onOpenDashboard: () => void;
  onDeleteDeck: (id: string, e: React.MouseEvent) => void;
}

export const NoteList: React.FC<NoteListProps> = ({ 
  notes, folders, flashcards, activeNoteId, onSelectNote, onSelectDeck, onCreateNote, onDeleteNote, onRenameNote, onCreateFolder, onDeleteFolder, onRenameFolder, onMoveNote, onOpenDashboard, onDeleteDeck
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'decks'>('notes');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const currentFolder = folders.find(f => f.id === currentFolderId);

  const getIconForTemplate = (note: Note) => {
    switch (note.templateId) {
      case 'tpl_student': return <GraduationCap size={16} className="text-emerald-500" />;
      case 'tpl_developer': return <Terminal size={16} className="text-slate-500" />;
      default: return <FileText size={16} className="text-blue-500" />;
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = (note.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'decks') return flashcards.some(f => f.noteId === note.id);
    if (!searchTerm) return currentFolderId ? note.folderId === currentFolderId : !note.folderId;
    return true;
  });

  const filteredFolders = folders.filter(folder => (folder.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  const startEditing = (e: React.MouseEvent, id: string, currentVal: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditValue(currentVal);
  };

  const saveEditing = (isFolder: boolean) => {
    if (editingId && editValue.trim()) {
      isFolder ? onRenameFolder(editingId, editValue.trim()) : onRenameNote(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const saveNewFolder = () => {
      if (newFolderName.trim()) onCreateFolder(newFolderName.trim());
      setIsCreatingFolder(false);
      setNewFolderName('');
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-72 shrink-0">
      <div className="p-4 border-b border-gray-100">
        <button onClick={onOpenDashboard} className="w-full text-left group" title="Open Study Hub">
            <h1 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm group-hover:scale-110 transition-transform">ES</span>
                ESNotes
            </h1>
        </button>
        <div className="flex gap-2 mb-2">
            <button onClick={() => onCreateNote(currentFolderId)} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm"><Plus size={16} /> Note</button>
            <button onClick={() => { setIsCreatingFolder(true); setActiveTab('notes'); setCurrentFolderId(null); }} className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg"><FolderPlus size={18} /></button>
        </div>
      </div>
      
      <div className="p-3">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg mb-1">
          <button onClick={() => setActiveTab('notes')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'notes' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Files</button>
          <button onClick={() => setActiveTab('decks')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'decks' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Decks</button>
        </div>
      </div>

      {activeTab === 'notes' && !searchTerm && (
        <div className="px-4 py-2 border-b border-gray-50 flex items-center gap-2 text-sm text-gray-500 bg-gray-50/50" onDragOver={(e) => e.preventDefault()} onDrop={() => onMoveNote(filteredNotes[0]?.id, null)}>
            {currentFolderId ? <><button onClick={() => setCurrentFolderId(null)} className="hover:text-blue-600 flex items-center gap-1"><CornerUpLeft size={14} /> Home</button><span>/</span><span className="font-semibold text-gray-800 truncate">{currentFolder?.name}</span></> : <span className="font-medium text-gray-400">Home</span>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isCreatingFolder && (
             <div className="p-2 pb-0">
                <div className="w-full text-left p-3 rounded-xl bg-yellow-50 border border-yellow-200 shadow-sm flex items-center gap-2">
                    <FolderIcon size={18} className="text-yellow-500 fill-yellow-100" />
                    <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onBlur={saveNewFolder} onKeyDown={(e) => e.key === 'Enter' && saveNewFolder()} autoFocus placeholder="New Folder" className="flex-1 bg-white border border-yellow-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 min-w-0" />
                </div>
             </div>
        )}

        {activeTab === 'notes' && !currentFolderId && !searchTerm && (
            <ul className="space-y-1 p-2 pb-0">
                {folders.map(folder => (
                    <li key={folder.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onMoveNote(e.dataTransfer.getData('noteId'), folder.id)}>
                        <div className="group flex items-center w-full p-2 rounded-xl hover:bg-yellow-50 text-gray-700 transition-all cursor-pointer">
                            <div onClick={() => setCurrentFolderId(folder.id)} className="flex-1 flex items-center gap-2 min-w-0">
                                <FolderIcon size={18} className="text-yellow-500 fill-yellow-100 shrink-0" />
                                {editingId === folder.id ? <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => saveEditing(true)} onKeyDown={(e) => e.key === 'Enter' && saveEditing(true)} autoFocus className="flex-1 bg-white border border-blue-300 rounded px-1 text-sm" onClick={(e) => e.stopPropagation()} /> : <span className="font-medium text-sm text-gray-900 truncate">{folder.name}</span>}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => startEditing(e, folder.id, folder.name)} className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50"><Pencil size={14} /></button>
                                <button onClick={(e) => onDeleteFolder(folder.id, e)} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        )}

        <ul className="space-y-1 p-2">
            {filteredNotes.map(note => (
                <li key={note.id} draggable onDragStart={(e) => e.dataTransfer.setData('noteId', note.id)}>
                   <div className={`group flex items-center w-full p-2 rounded-xl transition-all cursor-pointer ${activeNoteId === note.id ? 'bg-blue-50 border border-blue-100 text-blue-900 shadow-sm ring-1 ring-blue-100' : 'hover:bg-gray-50 text-gray-700 border border-transparent'}`} onClick={() => { activeTab === 'decks' ? onSelectDeck(note.id) : onSelectNote(note.id); }}>
                       <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                {activeTab === 'decks' ? <Layers size={16} className="text-purple-500" /> : getIconForTemplate(note)}
                                {editingId === note.id ? <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => saveEditing(false)} onKeyDown={(e) => e.key === 'Enter' && saveEditing(false)} autoFocus className="flex-1 bg-white border border-blue-300 rounded px-1 text-sm" onClick={(e) => e.stopPropagation()} /> : <h3 className="font-semibold truncate text-sm text-gray-900">{note.title || 'Untitled'}</h3>}
                            </div>
                       </div>
                       <div className="flex items-center gap-1 pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => startEditing(e, note.id, note.title)} className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50"><Pencil size={14} /></button>
                            <button 
                                onClick={(e) => {
                                    if (activeTab === 'decks') {
                                        onDeleteDeck(note.id, e);
                                    } else {
                                        onDeleteNote(note.id, e);
                                    }
                                }} 
                                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                                title={activeTab === 'decks' ? "Delete Flashcards" : "Delete Note"}
                            >
                                <Trash2 size={14} />
                            </button>
                       </div>
                   </div>
                </li>
            ))}
        </ul>
      </div>
    </div>
  );
};