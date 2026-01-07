
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateSpeech } from '../services/geminiService';

interface EditorProps {
  content: string;
  onChange: (val: string) => void;
  onRewrite: (instruction: string) => void;
  isGenerating: boolean;
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const Editor: React.FC<EditorProps> = ({ content, onChange, onRewrite, isGenerating }) => {
  const [instruction, setInstruction] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // History state for Undo/Redo
  const [history, setHistory] = useState<string[]>([content]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isInternalChange = useRef(false);

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'bn-BD';
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
        }
        if (transcript && editorRef.current) {
          editorRef.current.focus();
          document.execCommand('insertText', false, transcript + ' ');
          handleInput();
        }
      };

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      
      recognitionRef.current = recognition;
    }
  }, [SpeechRecognition]);

  // Update editor content when external content changes (unless it's an undo/redo)
  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.innerHTML && !isInternalChange.current) {
      editorRef.current.innerHTML = content;
      // Reset history if it's a completely new content load (e.g. switching chapters)
      if (history.length === 0 || history[0] !== content) {
        setHistory([content]);
        setHistoryIndex(0);
      }
    }
    isInternalChange.current = false;
  }, [content]);

  const addToHistory = useCallback((newContent: string) => {
    if (newContent === history[historyIndex]) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newContent);
    // Keep last 50 states
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleInput = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      onChange(newContent);
      addToHistory(newContent);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevContent = history[prevIndex];
      setHistoryIndex(prevIndex);
      isInternalChange.current = true;
      if (editorRef.current) editorRef.current.innerHTML = prevContent;
      onChange(prevContent);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextContent = history[nextIndex];
      setHistoryIndex(nextIndex);
      isInternalChange.current = true;
      if (editorRef.current) editorRef.current.innerHTML = nextContent;
      onChange(nextContent);
    }
  };

  const execCommand = (command: string, value: string = '') => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(command, false, value);
      handleInput();
    }
  };

  const getWordCount = (html: string) => {
    const text = html.replace(/<[^>]*>?/gm, ' ').replace(/&nbsp;/g, ' ');
    return text.trim().split(/\s+/).filter(x => x).length;
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('আপনার ব্রাউজারে স্পিচ রিকগনিশন সাপোর্ট করে না।');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Recognition start error:", e);
      }
    }
  };

  const handleListen = async () => {
    if (isPlaying) {
      if (currentSourceRef.current) {
        currentSourceRef.current.stop();
      }
      setIsPlaying(false);
      return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const plainText = tempDiv.innerText || tempDiv.textContent || "";
    
    if (!plainText.trim()) return;

    try {
      setIsPlaying(true);
      const base64Audio = await generateSpeech(plainText);
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();
        
        const bytes = decode(base64Audio);
        const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => setIsPlaying(false);
        source.start();
        currentSourceRef.current = source;
      } else {
        setIsPlaying(false);
      }
    } catch (e) {
      console.error("Playback error:", e);
      setIsPlaying(false);
      alert('প্লেব্যাক ত্রুটি।');
    }
  };

  const onRewriteClick = () => {
    if (!instruction.trim() || isGenerating) return;
    onRewrite(instruction);
    setInstruction('');
  };

  // Keyboard Shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      redo();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl relative transition-all duration-300" onKeyDown={handleKeyDown}>
      {/* Top Bar: Input + Core Actions */}
      <div className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700 p-2 lg:px-4 flex items-center gap-2 z-30">
        <div className="flex-1 min-w-0">
          <input 
            type="text" 
            placeholder="রিরাইট নির্দেশ দিন..." 
            value={instruction} 
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onRewriteClick()} 
            aria-label="AI রিরাইট নির্দেশনা"
            className="w-full bg-slate-950/50 border border-slate-600/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-rose-500 text-slate-100 placeholder:text-slate-500 transition-all shadow-inner" 
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={onRewriteClick} 
            disabled={isGenerating || !instruction.trim()} 
            aria-label="AI রিরাইট শুরু করুন"
            className="hidden sm:flex px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 rounded-xl text-xs font-black transition items-center gap-2 text-white shadow-lg whitespace-nowrap"
          >
            Rewrite
          </button>
          <button 
            onClick={toggleListening} 
            aria-label={isListening ? "ভয়েস টাইপিং বন্ধ করুন" : "ভয়েস টাইপিং শুরু করুন"}
            className={`p-2 rounded-xl transition-all ${isListening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`} 
            title="ভয়েস ইনপুট"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          </button>
          <button 
            onClick={handleListen} 
            aria-label={isPlaying ? "প্লেব্যাক বন্ধ করুন" : "কাহিনী শুনুন (TTS)"}
            className={`p-2 rounded-xl transition-all ${isPlaying ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`} 
            title="প্লেব্যাক"
          >
            {isPlaying ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg> : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>}
          </button>
        </div>
      </div>

      {/* Formatting Toolbar: Responsive Scrollable Container */}
      <div className="bg-slate-800/40 border-b border-slate-700/50 p-1 lg:p-1.5 flex gap-2 overflow-x-auto custom-scrollbar whitespace-nowrap scroll-smooth z-20" role="toolbar" aria-label="টেক্সট ফরম্যাটিং টুলবার">
        {/* Undo / Redo */}
        <div className="flex items-center gap-1 bg-slate-950/20 p-1 rounded-xl shrink-0">
          <button onClick={undo} disabled={historyIndex === 0} aria-label="পূর্বাবস্থায় ফিরে যান (Undo)" className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-300 transition-colors" title="Undo">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
          </button>
          <button onClick={redo} disabled={historyIndex === history.length - 1} aria-label="পুনরায় করুন (Redo)" className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-300 transition-colors" title="Redo">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" /></svg>
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-950/20 p-1 rounded-xl shrink-0">
          <button onClick={() => execCommand('bold')} aria-label="বোল্ড" className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 font-bold transition-colors" title="Bold">B</button>
          <button onClick={() => execCommand('italic')} aria-label="ইটালিক" className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 italic font-serif transition-colors" title="Italic">I</button>
          <button onClick={() => execCommand('underline')} aria-label="আন্ডারলাইন" className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 underline transition-colors" title="Underline">U</button>
        </div>

        <div className="flex items-center gap-1 bg-slate-950/20 p-1 rounded-xl shrink-0">
          <button onClick={() => execCommand('justifyLeft')} aria-label="বামে সাজান" className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Left">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg>
          </button>
          <button onClick={() => execCommand('justifyCenter')} aria-label="মাঝখানে সাজান" className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" /></svg>
          </button>
          <button onClick={() => execCommand('justifyRight')} aria-label="ডানে সাজান" className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Right">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" /></svg>
          </button>
          <button onClick={() => execCommand('justifyFull')} aria-label="পুরো লাইন জুড়ে সাজান" className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-950/20 p-1 rounded-xl shrink-0 pr-2">
          <span className="text-[9px] font-black uppercase text-slate-500 px-2 tracking-tighter" aria-hidden="true">Size</span>
          <select 
            onChange={(e) => execCommand('fontSize', e.target.value)} 
            aria-label="ফন্ট সাইজ পরিবর্তন করুন"
            className="bg-slate-800 text-[10px] font-bold text-slate-300 px-2 py-1 rounded-lg outline-none focus:ring-1 focus:ring-rose-500 border-none cursor-pointer"
            defaultValue="4"
          >
            {[1,2,3,4,5,6,7].map(s => <option key={s} value={s.toString()}>{s}</option>)}
          </select>
        </div>

        <button 
          onClick={() => execCommand('insertUnorderedList')} 
          aria-label="বুলেট পয়েন্ট লিস্ট"
          className="px-3 h-8 flex items-center justify-center hover:bg-slate-700 bg-slate-950/20 rounded-xl text-slate-300 text-[10px] font-bold transition-colors shrink-0"
        >
          • List
        </button>
      </div>
      
      {/* Editor Surface */}
      <div className="relative flex-1 overflow-hidden group">
        <div 
          ref={editorRef} 
          contentEditable={true} 
          onInput={handleInput} 
          onBlur={handleInput} 
          role="textbox"
          aria-multiline="true"
          aria-label="কাহিনী রাইটিং এরিয়া"
          className="h-full p-6 lg:p-12 bg-slate-950 text-slate-200 bengali-text text-lg lg:text-xl overflow-y-auto focus:outline-none selection:bg-rose-500/40 custom-scrollbar" 
          style={{ minHeight: '400px' }} 
          data-placeholder="আপনার উপন্যাসের বর্ণনা এখানে শুরু করুন..." 
        />
        {isGenerating && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10" aria-live="polite">
            <div className="bg-rose-600/10 px-6 py-3 rounded-full border border-rose-500/30 text-rose-400 font-bold text-sm flex items-center gap-3 animate-pulse">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              AI কাজ করছে...
            </div>
          </div>
        )}
      </div>
      
      {/* Word Count Footer */}
      <div className="p-2 lg:p-3 bg-slate-800/50 border-t border-slate-700 flex justify-between items-center px-6 lg:px-8 z-10 no-print" aria-label="এডিটর স্ট্যাটাস">
        <span className="text-[9px] lg:text-[10px] text-slate-500 font-bold uppercase tracking-widest">শব্দ সংখ্যা: <span className="text-rose-500 font-black" aria-live="polite">{getWordCount(content)}</span></span>
        <span className="hidden sm:inline text-[8px] lg:text-[9px] text-slate-600 uppercase font-black tracking-widest">Premium Fiction Suite v5.4</span>
      </div>
    </div>
  );
};

export default Editor;
