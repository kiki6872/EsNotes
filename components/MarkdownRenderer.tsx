import React from 'react';

interface MarkdownRendererProps {
  children: string | null | undefined;
}

// Helper to handle bold (**text**) and inline code (`code`)
const processInline = (text: string): React.ReactNode => {
  if (!text) return null;
  
  // Regex to match **bold** or `code`
  // We use new RegExp to avoid potential parsing issues with backtick literals in some environments
  const regex = new RegExp(/(\*\*.*?\*\*|`.*?`)/g);
  
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-xs font-mono border border-gray-200">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ children }) => {
  // Safe check to ensure we always work with a string
  const contentStr = typeof children === 'string' ? children : '';
  if (!contentStr) return null;

  // Split by Code Blocks (``` ... ```)
  // Regex: ``` followed by any character (including newlines via [\s\S]) until ```
  const codeBlockRegex = new RegExp(/(```[\s\S]*?```)/g);
  const parts = contentStr.split(codeBlockRegex);

  return (
    <div className="text-sm leading-relaxed text-gray-700">
      {parts.map((part, index) => {
        // Handle Code Blocks
        if (part.startsWith('```') && part.endsWith('```')) {
          // Remove the first line (language identifier) and the backticks
          const codeContent = part.slice(3, -3).replace(/^.*\n/, ''); 
          return (
            <div key={index} className="my-3 rounded-lg overflow-hidden bg-[#1e1e1e] border border-gray-800 shadow-sm max-w-full group relative">
              <div className="w-full overflow-x-auto p-3 custom-scrollbar">
                <pre className="font-mono text-xs text-gray-200 whitespace-pre">{codeContent.trim()}</pre>
              </div>
            </div>
          );
        }

        // Handle Regular Text (split by newlines for formatting)
        const lines = part.split(/\n/g);
        return (
          <div key={index}>
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lineIdx} className="h-2" />; // Spacer for empty lines

              // Headers
              if (line.startsWith('### ')) return <h3 key={lineIdx} className="font-bold text-gray-900 mt-3 mb-1 uppercase text-xs">{processInline(line.slice(4))}</h3>;
              if (line.startsWith('## ')) return <h2 key={lineIdx} className="font-bold text-gray-900 mt-4 mb-2 text-sm">{processInline(line.slice(3))}</h2>;
              if (line.startsWith('# ')) return <h1 key={lineIdx} className="font-bold text-gray-900 mt-5 mb-3 text-base">{processInline(line.slice(2))}</h1>;

              // Unordered Lists
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lineIdx} className="flex gap-2 ml-2 mb-1">
                    <span className="text-gray-400 mt-1.5">•</span>
                    <span>{processInline(trimmed.slice(2))}</span>
                  </div>
                );
              }
              
              // Ordered Lists
              if (/^\d+\.\s/.test(trimmed)) {
                 const match = trimmed.match(/^\d+\./);
                 const number = match ? match[0] : '1.';
                 const text = trimmed.replace(/^\d+\.\s/, '');
                 return (
                  <div key={lineIdx} className="flex gap-2 ml-2 mb-1">
                    <span className="text-gray-500 font-mono text-xs mt-0.5 min-w-[1.2rem]">{number}</span>
                     <span>{processInline(text)}</span>
                  </div>
                 )
              }

              // Blockquotes
              if (trimmed.startsWith('> ')) {
                  return (
                      <blockquote key={lineIdx} className="border-l-4 border-gray-300 pl-3 italic text-gray-500 my-2">
                          {processInline(trimmed.slice(2))}
                      </blockquote>
                  )
              }

              // Regular Paragraph
              return <p key={lineIdx} className="mb-1">{processInline(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
};
