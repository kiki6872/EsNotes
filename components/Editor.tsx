import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Note, Slide, NoteBlock } from '../types';
import { Loader2, Plus, PenTool, ArrowUp, ArrowDown, Trash2, Type, Image as ImageIcon, LayoutGrid, List, GripVertical } from 'lucide-react';
import { SlideCanvas } from './SlideCanvas';
import { DrawingToolbar } from './DrawingToolbar';

interface EditorProps {
  note: Note;
  onUpdateNote: (updatedNote: Note, saveImmediately?: boolean) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSaved: number;
}

const InsertBar: React.FC<{ onInsertText: () => void; onInsertPage: () => void }> = ({ onInsertText, onInsertPage }) => (
    <div className="h-6 relative group flex items-center justify-center my-1 z-10 transition-all">
       <div className="absolute inset-x-0 top-1/2 h-4 -mt-2 cursor-pointer"></div> {/* Hit area */}
       <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="h-0.5 bg-blue-400 w-full absolute top-1/2 left-0 z-0"></div>
          <div className="relative z-10 flex gap-2">
            <button onClick={onInsertText} className="bg-white border border-blue-200 text-blue-600 px-3 py-1 rounded-full text-xs font-medium shadow-sm hover:shadow hover:bg-blue-50 flex items-center gap-1 transform hover:scale-105 transition-transform">
                <Type size={12}/> Text
            </button>
            <button onClick={onInsertPage} className="bg-white border border-purple-200 text-purple-600 px-3 py-1 rounded-full text-xs font-medium shadow-sm hover:shadow hover:bg-purple-50 flex items-center gap-1 transform hover:scale-105 transition-transform">
                <ImageIcon size={12}/> Page
            </button>
          </div>
       </div>
    </div>
);

const TextBlock: React.FC<{ 
    content: string; 
    onChange: (val: string) => void; 
    onMoveUp: () => void; 
    onMoveDown: () => void;
    onDelete: () => void;
    isFirst: boolean;
    isLast: boolean;
    dragHandleProps?: any;
}> = ({ content, onChange, onMoveUp, onMoveDown, onDelete, isFirst, isLast, dragHandleProps }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [content]);

    return (
        <div className="group relative mb-2 flex gap-2 items-start">
            <div 
                {...dragHandleProps}
                className="mt-2 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <GripVertical size={20} />
            </div>
            <div className="flex-1 relative">
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10 bg-white/80 rounded-bl-lg">
                    <button onClick={onMoveUp} disabled={isFirst} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp size={14}/></button>
                    <button onClick={onMoveDown} disabled={isLast} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown size={14}/></button>
                    <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                </div>
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Type something..."
                    className="w-full resize-none text-lg text-gray-700 leading-relaxed placeholder-gray-300 border-none focus:outline-none focus:ring-0 min-h-[60px] bg-transparent hover:bg-white/50 focus:bg-white rounded-lg p-2 transition-colors"
                />
            </div>
        </div>
    );
};

