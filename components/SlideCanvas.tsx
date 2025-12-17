import React, { useRef, useEffect, useState } from 'react';
import { Slide, DrawingPath, Point } from '../types';
import { Trash2, Sparkles, Loader2, Maximize2, Minimize2, ArrowUp, ArrowDown } from 'lucide-react';
import { convertSlideToNotes } from '../services/geminiService';

interface SlideCanvasProps {
  slide: Slide;
  activeTool: 'pen' | 'highlighter' | 'eraser';
  activeColor: string;
  activeWidth: number;
  onUpdateSlide: (updatedSlide: Slide) => void;
  onDeleteSlide: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  readOnly?: boolean;
  onClick?: () => void;
}

// Helper to calculate distance from point p to line segment vw
const distanceToSegment = (p: Point, v: Point, w: Point) => {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
};

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  activeTool,
  activeColor,
  activeWidth,
  onUpdateSlide,
  onDeleteSlide,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  readOnly = false,
  onClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const hexToRgba = (hex: string, alpha: number) => {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})` : hex;
  };

  // Initial Draw
  useEffect(() => {
    drawCanvas();
  }, [slide.paths, slide.imageData, slide.width, slide.height]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw White Background if no image
    if (!slide.imageData) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw all paths
    slide.paths.forEach(path => {
      if (path.points.length < 2) return;
      
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = path.width;

      if (path.type === 'highlighter') {
        ctx.strokeStyle = hexToRgba(path.color, 0.4); // 40% opacity for highlighter
        ctx.globalCompositeOperation = 'multiply'; // Better highlighting effect
      } else if (path.type === 'eraser') {
        ctx.strokeStyle = '#ffffff'; // Fallback visual
        ctx.lineWidth = path.width * 2;
        ctx.globalCompositeOperation = 'destination-out'; // This effectively "erases" on transparent canvas
      } else {
        ctx.strokeStyle = path.color;
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; // Reset
    });
  };

  const getPoint = (e: React.PointerEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const eraseStrokeAt = (p: Point) => {
    const eraserRadius = 10; 
    
    const pathsToKeep = slide.paths.filter(path => {
      // 1. Quick Bounding Box Check
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pt of path.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
      
      if (p.x < minX - eraserRadius || p.x > maxX + eraserRadius || 
          p.y < minY - eraserRadius || p.y > maxY + eraserRadius) {
        return true; 
      }

      // 2. Detailed Segment Check
      for (let i = 0; i < path.points.length - 1; i++) {
        const dist = distanceToSegment(p, path.points[i], path.points[i+1]);
        if (dist <= eraserRadius + (path.width / 2)) {
          return false; 
        }
      }
      return true; 
    });

    if (pathsToKeep.length !== slide.paths.length) {
      onUpdateSlide({
        ...slide,
        paths: pathsToKeep
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    e.preventDefault(); 
    setIsDrawing(true);
    const point = getPoint(e);
    
    if (activeTool === 'eraser') {
      eraseStrokeAt(point);
    } else {
      setCurrentPath([point]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || readOnly) return;
    e.preventDefault();
    const point = getPoint(e);

    if (activeTool === 'eraser') {
      eraseStrokeAt(point);
      return;
    }

    // Drawing logic
    setCurrentPath(prev => [...prev, point]);

    // Live render current stroke
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && currentPath.length > 0) {
       ctx.beginPath();
       const lastPoint = currentPath[currentPath.length - 1];
       ctx.moveTo(lastPoint.x, lastPoint.y);
       ctx.lineTo(point.x, point.y);
       
       ctx.lineCap = 'round';
       ctx.lineJoin = 'round';
       ctx.lineWidth = activeWidth;

       if (activeTool === 'highlighter') {
          ctx.strokeStyle = hexToRgba(activeColor, 0.4);
          ctx.globalCompositeOperation = 'multiply';
       } else {
          ctx.strokeStyle = activeColor;
          ctx.globalCompositeOperation = 'source-over';
       }
       ctx.stroke();
       ctx.globalCompositeOperation = 'source-over';
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || readOnly) return;
    setIsDrawing(false);

    if (activeTool === 'eraser') {
      return;
    }

    // Save new path
    if (currentPath.length > 1) {
      let finalPoints = currentPath;

      // --- SMART HIGHLIGHTER LOGIC ---
      if (activeTool === 'highlighter') {
          const start = currentPath[0];
          const end = currentPath[currentPath.length - 1];
          const deltaX = Math.abs(end.x - start.x);
          const deltaY = Math.abs(end.y - start.y);

          // If the highlight is mostly horizontal (width > 2x height) and longer than 20px
          if (deltaX > 20 && deltaX > deltaY * 2) {
              // Calculate average Y to snap to a text line
              const avgY = currentPath.reduce((sum, p) => sum + p.y, 0) / currentPath.length;
              
              // Create a straight line from min X to max X at the average Y level
              const minX = Math.min(start.x, end.x);
              const maxX = Math.max(start.x, end.x);

              finalPoints = [
                  { x: minX, y: avgY },
                  { x: maxX, y: avgY }
              ];
          }
      }
      // -------------------------------

      const newPath: DrawingPath = {
        points: finalPoints,
        color: activeColor,
        width: activeWidth,
        type: activeTool === 'highlighter' ? 'highlighter' : 'pen'
      };
      
      const updatedPaths = [...slide.paths, newPath];
      onUpdateSlide({
        ...slide,
        paths: updatedPaths
      });
    }
    setCurrentPath([]);
  };

  const handleSummarize = async () => {
    if (!slide.imageData) return;
    setIsAnalyzing(true);
    try {
        const base64Clean = slide.imageData.includes(',') ? slide.imageData.split(',')[1] : slide.imageData;
        const summary = await convertSlideToNotes(base64Clean, 'image/png');
        
        onUpdateSlide({
            ...slide,
            summary: summary
        });
    } catch (e) {
        alert("Failed to analyze slide.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const toggleSize = () => {
      const newHeight = slide.height > 600 ? 400 : 800;
      onUpdateSlide({ ...slide, height: newHeight });
  };

  return (
    <div 
        onClick={onClick}
        className={`relative group bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 ${readOnly ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all' : 'mb-8'}`}
    >
      {!readOnly && (
      <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase px-2">
                {slide.imageData ? 'Slide / Image' : 'Page'}
            </span>
            {/* Move Controls */}
            {onMoveUp && onMoveDown && (
                <div className="flex items-center border-l border-gray-200 pl-2 gap-1">
                    <button onClick={onMoveUp} disabled={isFirst} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp size={14}/></button>
                    <button onClick={onMoveDown} disabled={isLast} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown size={14}/></button>
                </div>
            )}
        </div>
        <div className="flex gap-2">
           {!slide.imageData && (
               <button 
                onClick={toggleSize}
                className="text-gray-400 hover:text-blue-500 p-1 hover:bg-blue-50 rounded"
                title="Toggle Height"
               >
                 {slide.height > 600 ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
               </button>
           )}
           {slide.imageData && (
               <button 
                onClick={handleSummarize}
                disabled={isAnalyzing}
                className="text-xs flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
               >
                 {isAnalyzing ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                 {isAnalyzing ? 'Analyzing...' : 'AI Summary'}
               </button>
           )}
           <button 
             onClick={onDeleteSlide}
             className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded"
           >
             <Trash2 size={14} />
           </button>
        </div>
      </div>
      )}

      <div className="relative bg-white" ref={containerRef}>
        {slide.imageData && (
            <img 
            src={slide.imageData} 
            alt="Slide" 
            className="w-full h-auto pointer-events-none select-none block"
            style={{ minHeight: readOnly ? 'auto' : '200px' }}
            />
        )}
        <canvas
          ref={canvasRef}
          width={slide.width}
          height={slide.height}
          className={`absolute inset-0 w-full h-full ${!readOnly ? 'touch-none cursor-crosshair' : ''} ${!slide.imageData ? 'bg-white' : ''}`}
          style={!slide.imageData ? { position: 'relative', height: slide.height } : {}}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {!readOnly && slide.summary && (
        <div className="p-4 bg-blue-50/50 border-t border-blue-100 text-sm text-gray-700">
          <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Sparkles size={14} /> AI Analysis
          </h4>
          <div className="prose prose-sm max-w-none">
             {slide.summary.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
          </div>
        </div>
      )}
    </div>
  );
};