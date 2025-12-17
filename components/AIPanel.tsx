import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Note, Flashcard, StudyTool } from '../types';
import { Send, MessageSquare, Wrench, X, WifiOff, AlertTriangle, Loader2 } from 'lucide-react';
import { chatWithGemini, hasApiKey, generateFlashcardsFromNotes } from '../services/geminiService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { StudyHub } from './StudyHub';

interface AIPanelProps {
  activeNote: Note | null;
  allNotes: Note[]; 
  existingFlashcards: Flashcard[];
  onGenerateFlashcards: (cards: any[]) => void;
  isOpen: boolean;
  onClose: () => void;
  isOnline?: boolean;
  activeTab?: 'chat' | 'tools';
  onTabChange?: (tab: 'chat' | 'tools') => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({ 
    activeNote, 
    allNotes,
    existingFlashcards, 
    onGenerateFlashcards, 
    isOpen, 
    onClose, 
    isOnline = true,
    activeTab = 'chat',
    onTabChange
}) => {
  const [internalTab, setInternalTab] = useState<'chat' | 'tools'>('chat');
  const currentTab = onTabChange ? activeTab : internalTab;
  const setTab = onTabChange || setInternalTab;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'Hi! I can help you study. Ask me questions about your notes, or say "Create flashcards" to generate a deck.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentTab === 'chat') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTab]);

  const handleSendMessage = async () => {
    if (!input.trim() || !activeNote || !isOnline || !hasApiKey()) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithGemini(messages, userMsg.text, activeNote.content || '');
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: response.text }]);

      if (response.toolCall && response.toolCall.name === 'createFlashcards') {
          // Trigger generation logic automatically
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "⚡ Analyzing your notes to create flashcards..." }]);
          
          try {
              const rawCards = await generateFlashcardsFromNotes([activeNote]);
              const finishedCards = rawCards.map(c => ({
                  ...c,
                  id: Date.now().toString() + Math.random().toString().slice(2),
                  noteId: activeNote.id,
                  box: 1
              }));
              onGenerateFlashcards(finishedCards);
              setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `✅ Created ${finishedCards.length} flashcards! Opening deck view...` }]);
          } catch (e) {
              setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "❌ Failed to generate cards. Please try again." }]);
          }
      }

    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Error connecting to AI.", isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;
  const keyExists = hasApiKey();

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-xl z-20 absolute right-0 md:relative">
      {/* Header Tabs */}
      <div className="h-14 border-b border-gray-100 flex items-center justify-between px-2 bg-white shrink-0">
        <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setTab('chat')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentTab === 'chat' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>
                <MessageSquare size={16} /> Chat
            </button>
            <button onClick={() => setTab('tools')} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentTab === 'tools' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}>
                <Wrench size={16} /> Hub
            </button>
        </div>
        <button onClick={onClose} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full"><X size={18} /></button>
      </div>

      {currentTab === 'chat' ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] rounded-2xl p-3.5 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none text-sm' : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none w-full'} ${msg.isError ? 'bg-red-50 text-red-600 border-red-100' : ''}`}>
                    {msg.role === 'model' ? <MarkdownRenderer>{msg.text}</MarkdownRenderer> : msg.text}
                    </div>
                </div>
                ))}
                {isLoading && <div className="flex justify-start"><div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"><Loader2 className="animate-spin text-blue-400" size={16}/></div></div>}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-white border-t border-gray-100">
                {!isOnline || !keyExists ? (
                    <div className="p-3 bg-gray-50 rounded-xl text-center text-sm text-gray-500 border border-gray-200 flex items-center justify-center gap-2">
                        {keyExists ? <WifiOff size={16} /> : <AlertTriangle size={16} />} <span>{keyExists ? "AI unavailable offline" : "API Key Not Configured"}</span>
                    </div>
                ) : (
                    <div className="flex gap-2">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask about this note..." disabled={isLoading} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                    <button onClick={handleSendMessage} disabled={isLoading || !input.trim()} className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"><Send size={18} /></button>
                    </div>
                )}
            </div>
          </>
      ) : (
          <div className="flex-1 overflow-hidden">
             <StudyHub note={activeNote} allNotes={allNotes} isOnline={isOnline} onGenerateFlashcards={onGenerateFlashcards} />
          </div>
      )}
    </div>
  );
};