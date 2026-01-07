
import React, { useState, useRef, useEffect } from 'react';
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
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

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
        if (transcript) {
          document.execCommand('insertText', false, transcript + ' ');
          if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
          }
        }
      };

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      
      recognitionRef.current = recognition;
    }
  }, [SpeechRecognition, onChange]);

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
    if (editorRef.current) editorRef.current.focus();
    handleInput();
  };

  const getWordCount = (html: string) => {
    const text = html.replace(/<[^>]*>?/gm, ' ').replace(/&nbsp;/g, ' ');
    return text.trim().split(/\s+/).filter(x => x).length;
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return alert('Your browser does not support Bengali Speech Recognition.');
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Recognition already started");
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
      alert('প্লেব্যাক ত্রুটি। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
  };

  const onRewriteClick = () => {
    if (!instruction.trim() || isGenerating) return;
    onRewrite(instruction);
    setInstruction('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl relative transition-all duration-300">
      <div className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700 flex flex-col sticky top-0 z-20 transition-all duration-300">
        
        <div className="flex items-center justify-between p-2 lg:px-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
              className="lg:hidden p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
            >
              <svg className={`w-5 h-5 transition-transform ${isToolbarExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <div className="flex gap-1.5">
              <button onClick={toggleListening} className={`p-2 rounded-lg transition-all ${isListening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`} title="ভয়েস ইনপুট">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
              </button>
              <button onClick={handleListen} className={`p-2 rounded-lg transition-all ${isPlaying ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`} title="প্লেব্যাক">
                {isPlaying ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg> : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>}
              </button>
            </div>
          </div>

          <div className="flex-1 max-w-lg mx-4 hidden lg:flex gap-2">
            <input 
              type="text" 
              placeholder="রিরাইট নির্দেশ দিন..." 
              value={instruction} 
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isGenerating && onRewriteClick()} 
              className="bg-slate-950/50 border border-slate-600/50 rounded-xl px-4 py-2 text-xs w-full focus:outline-none focus:border-rose-500 text-slate-100 placeholder:text-slate-500 transition-all shadow-inner" 
            />
            <button 
              onClick={onRewriteClick} 
              disabled={isGenerating || !instruction.trim()} 
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 rounded-xl text-xs font-black transition flex items-center gap-2 text-white shadow-lg whitespace-nowrap uppercase tracking-widest"
            >
              Rewrite
            </button>
          </div>

          <div className="hidden lg:block text-[10px] text-slate-500 font-bold uppercase tracking-widest whitespace-nowrap">
            Words: <span className="text-rose-500">{getWordCount(content)}</span>
          </div>
        </div>

        <div className={`${isToolbarExpanded ? 'max-h-[500px]' : 'max-h-0 lg:max-h-[100px]'} overflow-hidden transition-all duration-300 ease-in-out`}>
          <div className="p-2 lg:px-4 lg:pb-3 flex flex-col gap-3 border-t border-slate-700/50 lg:border-t-0">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-1 bg-slate-950/30 p-1 rounded-xl">
                <button onClick={() => execCommand('bold')} className="w-9 h-9 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors font-bold" title="Bold">B</button>
                <button onClick={() => execCommand('italic')} className="w-9 h-9 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors italic font-serif" title="Italic">I</button>
                <button onClick={() => execCommand('underline')} className="w-9 h-9 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors underline" title="Underline">U</button>
              </div>

              <div className="flex gap-1 bg-slate-950/30 p-1 rounded-xl">
                <button onClick={() => execCommand('justifyLeft')} className="w-9 h-9 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Left Align">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg>
                </button>
                <button onClick={() => execCommand('justifyCenter')} className="w-9 h-9 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Center Align">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" /></svg>
                </button>
                <button onClick={() => execCommand('justifyRight')} className="w-9 h-9 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Right Align">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" /></svg>
                </button>
                <button onClick={() => execCommand('justifyFull')} className="w-9 h-9 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 transition-colors" title="Justify">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
              </div>

              <div className="flex gap-2 items-center">
                <div className="flex items-center bg-slate-950/30 p-1 rounded-xl gap-1">
                  <span className="text-[10px] font-black uppercase text-slate-500 px-2">Size</span>
                  <select 
                    onChange={(e) => execCommand('fontSize', e.target.value)} 
                    className="bg-slate-800 text-[10px] font-bold text-slate-300 px-2 py-1 rounded-lg outline-none focus:ring-1 focus:ring-rose-500"
                    defaultValue="4"
                  >
                    <option value="1">XS</option>
                    <option value="2">S</option>
                    <option value="3">M</option>
                    <option value="4">L</option>
                    <option value="5">XL</option>
                    <option value="6">2XL</option>
                    <option value="7">3XL</option>
                  </select>
                </div>
                <button onClick={() => execCommand('insertUnorderedList')} className="px-3 h-9 bg-slate-950/30 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors text-xs font-bold flex items-center gap-2">• List</button>
              </div>
            </div>
            
            <div className="lg:hidden flex gap-2 w-full pt-1">
              <input 
                type="text" 
                placeholder="রিরাইট নির্দেশ..." 
                value={instruction} 
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isGenerating && onRewriteClick()} 
                className="bg-slate-950/50 border border-slate-600/50 rounded-xl px-4 py-2.5 text-xs flex-1 focus:outline-none focus:border-rose-500 text-slate-100 placeholder:text-slate-500" 
              />
              <button 
                onClick={onRewriteClick} 
                disabled={isGenerating || !instruction.trim()} 
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 rounded-xl text-xs font-black text-white shadow-lg shadow-rose-900/40"
              >
                Rewrite
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="relative flex-1 overflow-hidden group">
        <div 
          ref={editorRef} 
          contentEditable={true} 
          onInput={handleInput} 
          onBlur={handleInput} 
          className="h-full p-6 lg:p-12 bg-slate-950 text-slate-200 bengali-text text-lg lg:text-xl overflow-y-auto focus:outline-none selection:bg-rose-500/40 custom-scrollbar" 
          style={{ minHeight: '400px' }} 
          data-placeholder="আপনার উপন্যাসের বর্ণনা এখানে শুরু করুন..." 
        />
        {isGenerating && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10">
            <div className="bg-rose-600/10 px-6 py-3 rounded-full border border-rose-500/30 text-rose-400 font-bold text-sm flex items-center gap-3 animate-pulse">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              AI কাজ করছে...
            </div>
          </div>
        )}
      </div>
      
      <div className="p-2 lg:p-3 bg-slate-800/50 border-t border-slate-700 flex justify-between items-center px-6 lg:px-8 z-10 no-print">
        <span className="text-[9px] lg:text-[10px] text-slate-500 font-bold uppercase tracking-widest">শব্দ সংখ্যা: <span className="text-rose-500 font-black">{getWordCount(content)}</span></span>
        <span className="hidden sm:inline text-[8px] lg:text-[9px] text-slate-600 uppercase font-black tracking-widest">Premium Fiction Suite v4.8</span>
      </div>
    </div>
  );
};

export default Editor;
