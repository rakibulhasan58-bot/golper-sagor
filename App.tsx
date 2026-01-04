
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StoryProject, 
  StoryChapter, 
  StoryGenre, 
  GenerationSettings, 
  MaturityLevel, 
  LanguageStyle, 
  ChapterLength 
} from './types';
import { generateStoryChapter, rewriteContent } from './services/geminiService';
import Editor from './components/Editor';

const STORAGE_KEY = 'galposagor_v4_premium_storage';

const DEFAULT_SETTINGS: GenerationSettings = {
  creativity: 0.9,
  length: 'Long',
  tone: 'Passionate and Descriptive',
  customSystemPrompt: ''
};

const App: React.FC = () => {
  const [savedProjects, setSavedProjects] = useState<StoryProject[]>([]);
  const [activeProject, setActiveProject] = useState<StoryProject | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<{msg: string, type: 'error' | 'success'} | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [showChapterSettings, setShowChapterSettings] = useState(false);
  
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoryProject[];
        setSavedProjects(parsed);
      } catch (e) { console.error("Restore Error:", e); }
    }
  }, []);

  const handleSaveProject = useCallback((isAuto = false) => {
    if (!activeProject) return;
    setSaveStatus('saving');
    
    setSavedProjects(prev => {
      const idx = prev.findIndex(p => p.id === activeProject.id);
      let updated: StoryProject[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = { ...activeProject };
      } else {
        updated = [activeProject, ...prev];
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      lastSavedRef.current = JSON.stringify(activeProject);
      
      setLastSavedTime(new Date().toLocaleTimeString('bn-BD'));
      setSaveStatus('saved');
      
      if (!isAuto) {
        setError({ msg: "সফলভাবে সংরক্ষিত!", type: 'success' });
        setTimeout(() => setError(null), 3000);
      }
      
      setTimeout(() => setSaveStatus('idle'), 3000);
      return updated;
    });
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) return;
    const current = JSON.stringify(activeProject);
    if (current === lastSavedRef.current) return;
    
    setSaveStatus('unsaved');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => handleSaveProject(true), 5000);
    
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [activeProject, handleSaveProject]);

  const createNewProject = () => {
    const newProject: StoryProject = {
      id: Date.now().toString(),
      title: 'নতুন অ্যাডাল্ট উপন্যাস',
      description: '',
      genre: 'Adult/Erotica',
      maturityLevel: '18+ Explicit',
      languageStyle: 'Modern/Colloquial',
      settings: { ...DEFAULT_SETTINGS },
      createdAt: Date.now(),
      chapters: [{ id: Date.now().toString(), title: 'পরিচ্ছেদ ১', content: '' }]
    };
    setActiveProject(newProject);
    setActiveChapterIndex(0);
    setLastSavedTime(null);
    lastSavedRef.current = JSON.stringify(newProject);
  };

  const loadProject = (project: StoryProject) => {
    setActiveProject(project);
    setActiveChapterIndex(0);
    setLastSavedTime(null);
    lastSavedRef.current = JSON.stringify(project);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই কাহিনীটি মুছে ফেলতে চান?")) return;
    const updated = savedProjects.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavedProjects(updated);
    if (activeProject?.id === id) setActiveProject(null);
  };

  const handleGenerate = async () => {
    if (!activeProject || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    
    const currentChapter = activeProject.chapters[activeChapterIndex];
    
    // Resolve settings: Chapter Overrides > Project Defaults
    const genre = currentChapter.genre || activeProject.genre;
    const settings = currentChapter.settings || activeProject.settings;
    const maturity = currentChapter.maturityLevel || activeProject.maturityLevel;
    const language = currentChapter.languageStyle || activeProject.languageStyle;

    try {
      const result = await generateStoryChapter(
        activeProject.title,
        currentChapter.title,
        activeProject.description,
        genre,
        settings,
        maturity,
        language,
        activeChapterIndex > 0 ? activeProject.chapters[activeChapterIndex - 1].content.slice(0, 2000) : undefined
      );
      if (result) {
        const chs = [...activeProject.chapters];
        chs[activeChapterIndex].content = result;
        setActiveProject({ ...activeProject, chapters: chs });
      }
    } catch (err: any) {
      setError({ msg: "কাহিনী তৈরিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRewrite = async (instruction: string) => {
    if (!activeProject || isGenerating) return;
    setIsGenerating(true);
    const genre = activeProject.chapters[activeChapterIndex].genre || activeProject.genre;
    try {
      const result = await rewriteContent(activeProject.chapters[activeChapterIndex].content, instruction, genre);
      if (result) {
        const chs = [...activeProject.chapters];
        chs[activeChapterIndex].content = result;
        setActiveProject({ ...activeProject, chapters: chs });
      }
    } catch (err: any) { setError({ msg: "Edit failed.", type: 'error' }); }
    finally { setIsGenerating(false); }
  };

  const exportWord = () => {
    if (!activeProject) return;
    const chapter = activeProject.chapters[activeChapterIndex];
    const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><style>body{font-family:'Hind Siliguri','Arial Unicode MS',sans-serif;line-height:1.8;padding:40px;}h1{color:#e11d48;text-align:center;}h2{color:#334155;border-bottom:2px solid #e11d48;margin-bottom:20px;}</style></head>
    <body><h1>${activeProject.title}</h1><h2>${chapter.title}</h2><div>${chapter.content}</div></body></html>`;
    const converted = (window as any).htmlDocx.asBlob(html);
    (window as any).saveAs(converted, `${activeProject.title}_${chapter.title}.docx`);
  };

  const activeChapter = activeProject?.chapters[activeChapterIndex];
  const hasChapterOverrides = !!(activeChapter?.genre || activeChapter?.maturityLevel || activeChapter?.languageStyle || activeChapter?.settings);

  const updateChapterOverride = (key: keyof StoryChapter, value: any) => {
    if (!activeProject) return;
    const chs = [...activeProject.chapters];
    chs[activeChapterIndex] = { ...chs[activeChapterIndex], [key]: value };
    setActiveProject({ ...activeProject, chapters: chs });
  };

  const updateChapterSetting = (key: keyof GenerationSettings, value: any) => {
    if (!activeProject || !activeChapter) return;
    const currentSettings = activeChapter.settings || { ...activeProject.settings };
    const newSettings = { ...currentSettings, [key]: value };
    updateChapterOverride('settings', newSettings);
  };

  const clearChapterOverrides = () => {
    if (!activeProject) return;
    const chs = [...activeProject.chapters];
    const { genre, maturityLevel, languageStyle, settings, ...rest } = chs[activeChapterIndex];
    chs[activeChapterIndex] = rest as StoryChapter;
    setActiveProject({ ...activeProject, chapters: chs });
    setShowChapterSettings(false);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden selection:bg-rose-500/30">
      <aside className={`${sidebarOpen ? 'w-84' : 'w-0'} bg-slate-900 border-r border-slate-800 transition-all duration-500 flex flex-col z-30 shadow-2xl no-print`}>
        <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-rose-500 to-rose-700 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-rose-900/40 text-white">গ</div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase">GalpoSagor <span className="text-rose-500">Pro</span></h1>
          </div>
          <button onClick={createNewProject} className="p-2.5 bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xl transition-all hover:scale-110 active:scale-90 text-white" aria-label="New Project">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
          {activeProject && (
            <div className="space-y-8 animate-fade-in">
              <section className="space-y-4">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] block">কাহিনী পরিচিতি</label>
                <input value={activeProject.title} onChange={e => setActiveProject({...activeProject, title: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm focus:border-rose-500 outline-none transition-all placeholder:text-slate-600 shadow-inner" placeholder="উপন্যাসের নাম" />
                <textarea value={activeProject.description} onChange={e => setActiveProject({...activeProject, description: e.target.value})} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-xs h-32 focus:border-rose-500 outline-none resize-none transition-all placeholder:text-slate-600 shadow-inner" placeholder="কাহিনীর প্রেক্ষাপট বা সংক্ষেপ..." />
              </section>

              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">পরিচ্ছেদ তালিকা</label>
                  <button onClick={() => setActiveProject({...activeProject, chapters: [...activeProject.chapters, {id: Date.now().toString(), title: `পরিচ্ছেদ ${activeProject.chapters.length + 1}`, content: ''}]})} className="text-rose-500 text-[10px] font-black bg-rose-500/10 px-2 py-1 rounded hover:bg-rose-500 hover:text-white transition-all">+ নতুন</button>
                </div>
                <div className="space-y-2">
                  {activeProject.chapters.map((ch, idx) => (
                    <button key={ch.id} onClick={() => setActiveChapterIndex(idx)} className={`w-full text-left p-4 rounded-xl text-xs transition-all flex items-center gap-4 group ${activeChapterIndex === idx ? 'bg-rose-600/10 text-rose-400 border border-rose-600/30 shadow-lg' : 'hover:bg-slate-800/50 text-slate-500'}`}>
                      <span className="opacity-40 font-mono text-[10px]">{(idx + 1).toString().padStart(2, '0')}</span>
                      <span className="truncate flex-1 font-bold">{ch.title || 'শিরোনামহীন পরিচ্ছেদ'}</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${activeChapterIndex === idx ? 'bg-rose-500' : 'bg-transparent group-hover:bg-slate-600'}`}></div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          <section className="space-y-6">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] block">সংরক্ষিত লাইব্রেরি</label>
            <div className="space-y-4">
              {savedProjects.length === 0 && !activeProject && <p className="text-slate-600 text-[11px] text-center py-10 bg-slate-800/20 rounded-2xl border border-dashed border-slate-800">কোন কাহিনী পাওয়া যায়নি। শুরু করুন!</p>}
              {savedProjects.map(p => (
                <div key={p.id} onClick={() => loadProject(p)} className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col gap-3 group relative ${activeProject?.id === p.id ? 'bg-slate-800/80 border-rose-500/50 shadow-xl' : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'}`}>
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-bold truncate pr-10 text-slate-200">{p.title}</h3>
                    <button onClick={e => deleteProject(p.id, e)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-500 transition-all absolute top-4 right-4" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg></button>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                    <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800/50">{p.genre}</span>
                    <span className="opacity-60">{new Date(p.createdAt).toLocaleDateString('bn-BD')}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#010409]">
        <header className="h-20 border-b border-slate-800 flex items-center justify-between px-10 bg-slate-900/40 backdrop-blur-3xl z-20 no-print">
          <div className="flex items-center gap-8">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-3 hover:bg-slate-800 rounded-2xl transition text-slate-400 hover:text-rose-500" aria-label="Toggle Sidebar"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
            {activeProject && (
              <div className="flex flex-col">
                 <input value={activeProject.chapters[activeChapterIndex].title} onChange={e => {
                    const chs = [...activeProject.chapters];
                    chs[activeChapterIndex].title = e.target.value;
                    setActiveProject({...activeProject, chapters: chs});
                  }} className="bg-transparent font-black text-white text-2xl focus:outline-none focus:border-b-2 border-rose-500 transition-all max-w-[300px] lg:max-w-[450px]" placeholder="Chapter Title" />
                
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 flex items-center gap-2
                    ${saveStatus === 'saved' ? 'text-emerald-500' : 
                      saveStatus === 'saving' ? 'text-rose-400 animate-pulse' : 
                      saveStatus === 'unsaved' ? 'text-amber-500' : 'text-slate-600'}`}>
                    {saveStatus === 'saved' ? '✓ সংরক্ষিত' : saveStatus === 'saving' ? 'সংরক্ষণ হচ্ছে...' : saveStatus === 'unsaved' ? 'অসংরক্ষিত পরিবর্তন' : 'ক্লাউড সিঙ্ক চালু'}
                  </span>
                  {lastSavedTime && (
                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest opacity-60">
                      • {lastSavedTime}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
             {activeProject && (
               <div className="flex items-center gap-2 mr-6">
                 <button onClick={() => handleSaveProject(false)} className="px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700 rounded-xl transition-all text-[10px] font-black border border-slate-700 uppercase tracking-widest">সেভ করুন</button>
                 <button onClick={exportWord} className="px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700 rounded-xl transition-all text-[10px] font-black border border-slate-700 uppercase tracking-widest">Word</button>
                 <button onClick={() => window.print()} className="px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700 rounded-xl transition-all text-[10px] font-black border border-slate-700 uppercase tracking-widest">প্রিন্ট</button>
               </div>
             )}
             <button onClick={handleGenerate} disabled={!activeProject || isGenerating} className="bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:opacity-50 px-10 py-3.5 rounded-2xl font-black text-sm transition-all flex items-center gap-4 shadow-2xl shadow-rose-900/50 active:scale-95 text-white uppercase tracking-wider">
               {isGenerating && (
                 <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
               )}
               {isGenerating ? 'জেনারেট হচ্ছে...' : 'AI রাইট করুন'}
             </button>
          </div>
        </header>

        <div className="flex-1 p-8 lg:p-12 flex flex-col gap-8 overflow-hidden">
           {error && (
             <div className={`p-5 rounded-2xl border flex justify-between items-center animate-fade-in no-print ${error.type === 'success' ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400' : 'bg-rose-950/30 border-rose-800/50 text-rose-400'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${error.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  <span className="text-sm font-bold tracking-tight">{error.msg}</span>
                </div>
                <button onClick={() => setError(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">✕</button>
             </div>
           )}

           {activeProject ? (
             <div className="flex-1 min-h-0 flex flex-col gap-8 animate-fade-in overflow-y-auto custom-scrollbar pb-16 no-print">
               
               <div className="flex items-center justify-between no-print">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setShowChapterSettings(false)} 
                      className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${!showChapterSettings ? 'bg-rose-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Project Settings
                    </button>
                    <button 
                      onClick={() => setShowChapterSettings(true)} 
                      className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${showChapterSettings ? 'bg-rose-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Chapter Settings {hasChapterOverrides && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>}
                    </button>
                  </div>
                  {showChapterSettings && hasChapterOverrides && (
                    <button onClick={clearChapterOverrides} className="text-[9px] text-rose-500 font-black uppercase tracking-widest hover:underline">Reset to Default</button>
                  )}
               </div>

               <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 p-7 bg-slate-900/50 rounded-3xl border border-slate-800/50 backdrop-blur-2xl shadow-2xl">
                 {!showChapterSettings ? (
                   <>
                    {/* Project Level Settings */}
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Creativity</label>
                          <span className="text-[10px] text-rose-500 font-black">{(activeProject.settings.creativity * 100).toFixed(0)}%</span>
                        </div>
                        <input type="range" min="0.5" max="1" step="0.05" value={activeProject.settings.creativity} onChange={e => setActiveProject({...activeProject, settings: {...activeProject.settings, creativity: parseFloat(e.target.value)}})} className="accent-rose-500 h-2 bg-slate-800 rounded-full cursor-pointer shadow-inner" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Maturity</label>
                        <select value={activeProject.maturityLevel} onChange={e => setActiveProject({...activeProject, maturityLevel: e.target.value as MaturityLevel})} className="bg-slate-950/80 text-xs font-bold p-3 rounded-xl border border-slate-800 text-slate-300 outline-none focus:border-rose-500 transition-all appearance-none cursor-pointer">
                          <option value="General">General (সবাই)</option><option value="Adult">Adult (প্রাপ্তবয়স্ক)</option><option value="18+ Explicit">18+ (সতর্কতা)</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Mood/Tone</label>
                        <select value={activeProject.settings.tone} onChange={e => setActiveProject({...activeProject, settings: {...activeProject.settings, tone: e.target.value}})} className="bg-slate-950/80 text-xs font-bold p-3 rounded-xl border border-slate-800 text-slate-300 outline-none focus:border-rose-500 transition-all appearance-none cursor-pointer">
                          <option value="Passionate and Descriptive">প্যাশনেট</option><option value="Dark and Thrilling">থ্রিলার/ডার্ক</option><option value="Emotional and Deep">আবেগময়</option><option value="Sensual and Romantic">রোমান্টিক</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">ভাষা শৈলী</label>
                        <select value={activeProject.languageStyle} onChange={e => setActiveProject({...activeProject, languageStyle: e.target.value as LanguageStyle})} className="bg-slate-950/80 text-xs font-bold p-3 rounded-xl border border-slate-800 text-slate-300 outline-none focus:border-rose-500 transition-all appearance-none cursor-pointer">
                          <option value="Modern/Colloquial">আধুনিক</option><option value="Sadhu">সাধু ভাষা</option><option value="Cholitobhasha">চলিত ভাষা</option>
                        </select>
                    </div>
                   </>
                 ) : (
                   <>
                    {/* Chapter Specific Overrides */}
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-rose-500 uppercase font-black tracking-widest">Chapter Creativity</label>
                          <span className="text-[10px] text-rose-500 font-black">{( (activeChapter?.settings?.creativity || activeProject.settings.creativity) * 100).toFixed(0)}%</span>
                        </div>
                        <input type="range" min="0.5" max="1" step="0.05" value={activeChapter?.settings?.creativity || activeProject.settings.creativity} onChange={e => updateChapterSetting('creativity', parseFloat(e.target.value))} className="accent-rose-500 h-2 bg-slate-800 rounded-full cursor-pointer shadow-inner" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-rose-500 uppercase font-black tracking-widest">Chapter Maturity</label>
                        <select value={activeChapter?.maturityLevel || activeProject.maturityLevel} onChange={e => updateChapterOverride('maturityLevel', e.target.value as MaturityLevel)} className="bg-slate-950/80 text-xs font-bold p-3 rounded-xl border border-rose-500/30 text-rose-100 outline-none focus:border-rose-500 transition-all appearance-none cursor-pointer">
                          <option value="General">General (সবাই)</option><option value="Adult">Adult (প্রাপ্তবয়স্ক)</option><option value="18+ Explicit">18+ (সতর্কতা)</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-rose-500 uppercase font-black tracking-widest">Chapter Tone</label>
                        <select value={activeChapter?.settings?.tone || activeProject.settings.tone} onChange={e => updateChapterSetting('tone', e.target.value)} className="bg-slate-950/80 text-xs font-bold p-3 rounded-xl border border-rose-500/30 text-rose-100 outline-none focus:border-rose-500 transition-all appearance-none cursor-pointer">
                          <option value="Passionate and Descriptive">প্যাশনেট</option><option value="Dark and Thrilling">থ্রিলার/ডার্ক</option><option value="Emotional and Deep">আবেগময়</option><option value="Sensual and Romantic">রোমান্টিক</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-rose-500 uppercase font-black tracking-widest">Chapter ভাষা শৈলী</label>
                        <select value={activeChapter?.languageStyle || activeProject.languageStyle} onChange={e => updateChapterOverride('languageStyle', e.target.value as LanguageStyle)} className="bg-slate-950/80 text-xs font-bold p-3 rounded-xl border border-rose-500/30 text-rose-100 outline-none focus:border-rose-500 transition-all appearance-none cursor-pointer">
                          <option value="Modern/Colloquial">আধুনিক</option><option value="Sadhu">সাধু ভাষা</option><option value="Cholitobhasha">চলিত ভাষা</option>
                        </select>
                    </div>
                   </>
                 )}
               </div>

               <div className="p-7 bg-slate-900/50 rounded-3xl border border-slate-800/50 backdrop-blur-2xl shadow-2xl space-y-3">
                  <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block">
                    {showChapterSettings ? 'Chapter AI নির্দেশ (Custom Prompt Override)' : 'Project AI নির্দেশ (Global Prompt)'}
                  </label>
                  <textarea 
                    value={showChapterSettings ? (activeChapter?.settings?.customSystemPrompt || '') : (activeProject.settings.customSystemPrompt || '')} 
                    onChange={e => {
                      if (showChapterSettings) {
                        updateChapterSetting('customSystemPrompt', e.target.value);
                      } else {
                        setActiveProject({...activeProject, settings: {...activeProject.settings, customSystemPrompt: e.target.value}});
                      }
                    }} 
                    className={`w-full bg-slate-950/50 border rounded-2xl p-4 text-xs h-24 outline-none resize-none text-slate-300 transition-all placeholder:text-slate-700 ${showChapterSettings ? 'border-rose-500/30 focus:border-rose-500' : 'border-slate-700/50 focus:border-rose-500'}`}
                    placeholder={showChapterSettings ? "এই পরিচ্ছেদের জন্য বিশেষ ইনস্ট্রাকশন দিন..." : "পুরো উপন্যাসের জন্য এআই গাইডলাইন দিন..."}
                  />
               </div>
               
               <div className="flex-1 min-h-[600px] shadow-3xl">
                  <Editor 
                    content={activeProject.chapters[activeChapterIndex].content} 
                    onChange={val => {
                      const chs = [...activeProject.chapters];
                      chs[activeChapterIndex].content = val;
                      setActiveProject({...activeProject, chapters: chs});
                    }} 
                    onRewrite={handleRewrite} 
                    isGenerating={isGenerating} 
                  />
               </div>
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 animate-fade-in no-print">
                <div className="relative">
                  <div className="absolute inset-0 bg-rose-600/30 blur-[100px] rounded-full animate-pulse"></div>
                  <div className="w-48 h-48 bg-rose-600/10 rounded-[4.5rem] border-2 border-rose-500/30 flex items-center justify-center shadow-3xl relative z-10 backdrop-blur-sm">
                     <svg className="w-24 h-24 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                </div>
                <div className="space-y-6">
                  <h2 className="text-7xl font-black bg-clip-text text-transparent bg-gradient-to-br from-rose-400 via-rose-600 to-rose-900 tracking-tighter uppercase">গল্পসাগর প্রো</h2>
                  <p className="text-slate-500 text-2xl max-w-2xl mx-auto font-medium leading-relaxed tracking-tight">আপনার কল্পনার সীমানা ছাড়িয়ে যাক। সেরা মানের ১৮+ বাংলা কাহিনী ও উপন্যাসের জন্য বিশ্বের সবথেকে শক্তিশালী এআই লেখনী প্ল্যাটফর্ম।</p>
                </div>
                <button onClick={createNewProject} className="px-20 py-7 bg-rose-600 hover:bg-rose-500 rounded-[2.5rem] text-3xl font-black transition-all shadow-3xl shadow-rose-900/60 hover:scale-105 active:scale-95 flex items-center gap-8 text-white group">
                  নতুন কাহিনী শুরু করুন
                  <svg className="w-8 h-8 group-hover:translate-x-3 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
             </div>
           )}
        </div>
      </main>

      {/* Hidden Print Container */}
      <div className="hidden print-only bg-white p-20 text-black bengali-text">
        {activeProject && (
          <div>
            <h1 className="text-4xl font-bold mb-10 text-center">{activeProject.title}</h1>
            <h2 className="text-2xl font-bold mb-6 border-b-2 border-black pb-2">{activeProject.chapters[activeChapterIndex].title}</h2>
            <div dangerouslySetInnerHTML={{ __html: activeProject.chapters[activeChapterIndex].content }} className="text-xl leading-relaxed"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
