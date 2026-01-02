
import React, { useState, useRef, useEffect } from 'react';

interface EditorProps {
  content: string;
  onChange: (val: string) => void;
  onRewrite: (instruction: string) => void;
  isGenerating: boolean;
}

const Editor: React.FC<EditorProps> = ({ content, onChange, onRewrite, isGenerating }) => {
  const [instruction, setInstruction] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  // Sync content from props if it changes externally (e.g. AI generation)
  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  // Helper to strip HTML for word count
  const getWordCount = (html: string) => {
    const text = html.replace(/<[^>]*>?/gm, ' ');
    return text.split(/\s+/).filter(x => x).length;
  };

  // Fix: Adding "?" to children to satisfy TypeScript prop checks in nested JSX calls
  const ToolbarButton = ({ onClick, children, title }: { onClick: () => void, children?: React.ReactNode, title: string }) => (
    <button 
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className="p-1.5 bg-slate-700 hover:bg-rose-600 rounded text-slate-200 transition-all flex items-center justify-center min-w-[32px]"
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-inner">
      <div className="p-2 bg-slate-800 border-b border-slate-700 flex flex-wrap gap-2 items-center justify-between sticky top-0 z-20">
        <div className="flex flex-wrap gap-1.5">
          <ToolbarButton onClick={() => execCommand('bold')} title="Bold (Ctrl+B)">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('italic')} title="Italic (Ctrl+I)">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('underline')} title="Underline (Ctrl+U)">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('strikeThrough')} title="Strikethrough">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/></svg>
          </ToolbarButton>
          <div className="w-px h-6 bg-slate-700 mx-1"></div>
          <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Bulleted List">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Numbered List">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2l2.8-2.1V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>
          </ToolbarButton>
        </div>
        
        <div className="flex gap-2 items-center">
          <input 
            type="text"
            placeholder="Rewrite instruction (e.g., make it more descriptive...)"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            className="bg-slate-950 border border-slate-600 rounded px-3 py-1.5 text-xs w-48 lg:w-64 focus:outline-none focus:border-rose-500 transition-colors"
          />
          <button 
            onClick={() => onRewrite(instruction)}
            disabled={isGenerating || !instruction}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 rounded text-xs font-bold transition flex items-center gap-2"
          >
            {isGenerating ? (
              <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'AI Rewrite'}
          </button>
        </div>
      </div>
      
      <div
        ref={editorRef}
        contentEditable={true}
        onInput={handleInput}
        onBlur={handleInput}
        className="flex-1 p-8 bg-slate-950 text-slate-200 bengali-text text-xl overflow-y-auto focus:outline-none focus:ring-1 focus:ring-rose-500/20"
        style={{ minHeight: '300px' }}
        data-placeholder="আপনার কাহিনী এখানে শুরু করুন..."
      />
      
      <div className="p-3 bg-slate-800 border-t border-slate-700 text-[10px] text-slate-500 font-mono flex justify-between uppercase tracking-widest">
        <span>Words: <span className="text-rose-500 font-bold">{getWordCount(content)}</span></span>
        <span>Rich Text Enabled | Bengali Optimized</span>
      </div>
      
      <style>{`
        [contentEditable]:empty:before {
          content: attr(data-placeholder);
          color: #475569;
          cursor: text;
        }
        [contentEditable] ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 1rem 0;
        }
        [contentEditable] ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 1rem 0;
        }
        [contentEditable] b, [contentEditable] strong {
          color: #f1f5f9;
        }
      `}</style>
    </div>
  );
};

export default Editor;
