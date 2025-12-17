import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Note, Cell, Slide } from '../types';
import { Play, Plus, Trash2, Terminal, Loader2, ChevronDown, ChevronRight, Eye, EyeOff, LayoutTemplate, PenTool } from 'lucide-react';
import { executeCodeWithAI } from '../services/geminiService';
import { SlideCanvas } from './SlideCanvas';
import { DrawingToolbar } from './DrawingToolbar';

interface DevCellProps {
  cell: Cell;
  index: number;
  isExecuting: boolean;
  onUpdate: (id: string, updates: Partial<Cell>) => void;
  onRun: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (type: 'code' | 'markdown' | 'drawing', index: number) => void;
  language: string;
  // Drawing props
  activeTool: 'pen' | 'highlighter' | 'eraser';
  activeColor: string;
  activeWidth: number;
}

const DevCell: React.FC<DevCellProps> = ({ 
  cell, 
  index, 
  isExecuting, 
  onUpdate, 
  onRun, 
  onRemove, 
  onAdd, 
  language,
  activeTool,
  activeColor,
  activeWidth
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useLayoutEffect(() => {
    if (textareaRef.current && !cell.isCodeCollapsed) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(80, textareaRef.current.scrollHeight)}px`;
    }
  }, [cell.content, cell.isCodeCollapsed]);

  const toggleCodeCollapse = () => {
    onUpdate(cell.id, { isCodeCollapsed: !cell.isCodeCollapsed });
  };

  const toggleOutputCollapse = () => {
    onUpdate(cell.id, { isOutputCollapsed: !cell.isOutputCollapsed });
  };

  const handleDrawingUpdate = (updatedSlide: Slide) => {
      onUpdate(cell.id, { 
          drawData: {
              paths: updatedSlide.paths,
              height: updatedSlide.height
          }
      });
  };

  return (
    <div className="group relative">
      {/* Cell Controls / Sidebar */}
      <div className="flex items-start gap-2">
        <div className="w-16 pt-2 text-right shrink-0 flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <span className="text-xs font-mono text-gray-400">[{index + 1}]:</span>
          <button 
            onClick={() => onRemove(cell.id)} 
            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
            title="Delete Cell"
          >
            <Trash2 size={14} />
          </button>
          {cell.type === 'code' && (
              <button
                onClick={toggleCodeCollapse}
                className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
                title={cell.isCodeCollapsed ? "Expand Code" : "Collapse Code"}
              >
                {cell.isCodeCollapsed ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {cell.type === 'code' ? (
            <div className={`border rounded-md overflow-hidden shadow-sm transition-all ${
              cell.isCodeCollapsed ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-gray-50'
            }`}>
              {/* Cell Header */}
              <div className="flex items-center bg-gray-100 border-b border-gray-200 px-2 py-1 gap-2 justify-between h-9">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onRun(cell.id)}
                    disabled={isExecuting}
                    className="p-1 hover:bg-white rounded text-green-600 transition-colors disabled:opacity-50"
                    title="Run Cell"
                  >
                    {isExecuting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                  </button>
                  <span className="text-xs text-gray-500 font-medium">
                    {cell.isCodeCollapsed ? `Code hidden (${cell.content.split('\n').length} lines)` : `Code (${language})`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {language === 'javascript' ? 'Local Runtime' : 'AI Runtime'}
                  </span>
                </div>
              </div>

              {/* Code Input */}
              {!cell.isCodeCollapsed && (
                <div className="relative bg-white">
                  <textarea
                    ref={textareaRef}
                    value={cell.content}
                    onChange={(e) => onUpdate(cell.id, { content: e.target.value })}
                    className="w-full p-3 font-mono text-sm focus:outline-none min-h-[80px] resize-y bg-white text-gray-900"
                    spellCheck={false}
                    placeholder="Write code here..."
                  />
                </div>
              )}

              {/* Output Section */}
              {cell.output && (
                <div className="border-t border-gray-200 bg-white">
                   <div 
                      className="flex items-center gap-2 px-2 py-1 bg-gray-50 cursor-pointer hover:bg-gray-100 select-none border-b border-gray-100"
                      onClick={toggleOutputCollapse}
                   >
                      {cell.isOutputCollapsed ? <ChevronRight size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                      <span className="text-xs text-gray-500 font-medium">Output</span>
                   </div>
                   
                   {!cell.isOutputCollapsed && (
                     <div className="p-3 font-mono text-sm whitespace-pre-wrap text-gray-700 bg-white animate-in fade-in slide-in-from-top-1 duration-200">
                        {cell.output}
                     </div>
                   )}
                </div>
              )}
            </div>
          ) : cell.type === 'drawing' ? (
              // Drawing Cell
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                   <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border-b border-gray-100">
                       <PenTool size={12} className="text-blue-500" />
                       <span className="text-xs font-semibold text-gray-500 uppercase">Sketch / Diagram</span>
                   </div>
                   <div className="relative">
                       {/* Map Cell Draw Data to Slide Format for Reusability */}
                       <SlideCanvas
                           slide={{
                               id: cell.id,
                               paths: cell.drawData?.paths || [],
                               width: 1200, // Virtual width for dev cells
                               height: cell.drawData?.height || 400
                           }}
                           activeTool={activeTool}
                           activeColor={activeColor}
                           activeWidth={activeWidth}
                           onUpdateSlide={handleDrawingUpdate}
                           onDeleteSlide={() => onRemove(cell.id)}
                       />
                   </div>
              </div>
          ) : (
            // Markdown Cell
            <div className="p-2 -ml-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-all group/md">
               <div className="flex items-center gap-2 mb-1 opacity-0 group-hover/md:opacity-100 transition-opacity">
                   <LayoutTemplate size={12} className="text-gray-400"/>
                   <span className="text-[10px] text-gray-400 uppercase font-medium">Markdown</span>
               </div>
               <textarea
                ref={textareaRef}
                value={cell.content}
                onChange={(e) => onUpdate(cell.id, { content: e.target.value })}
                placeholder="Add markdown documentation..."
                className="w-full p-2 bg-transparent focus:outline-none resize-none text-gray-700 font-sans min-h-[40px] resize-y"
              />
            </div>
          )}
        </div>
      </div>

      {/* Add Buttons (Appear on Hover) */}
      <div className="h-6 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity my-1">
        <div className="h-px w-full bg-gray-200 absolute z-0"></div>
        <button 
          onClick={() => onAdd('code', index)}
          className="relative z-10 flex items-center gap-1 bg-white border border-gray-200 text-xs px-2 py-0.5 rounded-full hover:border-blue-400 hover:text-blue-600 shadow-sm transition-colors"
        >
          <Plus size={12} /> Code
        </button>
        <button 
          onClick={() => onAdd('markdown', index)}
          className="relative z-10 flex items-center gap-1 bg-white border border-gray-200 text-xs px-2 py-0.5 rounded-full hover:border-blue-400 hover:text-blue-600 shadow-sm transition-colors"
        >
          <Plus size={12} /> Text
        </button>
        <button 
          onClick={() => onAdd('drawing', index)}
          className="relative z-10 flex items-center gap-1 bg-white border border-gray-200 text-xs px-2 py-0.5 rounded-full hover:border-blue-400 hover:text-blue-600 shadow-sm transition-colors"
        >
          <Plus size={12} /> Draw
        </button>
      </div>
    </div>
  );
};

interface DevEditorProps {
  note: Note;
  onUpdateNote: (updatedNote: Note, saveImmediately?: boolean) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSaved: number;
}

export const DevEditor: React.FC<DevEditorProps> = ({ note, onUpdateNote, saveStatus }) => {
  const [cells, setCells] = useState<Cell[]>(note.cells || []);
  const [executingCellId, setExecutingCellId] = useState<string | null>(null);
  
  // Dev Mode Drawing Toolbar State
  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [activeColor, setActiveColor] = useState('#2563eb');
  const [activeWidth, setActiveWidth] = useState(3);
  
  useEffect(() => {
    if (!note.cells || note.cells.length === 0) {
      const initialCell: Cell = {
        id: Date.now().toString(),
        type: 'code',
        content: `print("Hello World from ${note.language}")`,
        language: note.language?.toLowerCase(),
        isCodeCollapsed: false,
        isOutputCollapsed: false
      };
      const newCells = [initialCell];
      setCells(newCells);
      onUpdateNote({ ...note, cells: newCells });
    } else {
        setCells(note.cells);
    }
  }, [note.id]);

  const updateCells = (newCells: Cell[]) => {
    setCells(newCells);
    onUpdateNote({ ...note, cells: newCells, lastModified: Date.now() });
  };

  const handleCellUpdate = (id: string, updates: Partial<Cell>) => {
      const newCells = cells.map(c => c.id === id ? { ...c, ...updates } : c);
      updateCells(newCells);
  };

  const handleAddCell = (type: 'code' | 'markdown' | 'drawing', index: number) => {
    const newCell: Cell = {
      id: Date.now().toString(),
      type,
      content: '',
      language: type === 'code' ? note.language?.toLowerCase() : undefined,
      isCodeCollapsed: false,
      isOutputCollapsed: false,
      drawData: type === 'drawing' ? { paths: [], height: 400 } : undefined
    };
    const newCells = [...cells];
    newCells.splice(index + 1, 0, newCell);
    updateCells(newCells);
  };

  const handleRemoveCell = (id: string) => {
    const newCells = cells.filter(c => c.id !== id);
    updateCells(newCells);
  };

  const handleRunCell = async (id: string) => {
    const cell = cells.find(c => c.id === id);
    if (!cell) return;

    setExecutingCellId(id);
    handleCellUpdate(id, { isOutputCollapsed: false });
    
    let output = '';
    
    try {
      if (cell.language === 'javascript') {
        const log = [] as string[];
        const originalLog = console.log;
        console.log = (...args) => log.push(args.join(' '));
        
        try {
          // eslint-disable-next-line no-eval
          const result = eval(cell.content);
          output = log.join('\n');
          if (result !== undefined && result !== null) {
              output += (output ? '\n' : '') + `> ${result}`;
          }
          if (!output) output = "Done (No Output)";
        } catch (e: any) {
          output = `ReferenceError: ${e.message}`;
        } finally {
          console.log = originalLog;
        }
        
        handleCellUpdate(id, { output });
      } else {
        const aiOutput = await executeCodeWithAI(note.language || 'python', cell.content);
        handleCellUpdate(id, { output: aiOutput });
      }
    } catch (err) {
      console.error(err);
      handleCellUpdate(id, { output: "Error executing code." });
    } finally {
      setExecutingCellId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden font-mono">
      {/* Dev Toolbar */}
      <div className="h-16 border-b border-gray-200 bg-gray-50 flex items-center justify-between px-4 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Terminal size={18} className="text-gray-500" />
                <input 
                    type="text" 
                    value={note.title}
                    onChange={(e) => onUpdateNote({...note, title: e.target.value})}
                    placeholder="Untitled Notebook"
                    className="bg-transparent font-semibold text-gray-700 focus:outline-none w-48"
                />
            </div>
            
            {/* Drawing Tools for Dev Mode */}
            <div className="h-8 w-px bg-gray-300"></div>
            <DrawingToolbar 
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                activeColor={activeColor}
                setActiveColor={setActiveColor}
                activeWidth={activeWidth}
                setActiveWidth={setActiveWidth}
            />
        </div>
        
        <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-gray-200 rounded text-gray-600 font-bold hidden md:inline-block">
                {note.language}
            </span>
            <span className="text-xs text-gray-400 hidden md:inline-block">
                {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
            </span>
        </div>
      </div>

      {/* Cells Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
        {cells.map((cell, index) => (
            <DevCell 
                key={cell.id}
                cell={cell}
                index={index}
                isExecuting={executingCellId === cell.id}
                onUpdate={handleCellUpdate}
                onRun={handleRunCell}
                onRemove={handleRemoveCell}
                onAdd={handleAddCell}
                language={note.language || 'text'}
                activeTool={activeTool}
                activeColor={activeColor}
                activeWidth={activeWidth}
            />
        ))}
        
        {/* Empty State / End Add */}
        {cells.length === 0 && (
             <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-xl">
                 <button onClick={() => handleAddCell('code', -1)} className="text-blue-600 font-medium">Add Code Cell</button>
             </div>
        )}
        
        <div className="h-20"></div> {/* Bottom spacer */}
      </div>
    </div>
  );
};
