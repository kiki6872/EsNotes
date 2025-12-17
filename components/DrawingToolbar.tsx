import React from 'react';
import { Pen, Highlighter, Eraser } from 'lucide-react';

interface DrawingToolbarProps {
  activeTool: 'pen' | 'highlighter' | 'eraser';
  setActiveTool: (tool: 'pen' | 'highlighter' | 'eraser') => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  activeWidth: number;
  setActiveWidth: (width: number) => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  activeWidth,
  setActiveWidth
}) => {
  return (
    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg shrink-0">
      <button 
        onClick={() => { setActiveTool('pen'); if(activeWidth > 10) setActiveWidth(3); }}
        className={`p-2 rounded-md transition-colors ${activeTool === 'pen' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
        title="Pen"
      >
        <Pen size={18} />
      </button>
      <button 
        onClick={() => { setActiveTool('highlighter'); if(activeWidth < 10) setActiveWidth(12); }}
        className={`p-2 rounded-md transition-colors ${activeTool === 'highlighter' ? 'bg-white shadow text-yellow-600' : 'text-gray-500 hover:text-gray-900'}`}
        title="Highlighter"
      >
        <Highlighter size={18} />
      </button>
      <button 
        onClick={() => setActiveTool('eraser')}
        className={`p-2 rounded-md transition-colors ${activeTool === 'eraser' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
        title="Eraser"
      >
        <Eraser size={18} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* Stroke Width Slider */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex items-center gap-2">
            <div 
                className="rounded-full bg-gray-800"
                style={{ width: Math.max(2, Math.min(activeWidth, 8)), height: Math.max(2, Math.min(activeWidth, 8)) }}
            ></div>
            <input 
                type="range" 
                min="1" 
                max="30" 
                value={activeWidth} 
                onChange={(e) => setActiveWidth(parseInt(e.target.value))}
                className="w-20 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700"
                title={`Stroke width: ${activeWidth}px`}
            />
            <div 
                className="rounded-full bg-gray-800"
                style={{ width: Math.min(activeWidth, 16), height: Math.min(activeWidth, 16) }}
            ></div>
        </div>
        <span className="text-xs font-mono text-gray-500 w-5 text-right">{activeWidth}</span>
      </div>

      <div className="w-px h-6 bg-gray-300 mx-1"></div>

      {/* Color Picker */}
      <div className="flex gap-1 items-center">
        {['#000000', '#2563eb', '#dc2626', '#16a34a', '#eab308'].map(color => (
          <button
            key={color}
            onClick={() => { setActiveColor(color); if(activeTool === 'eraser') setActiveTool('pen'); }}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${activeColor === color && activeTool !== 'eraser' ? 'border-gray-900 transform scale-110' : 'border-transparent hover:scale-110'}`}
            style={{ backgroundColor: color }}
          />
        ))}
        
        {/* Custom Color Input */}
        <label className={`w-6 h-6 rounded-full border-2 cursor-pointer relative overflow-hidden flex items-center justify-center ml-1 transition-transform hover:scale-110 ${!['#000000', '#2563eb', '#dc2626', '#16a34a', '#eab308'].includes(activeColor) && activeTool !== 'eraser' ? 'border-gray-900 scale-110' : 'border-transparent'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"></div>
          <input 
            type="color" 
            value={activeColor}
            onChange={(e) => { 
              setActiveColor(e.target.value); 
              if(activeTool === 'eraser') setActiveTool('pen'); 
            }}
            className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
          />
        </label>
      </div>
    </div>
  );
};