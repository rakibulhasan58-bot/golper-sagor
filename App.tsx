
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
import { generateStoryChapter, rewriteContent, continueStory } from './services/geminiService';
import Editor from './components/Editor';

const STORAGE_KEY = 'galposagor_v4_premium_storage_final';

const DEFAULT_SETTINGS: GenerationSettings = {
  creativity: 0.85,
  length: 'Long',
  tone: 'Passionate and Descriptive',
  customSystemPrompt: ''
};

const GENRES: StoryGenre[] = ['Romance', 'Thriller', 'Adult/Erotica', 'Drama', 'Social', 'Mystery', 'Historical'];
const LENGTHS: ChapterLength[] = ['Short', 'Medium', 'Long', 'Epic'];

const App: React.FC = () => {
  const [savedProjects, setSavedProjects] = useState<StoryProject[]>([]);
  const [activeProject, setActiveProject] = useState<StoryProject | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [error, setError] = useState<{msg: string, type: 'error' | 'success'} | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'project' | 'chapter'>('project');
  
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  // Load from Storage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoryProject[];
        if (Array.isArray(parsed)) {
          setSavedProjects(parsed);
          // Auto-load last project if exists
          if (parsed.length > 0 && !activeProject) {
            setActiveProject(parsed[0]);
            setActiveChapterIndex(0);
          }
        }
      } catch (e) { console.error("Restore Error:", e); }
    }

    const handleResize = () => {
      if (window.innerWidth <= 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  // Auto-save logic
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
      id: "proj-" + Date.now(),
      title: 'নতুন উপন্যাস',
      description: '',
      genre: 'Romance',
      maturityLevel: 'Adult',
      languageStyle: 'Modern/Colloquial',
      settings: { ...DEFAULT_SETTINGS },
      createdAt: Date.now(),
      chapters: [{ id: "ch-" + Date.now() + "-1", title: 'পরিচ্ছেদ ১', content: '' }]
    };
    setActiveProject(newProject);
    setActiveChapterIndex(0);
    setLastSavedTime(null);
    lastSavedRef.current = JSON.stringify(newProject);
  };

  const addNewChapter = () => {
    if (!activeProject) return;
    const newChapterNum = activeProject.chapters.length + 1;
    const newChapter: StoryChapter = {
      id: "ch-" + Date.now() + "-" + newChapterNum,
      title: `পরিচ্ছেদ ${newChapterNum}`,
      content: ''
    };
    
    const updatedProject = {
      ...activeProject,
      chapters: [...activeProject.chapters, newChapter]
    };
    
    setActiveProject(updatedProject);
    setActiveChapterIndex(updatedProject.chapters.length - 1);
  };

  const deleteChapter = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeProject) return;
    if (activeProject.chapters.length <= 1) {
      setError({ msg: "কমপক্ষে একটি পরিচ্ছেদ থাকতে হবে।", type: 'error' });
      return;
    }
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই পরিচ্ছেদটি মুছে ফেলতে চান?")) return;
    
    const chs = activeProject.chapters.filter((_, i) => i !== idx);
    let nextIdx = activeChapterIndex;
    if (idx <= activeChapterIndex) {
      nextIdx = Math.max(0, activeChapterIndex - 1);
    }
    
    setActiveProject({ ...activeProject, chapters: chs });
    setActiveChapterIndex(nextIdx);
  };

  const clearChapterContent = () => {
    if (!activeProject) return;
    if (window.confirm("আপনি কি এই পরিচ্ছেদের সমস্ত লেখা মুছে ফেলতে চান?")) {
      const chs = [...activeProject.chapters];
      if (chs[activeChapterIndex]) {
        chs[activeChapterIndex].content = '';
        setActiveProject({ ...activeProject, chapters: chs });
      }
    }
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
    if (!activeProject || isGenerating || isContinuing) return;
    const currentChapter = activeProject.chapters[activeChapterIndex];
    if (!currentChapter) return;

    setIsGenerating(true);
    setError(null);
    
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
        activeChapterIndex > 0 ? activeProject.chapters[activeChapterIndex - 1].content.slice(-1500) : undefined
      );
      if (result) {
        const chs = [...activeProject.chapters];
        chs[activeChapterIndex].content = result;
        setActiveProject({ ...activeProject, chapters: chs });
      }
    } catch (err: any) {
      setError({ msg: err.message || "কাহিনী তৈরিতে সমস্যা হয়েছে।", type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleContinue = async () => {
    if (!activeProject || isGenerating || isContinuing) return;
    const currentChapter = activeProject.chapters[activeChapterIndex];
    if (!currentChapter || !currentText(currentChapter.content).trim()) {
      setError({ msg: "এগিয়ে নেওয়ার জন্য প্রথমে কিছু টেক্সট লিখুন।", type: 'error' });
      return;
    }

    setIsContinuing(true);
    setError(null);

    const genre = currentChapter.genre || activeProject.genre;
    const settings = currentChapter.settings || activeProject.settings;
    const maturity = currentChapter.maturityLevel || activeProject.maturityLevel;
    const language = currentChapter.languageStyle || activeProject.languageStyle;

    try {
      const result = await continueStory(
        currentChapter.content,
        activeProject.description,
        genre,
        settings,
        maturity,
        language
      );
      if (result) {
        const chs = [...activeProject.chapters];
        const lastPart = chs[activeChapterIndex].content;
        const separator = lastPart.endsWith('</p>') || lastPart.endsWith('>') ? '' : '<br><br>';
        chs[activeChapterIndex].content = lastPart.trim() + separator + result.trim();
        setActiveProject({ ...activeProject, chapters: chs });
      }
    } catch (err: any) {
      setError({ msg: "কাহিনী এগিয়ে নিতে সমস্যা হয়েছে।", type: 'error' });
    } finally {
      setIsContinuing(false);
    }
  };

  const currentText = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.innerText || div.textContent || "";
  };

  const handleRewrite = async (instruction: string) => {
    if (!activeProject || isGenerating || isContinuing) return;
    const currentChapter = activeProject.chapters[activeChapterIndex];
    if (!currentChapter) return;

    setIsGenerating(true);
    const genre = currentChapter.genre || activeProject.genre;
    try {
      const result = await rewriteContent(currentChapter.content, instruction, genre);
      if (result) {
        const chs = [...activeProject.chapters];
        chs[activeChapterIndex].content = result;
        setActiveProject({ ...activeProject, chapters: chs });
      }
    } catch (err: any) { 
      setError({ msg: "এডিট করা সম্ভব হয়নি।", type: 'error' }); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  const exportWord = () => {
    if (!activeProject) return;
    const chapter = activeProject.chapters[activeChapterIndex];
    if (!chapter) return;

    const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><style>body{font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif;line-height:1.8;padding:40px;}h1{color:#e11d48;text-align:center;}h2{color:#334155;border-bottom:2px solid #e11d48;margin-bottom:20px;}</style></head>
    <body><h1>${activeProject.title}</h1><h2>${chapter.title}</h2><div style="font-size:14pt">${chapter.content}</div></body></html>`;
    
    try {
      if (!(window as any).htmlDocx) {
        alert("Export library still loading...");
        return;
      }
      const converted = (window as any).htmlDocx.asBlob(html);
      (window as any).saveAs(converted, `${activeProject.title.replace(/\s+/g, '_')}.docx`);
    } catch (e) {
      console.error(e);
      alert("Word export failed.");
    }
  };

  const copyToClipboard = () => {
    if (!activeProject || !activeProject.chapters[activeChapterIndex]) return;
    const text = currentText(activeProject.chapters[activeChapterIndex].content);
    navigator.clipboard.writeText(text).then(() => {
      setError({ msg: "ক্লিপবোর্ডে কপি করা হয়েছে!", type: 'success' });
      setTimeout(() => setError(null), 2000);
    });
  };

  const activeChapter = activeProject?.chapters[activeChapterIndex];
  const hasChapterOverrides = !!(activeChapter?.genre || activeChapter?.maturityLevel || activeChapter?.languageStyle || activeChapter?.settings);

  const updateChapterOverride = (key: keyof StoryChapter, value: any) => {
    if (!activeProject || !activeProject.chapters[activeChapterIndex]) return;
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
    if (!activeProject || !activeProject.chapters[activeChapterIndex]) return;
    const chs = [...activeProject.chapters];
    const { genre, maturityLevel, languageStyle, settings, ...rest } = chs[activeChapterIndex];
    chs[activeChapterIndex] = rest as StoryChapter;
    setActiveProject({ ...activeProject, chapters: chs });
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden selection:bg-rose-500/30">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && window.innerWidth <= 1024 && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`${sidebarOpen ? (window.innerWidth <= 1024 ? 'fixed inset-y-0 left-0 w-80' : 'w-84') : 'w-0'} bg-slate-900 border-r border-slate-800 transition-all duration-500 flex flex-col z-50 shadow-2xl no-print overflow-hidden`}>
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
                  <button onClick={addNewChapter} className="text-rose-500 text-[10px] font-black bg-rose-500/10 px-2 py-1 rounded hover:bg-rose-500 hover:text-white transition-all">+ নতুন</button>
                </div>
                <div className="space-y-2">
                  {activeProject.chapters.map((ch, idx) => (
                    <button key={ch.id} onClick={() => setActiveChapterIndex(idx)} className={`w-full text-left p-4 rounded-xl text-xs transition-all flex items-center gap-4 group ${activeChapterIndex === idx ? 'bg-rose-600/10 text-rose-400 border border-rose-600/30 shadow-lg' : 'hover:bg-slate-800/50 text-slate-500'}`}>
                      <span className="opacity-40 font-mono text-[10px]">{(idx + 1).toString().padStart(2, '0')}</span>
                      <span className="truncate flex-1 font-bold">{ch.title || 'শিরোনামহীন পরিচ্ছেদ'}</span>
                      <div className="flex items-center gap-2">
                         <div onClick={(e) => deleteChapter(idx, e)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-rose-600/20 rounded-md text-slate-400 hover:text-rose-500 transition-all" title="Delete Chapter">
                           <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg>
                         </div>
                         <div className={`w-1.5 h-1.5 rounded-full ${activeChapterIndex === idx ? 'bg-rose-500' : 'bg-transparent group-hover:bg-slate-600'}`}></div>
                      </div>
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
                    <button onClick={e => deleteProject(p.id, e)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-500 transition-all absolute top-4 right-4" title="Delete Project"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg></button>
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
        <header className="h-auto min-h-[80px] py-4 border-b border-slate-800 flex flex-col lg:flex-row items-center justify-between px-6 lg:px-10 bg-slate-900/40 backdrop-blur-3xl z-20 no-print gap-4">
          <div className="flex items-center gap-4 lg:gap-8 w-full lg:w-auto">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-3 hover:bg-slate-800 rounded-2xl transition text-slate-400 hover:text-rose-500" aria-label="Toggle Sidebar"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
            {activeProject && (
              <div className="flex flex-col flex-1">
                 <div className="flex items-center gap-4">
                    <input value={activeProject.chapters[activeChapterIndex]?.title || ''} onChange={e => {
                        const chs = [...activeProject.chapters];
                        if (chs[activeChapterIndex]) {
                          chs[activeChapterIndex].title = e.target.value;
                          setActiveProject({...activeProject, chapters: chs});
                        }
                    }} className="bg-transparent font-black text-white text-lg lg:text-2xl focus:outline-none focus:border-b-2 border-rose-500 transition-all w-full max-w-full" placeholder="Chapter Title" />
                    
                    <button 
                      onClick={() => setIsSettingsOpen(true)}
                      className="p-2 lg:p-3 hover:bg-slate-800 rounded-2xl transition text-slate-400 hover:text-rose-500 relative group"
                      aria-label="Story Settings"
                    >
                      <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {hasChapterOverrides && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900 animate-pulse"></span>}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">সেটিংস</span>
                    </button>
                 </div>
                
                <div className="flex items-center gap-4 mt-2">
                  <div className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 flex items-center gap-2 shadow-sm
                    ${saveStatus === 'saved' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' : 
                      saveStatus === 'saving' ? 'bg-rose-950/40 border-rose-500/40 text-rose-400' : 
                      saveStatus === 'unsaved' ? 'bg-amber-950/40 border-amber-500/40 text-amber-500' : 'bg-slate-900/40 border-slate-700 text-slate-600'}`}>
                    
                    {saveStatus === 'saved' && <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>সংরক্ষিত</>}
                    {saveStatus === 'saving' && <><svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>সংরক্ষণ...</>}
                    {saveStatus === 'unsaved' && <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span></span>পরিবর্তনসমূহ</>}
                    {saveStatus === 'idle' && <><svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>সিঙ্কড</>}
                  </div>
                  {lastSavedTime && <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest hidden lg:inline">• {lastSavedTime}</span>}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
             {activeProject && (
               <div className="hidden sm:flex items-center gap-1.5 lg:mr-4">
                 <button onClick={() => handleSaveProject(false)} className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700 rounded-xl transition-all text-[9px] font-black border border-slate-700 uppercase">সেভ</button>
                 <button onClick={copyToClipboard} className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700 rounded-xl transition-all text-[9px] font-black border border-slate-700 uppercase">Copy</button>
                 <button onClick={exportWord} className="px-3 py-2 bg-slate-800/50 hover:bg-slate-700 rounded-xl transition-all text-[9px] font-black border border-slate-700 uppercase">Word</button>
                 <button onClick={clearChapterContent} className="px-3 py-2 bg-rose-900/30 hover:bg-rose-900/50 rounded-xl transition-all text-[9px] font-black border border-rose-900/50 uppercase text-rose-400">মুছুন</button>
               </div>
             )}
             
             <div className="flex items-center gap-2">
                <button onClick={handleContinue} disabled={!activeProject || isGenerating || isContinuing} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:opacity-50 px-4 py-2.5 lg:py-3.5 rounded-xl lg:rounded-2xl font-black text-[11px] lg:text-sm transition-all flex items-center gap-2 shadow-xl active:scale-95 text-white uppercase tracking-wider">
                  {isContinuing ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>}
                  {isContinuing ? '...' : 'Cont.'}
                </button>
                <button onClick={handleGenerate} disabled={!activeProject || isGenerating || isContinuing} className="bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:opacity-50 px-5 lg:px-8 py-2.5 lg:py-3.5 rounded-xl lg:rounded-2xl font-black text-[11px] lg:text-sm transition-all flex items-center gap-2 shadow-2xl shadow-rose-900/50 active:scale-95 text-white uppercase tracking-wider">
                  {isGenerating ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                  {isGenerating ? 'জেনারেট...' : 'AI রাইট'}
                </button>
             </div>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-12 flex flex-col gap-6 lg:gap-8 overflow-hidden">
           {error && (
             <div className={`p-4 lg:p-5 rounded-2xl border flex justify-between items-center animate-fade-in no-print ${error.type === 'success' ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400' : 'bg-rose-950/30 border-rose-800/50 text-rose-400'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${error.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                  <span className="text-sm font-bold tracking-tight">{error.msg}</span>
                </div>
                <button onClick={() => setError(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">✕</button>
             </div>
           )}

           {activeProject ? (
             <div className="flex-1 min-h-0 flex flex-col gap-6 lg:gap-8 animate-fade-in overflow-y-auto custom-scrollbar pb-16 no-print">
               <div className="flex-1 min-h-[500px] lg:min-h-[600px] shadow-3xl">
                  {activeProject.chapters[activeChapterIndex] ? (
                    <Editor 
                      content={activeProject.chapters[activeChapterIndex].content} 
                      onChange={val => {
                        const chs = [...activeProject.chapters];
                        if (chs[activeChapterIndex]) {
                          chs[activeChapterIndex].content = val;
                          setActiveProject({...activeProject, chapters: chs});
                        }
                      }} 
                      onRewrite={handleRewrite} 
                      isGenerating={isGenerating || isContinuing} 
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-600 font-bold uppercase tracking-widest bg-slate-900 rounded-3xl border border-slate-800 border-dashed">
                      পরিচ্ছেদ লোড হচ্ছে...
                    </div>
                  )}
               </div>
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 lg:space-y-12 animate-fade-in no-print p-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-rose-600/30 blur-[100px] rounded-full animate-pulse"></div>
                  <div className="w-32 h-32 lg:w-48 lg:h-48 bg-rose-600/10 rounded-[2.5rem] lg:rounded-[4.5rem] border-2 border-rose-500/30 flex items-center justify-center shadow-3xl relative z-10 backdrop-blur-sm">
                     <svg className="w-16 h-16 lg:w-24 lg:h-24 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                </div>
                <div className="space-y-4 lg:space-y-6">
                  <h2 className="text-4xl lg:text-7xl font-black bg-clip-text text-transparent bg-gradient-to-br from-rose-400 via-rose-600 to-rose-900 tracking-tighter uppercase">গল্পসাগর প্রো</h2>
                  <p className="text-slate-500 text-base lg:text-2xl max-w-2xl mx-auto font-medium leading-relaxed tracking-tight px-4">আপনার কল্পনার সীমানা ছাড়িয়ে যাক। সেরা মানের ১৮+ বাংলা কাহিনী ও উপন্যাসের জন্য বিশ্বের সবথেকে শক্তিশালী এআই লেখনী প্ল্যাটফর্ম।</p>
                </div>
                <button onClick={createNewProject} className="px-10 lg:px-20 py-4 lg:py-7 bg-rose-600 hover:bg-rose-500 rounded-2xl lg:rounded-[2.5rem] text-xl lg:text-3xl font-black transition-all shadow-3xl shadow-rose-900/60 hover:scale-105 active:scale-95 flex items-center gap-4 lg:gap-8 text-white group uppercase tracking-widest">
                  নতুন কাহিনী শুরু করুন
                  <svg className="w-6 h-6 lg:w-8 lg:h-8 group-hover:translate-x-3 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
             </div>
           )}
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && activeProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10 animate-fade-in">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-[2rem] lg:rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
            <header className="p-8 lg:p-10 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-xl">
              <div>
                <h2 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-4">
                  <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                  কনফিগারেশন
                </h2>
                <p className="text-slate-500 text-xs lg:text-sm mt-1 font-medium">উপন্যাসের লেখনী এবং এআই সেটিংস নিয়ন্ত্রণ করুন।</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-4 bg-slate-800 hover:bg-rose-600 rounded-3xl transition-all hover:scale-110 active:scale-90 text-white group">
                <svg className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                <button onClick={() => setSettingsTab('project')} className={`flex-1 py-6 text-xs lg:text-sm font-black uppercase tracking-[0.2em] transition-all border-b-4 ${settingsTab === 'project' ? 'border-rose-600 text-rose-500 bg-rose-600/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Project Defaults</button>
                <button onClick={() => setSettingsTab('chapter')} className={`flex-1 py-6 text-xs lg:text-sm font-black uppercase tracking-[0.2em] transition-all border-b-4 flex items-center justify-center gap-3 ${settingsTab === 'chapter' ? 'border-rose-600 text-rose-500 bg-rose-600/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Chapter Overrides {hasChapterOverrides && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>}</button>
              </div>

              <div className="p-8 lg:p-12 space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
                  <section className="space-y-8">
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4"><span className="w-8 h-px bg-slate-800"></span> লেখনী ও শৈলী</h3>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-slate-300">সৃজনশীলতা (Creativity)</label>
                        <span className="text-rose-500 font-mono font-black">{((settingsTab === 'project' ? activeProject.settings.creativity : (activeChapter?.settings?.creativity ?? activeProject.settings.creativity)) * 100).toFixed(0)}%</span>
                      </div>
                      <input type="range" min="0.5" max="1" step="0.05" value={settingsTab === 'project' ? activeProject.settings.creativity : (activeChapter?.settings?.creativity ?? activeProject.settings.creativity)} onChange={e => settingsTab === 'project' ? setActiveProject({...activeProject, settings: {...activeProject.settings, creativity: parseFloat(e.target.value)}}) : updateChapterSetting('creativity', parseFloat(e.target.value))} className="w-full accent-rose-500 h-2 bg-slate-800 rounded-full cursor-pointer" />
                    </div>

                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-300 block">মুড এবং টোন (Tone)</label>
                      <select value={settingsTab === 'project' ? activeProject.settings.tone : (activeChapter?.settings?.tone ?? activeProject.settings.tone)} onChange={e => settingsTab === 'project' ? setActiveProject({...activeProject, settings: {...activeProject.settings, tone: e.target.value}}) : updateChapterSetting('tone', e.target.value)} className="w-full bg-slate-950 text-xs font-bold p-4 rounded-2xl border border-slate-800 text-slate-300 outline-none focus:border-rose-500">
                        <option value="Passionate and Descriptive">প্যাশনেট ও বর্ণনামূলক</option>
                        <option value="Dark and Thrilling">ডার্ক ও থ্রিলিং</option>
                        <option value="Emotional and Deep">আবেগময় ও গভীর</option>
                        <option value="Sensual and Romantic">রোমান্টিক ও রোমাঞ্চকর</option>
                        <option value="Action Oriented">অ্যাকশন ও গতিশীল</option>
                      </select>
                    </div>

                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-300 block">অধ্যায়ের দৈর্ঘ্য (Length)</label>
                      <select value={settingsTab === 'project' ? activeProject.settings.length : (activeChapter?.settings?.length ?? activeProject.settings.length)} onChange={e => settingsTab === 'project' ? setActiveProject({...activeProject, settings: {...activeProject.settings, length: e.target.value as ChapterLength}}) : updateChapterSetting('length', e.target.value as ChapterLength)} className="w-full bg-slate-950 text-xs font-bold p-4 rounded-2xl border border-slate-800 text-slate-300 outline-none focus:border-rose-500">
                        {LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </section>

                  <section className="space-y-8">
                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4"><span className="w-8 h-px bg-slate-800"></span> কন্টেন্ট প্রপার্টিজ</h3>

                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-300 block">ম্যাচিউরিটি লেভেল</label>
                      <select value={settingsTab === 'project' ? activeProject.maturityLevel : (activeChapter?.maturityLevel ?? activeProject.maturityLevel)} onChange={e => settingsTab === 'project' ? setActiveProject({...activeProject, maturityLevel: e.target.value as MaturityLevel}) : updateChapterOverride('maturityLevel', e.target.value as MaturityLevel)} className="w-full bg-slate-950 text-xs font-bold p-4 rounded-2xl border border-slate-800 text-slate-300 outline-none focus:border-rose-500">
                        <option value="General">General (সবার জন্য)</option>
                        <option value="Adult">Adult (প্রাপ্তবয়স্ক)</option>
                        <option value="18+ Explicit">18+ (উগ্র কন্টেন্ট)</option>
                      </select>
                    </div>

                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-300 block">বিভাগ (Genre)</label>
                      <select value={settingsTab === 'project' ? activeProject.genre : (activeChapter?.genre ?? activeProject.genre)} onChange={e => settingsTab === 'project' ? setActiveProject({...activeProject, genre: e.target.value as StoryGenre}) : updateChapterOverride('genre', e.target.value as StoryGenre)} className="w-full bg-slate-950 text-xs font-bold p-4 rounded-2xl border border-slate-800 text-slate-300 outline-none focus:border-rose-500">
                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>

                    <div className="space-y-4">
                      <label className="text-sm font-bold text-slate-300 block">ভাষা শৈলী</label>
                      <select value={settingsTab === 'project' ? activeProject.languageStyle : (activeChapter?.languageStyle ?? activeProject.languageStyle)} onChange={e => settingsTab === 'project' ? setActiveProject({...activeProject, languageStyle: e.target.value as LanguageStyle}) : updateChapterOverride('languageStyle', e.target.value as LanguageStyle)} className="w-full bg-slate-950 text-xs font-bold p-4 rounded-2xl border border-slate-800 text-slate-300 outline-none focus:border-rose-500">
                        <option value="Modern/Colloquial">আধুনিক (Modern)</option>
                        <option value="Cholitobhasha">চলিত ভাষা (Standard)</option>
                        <option value="Sadhu">সাধু ভাষা (Pure)</option>
                      </select>
                    </div>
                  </section>
                </div>

                <section className="space-y-8 pb-12">
                   <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-4"><span className="w-8 h-px bg-slate-800"></span> এআই নির্দেশিকা</h3>
                    <div className="p-8 lg:p-10 bg-slate-950/50 rounded-[2rem] border border-slate-800 space-y-6">
                      <textarea value={settingsTab === 'project' ? (activeProject.settings.customSystemPrompt || '') : (activeChapter?.settings?.customSystemPrompt ?? activeProject.settings.customSystemPrompt ?? '')} onChange={e => settingsTab === 'project' ? setActiveProject({...activeProject, settings: {...activeProject.settings, customSystemPrompt: e.target.value}}) : updateChapterSetting('customSystemPrompt', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-sm h-40 outline-none resize-none text-slate-200 transition-all focus:border-rose-500" placeholder="বিশেষ এআই ডিরেকশন দিন..."/>
                    </div>
                </section>
              </div>
            </div>

            <footer className="p-8 lg:p-10 border-t border-slate-800 bg-slate-900/50 backdrop-blur-xl flex justify-between items-center">
               <button onClick={clearChapterOverrides} className="text-xs font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 transition-colors">Reset Chapter Settings</button>
               <button onClick={() => setIsSettingsOpen(false)} className="px-12 py-4 bg-rose-600 hover:bg-rose-500 rounded-3xl text-sm font-black transition-all shadow-xl text-white uppercase tracking-widest active:scale-95">সম্পন্ন</button>
            </footer>
          </div>
        </div>
      )}

      {/* Print Overlay */}
      <div className="hidden print-only bg-white p-10 text-black">
        {activeProject && activeChapter && (
          <div>
            <h1 className="text-3xl font-bold mb-5">{activeProject.title}</h1>
            <h2 className="text-xl font-bold mb-3">{activeChapter.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: activeChapter.content }} className="text-lg leading-relaxed"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
