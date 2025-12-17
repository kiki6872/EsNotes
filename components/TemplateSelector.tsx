import React, { useState } from 'react';
import { NoteTemplate } from '../types';
import { FileText, Terminal, Check } from 'lucide-react';

interface TemplateSelectorProps {
  onSelect: (templateId: NoteTemplate, language?: string) => void;
  onCancel: () => void;
}

const SUPPORTED_LANGUAGES = [
  "JavaScript", "TypeScript", "HTML", "CSS", "PHP", "Ruby", "Dart",
  "Python", "Java", "C#", "Go", "Visual Basic .NET",
  "C", "C++", "Rust", "Assembly",
  "Swift", "Kotlin", "Objective-C",
  "R", "Julia", "MATLAB", "SQL",
  "Shell", "Perl", "Lua", "PowerShell",
  "Scala", "Haskell", "Elixir"
];

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({ onSelect, onCancel }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplate | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Python');

  const templates = [
    {
      id: 'tpl_standard',
      name: 'Standard Note',
      description: 'Classic rich text editor with vector drawing tools.',
      icon: <FileText size={32} />,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      id: 'tpl_developer',
      name: 'Dev / Jupyter Lab',
      description: 'Code execution cells, syntax highlighting, and terminal.',
      icon: <Terminal size={32} />,
      color: 'bg-slate-100 text-slate-700'
    }
  ];

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate as NoteTemplate, selectedTemplate === 'tpl_developer' ? selectedLanguage : undefined);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Note</h2>
        <p className="text-gray-500 mb-8">Select a template to configure your workspace.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => setSelectedTemplate(tpl.id as NoteTemplate)}
              className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
                selectedTemplate === tpl.id
                  ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
              }`}
            >
              {selectedTemplate === tpl.id && (
                <div className="absolute top-4 right-4 bg-blue-500 text-white rounded-full p-1">
                  <Check size={14} strokeWidth={3} />
                </div>
              )}
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${tpl.color}`}>
                {tpl.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{tpl.name}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{tpl.description}</p>
            </button>
          ))}
        </div>

        {selectedTemplate === 'tpl_developer' && (
          <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Terminal size={18} />
              Select Kernel / Language
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {SUPPORTED_LANGUAGES.map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-all text-left ${
                    selectedLanguage === lang 
                    ? 'bg-slate-800 text-white border-slate-800' 
                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button 
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!selectedTemplate}
            className="px-8 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition-all"
          >
            Create Note
          </button>
        </div>
      </div>
    </div>
  );
};