export const Editor: React.FC<EditorProps> = ({ note, onUpdateNote, saveStatus, lastSaved }) => {
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [activeColor, setActiveColor] = useState('#2563eb');
  const [activeWidth, setActiveWidth] = useState(3);
  const [layoutMode, setLayoutMode] = useState<'list' | 'grid'>('list');
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [scrollToBlockId, setScrollToBlockId] = useState<string | null>(null);
  
  const [isProcessingSlide, setIsProcessingSlide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentEndRef = useRef<HTMLDivElement>(null);

  // Migration: Ensure blocks exist
  useEffect(() => {
    if (!note.blocks) {
        const newBlocks: NoteBlock[] = [];
        note.slides.forEach(slide => {
            newBlocks.push({ id: `blk-${slide.id}`, type: 'slide', slideId: slide.id });
        });
        if (note.content || newBlocks.length === 0) {
             newBlocks.push({ id: `blk-${Date.now()}`, type: 'text', content: note.content });
        }
        onUpdateNote({ ...note, blocks: newBlocks }, false); 
    }
  }, [note.id]);

  // Handle Scroll to New Block or Selected Block
  useEffect(() => {
    if (scrollToBlockId) {
        // We use a timeout to ensure the DOM has updated (especially when switching from Grid to List)
        const timer = setTimeout(() => {
            const element = document.getElementById(scrollToBlockId);
            if (element) {
                // Using 'start' aligns the top of the block with the top of the viewport
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                // If it's a text block, try to focus the textarea
                const textarea = element.querySelector('textarea');
                if (textarea) textarea.focus();
            }
        }, 300); // 300ms to allow for layout changes
        
        // Reset the scroll target after the action
        const resetTimer = setTimeout(() => {
             setScrollToBlockId(null);
        }, 350);

        return () => {
            clearTimeout(timer);
            clearTimeout(resetTimer);
        };
    }
  }, [scrollToBlockId, note.blocks, layoutMode]);


  const updateContentFromBlocks = (blocks: NoteBlock[]): string => {
      return blocks
        .filter(b => b.type === 'text')
        .map(b => b.content || '')
        .join('\n\n');
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<NoteBlock>) => {
      if (!note.blocks) return;
      const newBlocks = note.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b);
      
      const updatedNote = { 
          ...note, 
          blocks: newBlocks, 
          content: updateContentFromBlocks(newBlocks),
          lastModified: Date.now() 
      };
      onUpdateNote(updatedNote);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
      if (!note.blocks) return;
      const newBlocks = [...note.blocks];
      if (direction === 'up' && index > 0) {
          [newBlocks[index], newBlocks[index - 1]] = [newBlocks[index - 1], newBlocks[index]];
      } else if (direction === 'down' && index < newBlocks.length - 1) {
          [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
      }
      onUpdateNote({ ...note, blocks: newBlocks, content: updateContentFromBlocks(newBlocks) });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBlockIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedBlockIndex === null) return;
    if (draggedBlockIndex !== index) {
        e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedBlockIndex === null) return;
    if (draggedBlockIndex === targetIndex) return;
    
    const newBlocks = [...(note.blocks || [])];
    const [movedBlock] = newBlocks.splice(draggedBlockIndex, 1);
    newBlocks.splice(targetIndex, 0, movedBlock);
    
    onUpdateNote({ ...note, blocks: newBlocks, content: updateContentFromBlocks(newBlocks) });
    setDraggedBlockIndex(null);
  };

  const handleDeleteBlock = (blockId: string) => {
      if (!note.blocks) return;
      const block = note.blocks.find(b => b.id === blockId);
      
      let newSlides = note.slides;
      if (block?.type === 'slide' && block.slideId) {
          newSlides = note.slides.filter(s => s.id !== block.slideId);
      }

      const newBlocks = note.blocks.filter(b => b.id !== blockId);
      onUpdateNote({ 
          ...note, 
          blocks: newBlocks, 
          slides: newSlides, 
          content: updateContentFromBlocks(newBlocks) 
      }, true);
  };

  const handleInsertBlock = (index: number, type: 'text' | 'slide') => {
      if (!note.blocks) return;
      const newBlocks = [...note.blocks];
      const newBlockId = `blk-${Date.now()}`;
      
      if (type === 'text') {
          newBlocks.splice(index, 0, {
              id: newBlockId,
              type: 'text',
              content: ''
          });
          onUpdateNote({ ...note, blocks: newBlocks, content: updateContentFromBlocks(newBlocks) });
      } else {
          // Add Page
          const newSlideId = Date.now().toString();
          const newSlide: Slide = {
              id: newSlideId,
              width: 1200,
              height: 800,
              paths: []
          };
          const updatedSlides = [...note.slides, newSlide];
          
          newBlocks.splice(index, 0, {
              id: newBlockId, // Use the shared ID
              type: 'slide',
              slideId: newSlideId
          });
          
          onUpdateNote({ 
              ...note, 
              slides: updatedSlides, 
              blocks: newBlocks, 
              content: updateContentFromBlocks(newBlocks) 
          });
      }
      // Trigger scroll
      setScrollToBlockId(newBlockId);
  };

  const handleBlockDoubleClick = (blockId: string) => {
      setLayoutMode('list');
      setScrollToBlockId(blockId);
  };

  const updateSlide = (updatedSlide: Slide) => {
    const newSlides = (note.slides || []).map(s => s.id === updatedSlide.id ? updatedSlide : s);
    onUpdateNote({ ...note, slides: newSlides });
  };

  const addSlideBlock = (newSlide: Slide) => {
      const updatedSlides = [...(note.slides || []), newSlide];
      const newBlockId = `blk-${newSlide.id}`;
      const newBlocks = [...(note.blocks || []), {
          id: newBlockId,
          type: 'slide' as const,
          slideId: newSlide.id
      }];
      onUpdateNote({ 
          ...note, 
          slides: updatedSlides, 
          blocks: newBlocks,
          content: updateContentFromBlocks(newBlocks)
      }, true);
      // Trigger scroll
      setScrollToBlockId(newBlockId);
  };

  const processPdf = async (file: File) => {
    setIsProcessingSlide(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) throw new Error("PDF.js library is not loaded.");
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pagesToProcess = Math.min(pdf.numPages, 50);
      const timestamp = Date.now();
      
      let currentSlides = [...(note.slides || [])];
      let currentBlocks = [...(note.blocks || [])];
      let firstNewBlockId: string | null = null;

      for (let i = 1; i <= pagesToProcess; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        const newSlide: Slide = {
            id: `${timestamp}-${i}`,
            imageData: canvas.toDataURL('image/jpeg', 0.8),
            width: viewport.width,
            height: viewport.height,
            paths: []
        };
        const blockId = `blk-${newSlide.id}`;
        if (!firstNewBlockId) firstNewBlockId = blockId;

        currentSlides.push(newSlide);
        currentBlocks.push({ id: blockId, type: 'slide', slideId: newSlide.id });
      }
      
      onUpdateNote({ 
          ...note, 
          slides: currentSlides, 
          blocks: currentBlocks,
          content: updateContentFromBlocks(currentBlocks)
      }, true);

      // Scroll to the first added page from PDF
      if (firstNewBlockId) {
          setScrollToBlockId(firstNewBlockId);
      }
      
    } catch (error) {
      console.error("Error processing PDF", error);
      alert("Failed to process PDF.");
    } finally {
      setIsProcessingSlide(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSlideUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.ppt') || file.name.endsWith('.pptx') || file.type.includes('presentation')) {
        alert("To import PowerPoint slides, please 'Save as PDF' in PowerPoint first, then upload the PDF here.");
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    if (file.type === 'application/pdf') {
        await processPdf(file);
        return;
    }

    setIsProcessingSlide(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const newSlide: Slide = {
            id: Date.now().toString(),
            imageData: event.target?.result as string,
            width: img.width,
            height: img.height,
            paths: []
          };
          addSlideBlock(newSlide);
          setIsProcessingSlide(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing image", error);
      alert("Failed to process image.");
      setIsProcessingSlide(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const blocks = note.blocks || []; 

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Toolbar */}
      <div className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0 shadow-sm z-10 overflow-x-auto">
        <div className="flex items-center gap-4">
            <DrawingToolbar 
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                activeColor={activeColor}
                setActiveColor={setActiveColor}
                activeWidth={activeWidth}
                setActiveWidth={setActiveWidth}
            />
            {/* View Toggle */}
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setLayoutMode('list')}
                    className={`p-1.5 rounded-md transition-colors ${layoutMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                    title="List View"
                >
                    <List size={18} />
                </button>
                <button 
                    onClick={() => setLayoutMode('grid')}
                    className={`p-1.5 rounded-md transition-colors ${layoutMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                    title="Page Sorter (Grid)"
                >
                    <LayoutGrid size={18} />
                </button>
            </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
           <div className="hidden md:flex items-center gap-1.5 text-xs shrink-0">
            {saveStatus === 'saving' ? (
                <>
                <Loader2 size={12} className="animate-spin text-blue-500" />
                <span className="text-blue-500 font-medium">Saving...</span>
                </>
            ) : saveStatus === 'unsaved' ? (
                <span className="text-amber-500 font-medium">Unsaved</span>
            ) : (
                <span className="text-gray-400">Saved</span>
            )}
           </div>
           
           <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept="image/*,.pdf,.ppt,.pptx"
            onChange={handleSlideUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingSlide}
            className="flex items-center gap-2 text-sm bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors font-medium shadow-sm whitespace-nowrap"
          >
            {isProcessingSlide ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            {isProcessingSlide ? 'Processing...' : 'Add Slides / PDF'}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100">
        <div className="max-w-4xl mx-auto min-h-[calc(100%-2rem)] flex flex-col pb-20">
          
          <input
            type="text"
            value={note.title}
            onChange={(e) => onUpdateNote({...note, title: e.target.value})}
            placeholder="Note Title"
            className="w-full text-4xl font-bold text-gray-900 placeholder-gray-300 border-none focus:outline-none focus:ring-0 mb-8 bg-transparent"
          />

          {blocks.length === 0 ? (
             <div className="text-center p-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                 <p className="mb-4">Start writing or add a page</p>
                 <div className="flex justify-center gap-4">
                    <button onClick={() => handleInsertBlock(0, 'text')} className="flex items-center gap-1 text-blue-500 font-medium"><Type size={16}/> Add Text</button>
                    <button onClick={() => handleInsertBlock(0, 'slide')} className="flex items-center gap-1 text-purple-500 font-medium"><ImageIcon size={16}/> Add Page</button>
                 </div>
             </div>
          ) : layoutMode === 'grid' ? (
              /* Grid View (Page Sorter) */
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {blocks.map((block, index) => {
                      const isDragging = draggedBlockIndex === index;
                      const slide = note.slides.find(s => s.id === block.slideId);

                      return (
                          <div 
                            key={block.id}
                            id={block.id} // Added ID for scroll target
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDoubleClick={() => handleBlockDoubleClick(block.id)}
                            className={`relative border-2 rounded-xl overflow-hidden cursor-pointer transition-all aspect-[4/3] bg-white group ${isDragging ? 'opacity-25 border-dashed border-gray-400' : 'border-gray-200 hover:border-blue-500 hover:shadow-md'}`}
                            title="Double-click to jump to page"
                          >
                                <div className="absolute top-2 left-2 z-10 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                    {index + 1}
                                </div>
                                <button 
                                    onClick={() => handleDeleteBlock(block.id)}
                                    className="absolute top-2 right-2 z-10 bg-white text-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                >
                                    <Trash2 size={14} />
                                </button>
                                
                                <div className="w-full h-full flex items-center justify-center p-2">
                                    {block.type === 'text' ? (
                                        <div className="text-[8px] text-gray-400 overflow-hidden w-full h-full text-left p-2 bg-gray-50 rounded select-none">
                                            {block.content?.substring(0, 300) || '(Empty Text Block)'}
                                        </div>
                                    ) : (
                                        slide && (
                                            <div className="w-full h-full relative overflow-hidden pointer-events-none">
                                                <SlideCanvas
                                                    slide={slide}
                                                    activeTool={'pen'} // Dummy
                                                    activeColor={'black'} // Dummy
                                                    activeWidth={1} // Dummy
                                                    onUpdateSlide={() => {}} // Dummy
                                                    onDeleteSlide={() => {}} // Dummy
                                                    readOnly={true}
                                                />
                                            </div>
                                        )
                                    )}
                                </div>
                          </div>
                      );
                  })}
                  {/* Add New Block in Grid */}
                  <div className="border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center aspect-[4/3] bg-white/50 hover:bg-blue-50 hover:border-blue-300 transition-colors gap-2 flex-col cursor-pointer" onClick={() => handleInsertBlock(blocks.length, 'slide')}>
                       <Plus size={24} className="text-gray-400" />
                       <span className="text-xs text-gray-500 font-medium">Add Page</span>
                  </div>
              </div>
          ) : (
             /* List View */
             blocks.map((block, index) => {
                 return (
                    <React.Fragment key={block.id}>
                        {index === 0 && (
                            <InsertBar 
                                onInsertText={() => handleInsertBlock(0, 'text')} 
                                onInsertPage={() => handleInsertBlock(0, 'slide')} 
                            />
                        )}

                        <div 
                            id={block.id} // Added ID for scroll target
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            className={`relative transition-opacity ${draggedBlockIndex === index ? 'opacity-30' : 'opacity-100'}`}
                        >
                            {block.type === 'text' ? (
                                <TextBlock 
                                    content={block.content || ''}
                                    onChange={(val) => handleUpdateBlock(block.id, { content: val })}
                                    onMoveUp={() => handleMoveBlock(index, 'up')}
                                    onMoveDown={() => handleMoveBlock(index, 'down')}
                                    onDelete={() => handleDeleteBlock(block.id)}
                                    isFirst={index === 0}
                                    isLast={index === blocks.length - 1}
                                    dragHandleProps={{ draggable: true }}
                                />
                            ) : (
                                (() => {
                                    const slide = note.slides.find(s => s.id === block.slideId);
                                    if (!slide) return <div className="p-4 text-red-500 border border-red-200 rounded">Slide not found</div>;
                                    return (
                                        <div className="group flex gap-2 items-start">
                                            <div 
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                className="mt-4 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <GripVertical size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <SlideCanvas
                                                    slide={slide}
                                                    activeTool={activeTool}
                                                    activeColor={activeColor}
                                                    activeWidth={activeWidth}
                                                    onUpdateSlide={updateSlide}
                                                    onDeleteSlide={() => handleDeleteBlock(block.id)}
                                                    onMoveUp={() => handleMoveBlock(index, 'up')}
                                                    onMoveDown={() => handleMoveBlock(index, 'down')}
                                                    isFirst={index === 0}
                                                    isLast={index === blocks.length - 1}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()
                            )}
                        </div>

                        <InsertBar 
                            onInsertText={() => handleInsertBlock(index + 1, 'text')} 
                            onInsertPage={() => handleInsertBlock(index + 1, 'slide')} 
                        />
                    </React.Fragment>
                 );
             })
          )}

          <div ref={contentEndRef}></div>
        </div>
      </div>
    </div>
  );
};