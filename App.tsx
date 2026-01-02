
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StoryProject, StoryChapter, StoryGenre, GenerationSettings } from './types';
import { generateStoryChapter, rewriteContent } from './services/geminiService';
import Editor from './components/Editor';

const STORAGE_KEY = 'galposagor_projects_v1';

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved';

const App: React.FC = () => {
  const [savedProjects, setSavedProjects] = useState<StoryProject[]>([]);
  const [activeProject, setActiveProject] = useState<StoryProject | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  
  // Use ReturnType<typeof setTimeout> instead of NodeJS.Timeout to fix namespace error in browser environment
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings state with updated default tone
  const [settings, setSettings] = useState<GenerationSettings>({
    creativity: 0.8,
    length: 'Long',
    tone: 'Passionate and Intense'
  });

  // Load projects on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoryProject[];
        setSavedProjects(parsed);
      } catch (e) {
        console.error("Failed to parse saved projects", e);
      }
    }
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (!activeProject) return;

    // When project or settings change, mark as unsaved and start timer
    setSaveStatus('unsaved');

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveProject(true); // true means silent auto-save
    }, 3000); // 3 second debounce

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [activeProject, settings]);

  const saveToStorage = (projects: StoryProject[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    setSavedProjects(projects);
  };

  const handleSaveProject = (isAuto = false) => {
    if (!activeProject) return;
    
    setSaveStatus('saving');
    
    const existingIndex = savedProjects.findIndex(p => p.id === activeProject.id);
    let updatedProjects: StoryProject[];
    
    if (existingIndex >= 0) {
      updatedProjects = [...savedProjects];
      updatedProjects[existingIndex] = { ...activeProject };
    } else {
      updatedProjects = [activeProject, ...savedProjects];
    }
    
    saveToStorage(updatedProjects);
    
    setSaveStatus('saved');
    if (!isAuto) {
      setError("Project saved successfully!");
      setTimeout(() => setError(null), 3000);
    }
    
    // Clear the "Saved" status after a while to look clean
    setTimeout(() => {
      setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
    }, 2000);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    
    const updated = savedProjects.filter(p => p.id !== id);
    saveToStorage(updated);
    if (activeProject?.id === id) {
      setActiveProject(null);
    }
  };

  const createNewProject = () => {
    const newProject: StoryProject = {
      id: Date.now().toString(),
      title: 'নতুন উপন্যাস',
      description: '',
      genre: 'Romance',
      maturityLevel: 'Adult',
      languageStyle: 'Modern/Colloquial',
      createdAt: Date.now(),
      chapters: [{ id: '1', title: 'সূচনা (Introduction)', content: '' }]
    };
    setActiveProject(newProject);
    setActiveChapterIndex(0);
    setSaveStatus('idle');
  };

  const loadProject = (project: StoryProject) => {
    setActiveProject(project);
    setActiveChapterIndex(0);
    // After loading, we don't want it immediately saying "unsaved"
    setTimeout(() => setSaveStatus('idle'), 100);
  };

  const updateChapterContent = (content: string) => {
    if (!activeProject) return;
    const newChapters = [...activeProject.chapters];
    newChapters[activeChapterIndex].content = content;
    setActiveProject({ ...activeProject, chapters: newChapters });
  };

  const handleGenerate = async () => {
    if (!activeProject) return;
    setIsGenerating(true);
    setError(null);
    
    try {
      const chapter = activeProject.chapters[activeChapterIndex];
      const context = `Writing chapter ${activeChapterIndex + 1}: ${chapter.title}. The story is about ${activeProject.description}. Focus on depth and excitement.`;
      
      const prevSummary = activeChapterIndex > 0 
        ? activeProject.chapters[activeChapterIndex - 1].content.substring(0, 500) 
        : undefined;

      const generatedText = await generateStoryChapter(
        activeProject.title,
        chapter.title,
        context,
        activeProject.genre,
        settings,
        activeProject.maturityLevel,
        activeProject.languageStyle,
        prevSummary
      );

      if (generatedText) {
        updateChapterContent(generatedText);
      }
    } catch (err: any) {
      setError(err.message || 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRewrite = async (instruction: string) => {
    if (!activeProject) return;
    setIsGenerating(true);
    setError(null);
    try {
      const content = activeProject.chapters[activeChapterIndex].content;
      const rewritten = await rewriteContent(content, instruction, activeProject.genre);
      if (rewritten) {
        updateChapterContent(rewritten);
      }
    } catch (err: any) {
      setError(err.message || 'Rewrite failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const addChapter = () => {
    if (!activeProject) return;
    const newChapter: StoryChapter = {
      id: (activeProject.chapters.length + 1).toString(),
      title: `পরিচ্ছেদ ${activeProject.chapters.length + 1}`,
      content: ''
    };
    setActiveProject({
      ...activeProject,
      chapters: [...activeProject.chapters, newChapter]
    });
    setActiveChapterIndex(activeProject.chapters.length);
  };

  const renderSaveIndicator = () => {
    switch (saveStatus) {
      case 'unsaved':
        return <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Unsaved</span>;
      case 'saving':
        return <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5">Saving...</span>;
      case 'saved':
        return <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Saved</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col overflow-hidden shadow-2xl`}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 sticky top-0 z-10 backdrop-blur-sm">
          <h1 className="text-xl font-bold text-rose-500">GalpoSagor <span className="text-xs font-normal text-slate-400 uppercase tracking-widest">AI</span></h1>
          <button onClick={createNewProject} className="p-1.5 bg-rose-600 hover:bg-rose-500 rounded-full transition shadow-lg shadow-rose-900/20" title="New Project">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          {activeProject && (
            <div className="space-y-6 animate-fade-in">
              <section>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-wider">Current Story Info</label>
                <input 
                  value={activeProject.title}
                  onChange={(e) => setActiveProject({...activeProject, title: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-rose-500 outline-none mb-2 font-medium"
                  placeholder="উপন্যাসের নাম"
                />
                <textarea 
                  value={activeProject.description}
                  onChange={(e) => setActiveProject({...activeProject, description: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:border-rose-500 outline-none h-20 resize-none"
                  placeholder="কাহিনী সংক্ষেপ (Brief plot)..."
                />
              </section>

              <section>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-wider">Novel Configuration</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400">Genre</span>
                    <select 
                      value={activeProject.genre}
                      onChange={(e) => setActiveProject({...activeProject, genre: e.target.value as StoryGenre})}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs outline-none"
                    >
                      <option>Romance</option>
                      <option>Adult/Erotica</option>
                      <option>Thriller</option>
                      <option>Drama</option>
                      <option>Historical</option>
                      <option>Mystery</option>
                      <option>Social</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400">Maturity</span>
                    <select 
                      value={activeProject.maturityLevel}
                      onChange={(e) => setActiveProject({...activeProject, maturityLevel: e.target.value as any})}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs outline-none"
                    >
                      <option>General</option>
                      <option>Adult</option>
                      <option>18+ Explicit</option>
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chapters</label>
                  <button onClick={addChapter} className="text-rose-500 hover:text-rose-400 text-[10px] font-bold uppercase tracking-tighter transition">+ Add Chapter</button>
                </div>
                <div className="space-y-1">
                  {activeProject.chapters.map((ch, idx) => (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChapterIndex(idx)}
                      className={`w-full text-left p-2 rounded text-xs transition relative group ${activeChapterIndex === idx ? 'bg-rose-600/20 text-rose-400 border border-rose-600/30 ring-1 ring-rose-600/20' : 'hover:bg-slate-800 text-slate-400'}`}
                    >
                      <span className="font-mono text-[9px] mr-2 opacity-50">{(idx + 1).toString().padStart(2, '0')}</span>
                      {ch.title || 'Untitled Chapter'}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Saved Projects List */}
          <section className="pt-4 border-t border-slate-800">
            <label className="text-[10px] font-bold text-slate-500 uppercase mb-3 block tracking-wider">Saved Manuscripts ({savedProjects.length})</label>
            <div className="space-y-2">
              {savedProjects.length === 0 ? (
                <p className="text-[11px] text-slate-600 italic px-1">No saved stories yet.</p>
              ) : (
                savedProjects.map(p => (
                  <div
                    key={p.id}
                    onClick={() => loadProject(p)}
                    className={`p-3 rounded-lg border cursor-pointer transition flex flex-col gap-1 relative group ${activeProject?.id === p.id ? 'bg-slate-800 border-rose-500/50' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="text-xs font-bold text-slate-200 truncate pr-4">{p.title}</h3>
                      <button 
                        onClick={(e) => deleteProject(p.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 p-1 transition-opacity absolute top-1 right-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[9px] text-slate-500 px-1.5 py-0.5 bg-slate-950 rounded uppercase tracking-tighter">{p.genre}</span>
                      <span className="text-[9px] text-slate-600 italic">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
        
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
           <p className="text-[9px] text-slate-600 uppercase tracking-widest font-medium">Bengali Suite Pro</p>
           <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-800 rounded transition" title="Toggle Sidebar">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            {activeProject && (
              <div className="flex items-center gap-4">
                 <input 
                  value={activeProject.chapters[activeChapterIndex].title}
                  onChange={(e) => {
                    const chs = [...activeProject.chapters];
                    chs[activeChapterIndex].title = e.target.value;
                    setActiveProject({...activeProject, chapters: chs});
                  }}
                  className="bg-transparent font-bold text-slate-200 focus:outline-none border-b border-transparent focus:border-rose-500 transition-colors px-1"
                />
                {renderSaveIndicator()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
             <button 
                onClick={() => handleSaveProject(false)}
                disabled={!activeProject || saveStatus === 'saving'}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-xs font-bold transition border border-slate-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                {saveStatus === 'saving' ? 'Saving...' : 'Save'}
              </button>

             <button 
                onClick={handleGenerate}
                disabled={!activeProject || isGenerating}
                className="bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 px-6 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 shadow-lg shadow-rose-900/20"
              >
                {isGenerating ? (
                   <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                   </>
                ) : 'AI Write Chapter'}
              </button>
              <button className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg font-bold text-sm transition text-slate-400 border border-slate-700">
                Export
              </button>
          </div>
        </header>

        {/* Editor Area */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          {error && (
            <div className={`mb-4 p-3 border text-sm rounded-lg animate-fade-in flex justify-between items-center ${error.includes("success") ? 'bg-emerald-900/30 border-emerald-800 text-emerald-200' : 'bg-red-900/30 border-red-800 text-red-200'}`}>
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-xs opacity-50 hover:opacity-100">✕</button>
            </div>
          )}
          
          {activeProject ? (
            <div className="flex-1 min-h-0 flex flex-col gap-4 animate-fade-in">
              <div className="grid grid-cols-4 gap-4 mb-2 p-3 bg-slate-900/30 rounded-xl border border-slate-800/50">
                 <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Creativity</label>
                    <input type="range" min="0.1" max="1" step="0.1" value={settings.creativity} onChange={(e) => setSettings({...settings, creativity: parseFloat(e.target.value)})} className="accent-rose-500 h-1" />
                 </div>
                 <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Story Tone</label>
                    <select 
                      value={settings.tone} 
                      onChange={(e) => setSettings({...settings, tone: e.target.value})} 
                      className="bg-slate-800 text-[10px] p-1.5 rounded border border-slate-700 focus:border-rose-500 outline-none"
                    >
                      <option value="Passionate and Intense">Passionate (তীব্র আবেগ)</option>
                      <option value="Suspenseful and Thrilling">Suspenseful (রোমাঞ্চকর)</option>
                      <option value="Melancholy and Sad">Melancholy (বিষাদময়)</option>
                      <option value="Romantic and Sweet">Romantic (রোমান্টিক)</option>
                      <option value="Erotic and Sensual">Erotic (উত্তেজনাপূর্ণ)</option>
                      <option value="Dramatic and Bold">Dramatic (নাটকীয়)</option>
                      <option value="Poetic and Flowery">Poetic (কাব্যিক)</option>
                      <option value="Mysterious and Dark">Mysterious (রহস্যময়)</option>
                      <option value="Action-packed and Fast">Action (অ্যাকশন)</option>
                    </select>
                 </div>
                 <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Chapter Length</label>
                    <select value={settings.length} onChange={(e) => setSettings({...settings, length: e.target.value as any})} className="bg-slate-800 text-[10px] p-1.5 rounded border border-slate-700 focus:border-rose-500 outline-none">
                      <option>Short</option>
                      <option>Medium</option>
                      <option>Long</option>
                      <option>Epic</option>
                    </select>
                 </div>
                 <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Language Style</label>
                    <select value={activeProject.languageStyle} onChange={(e) => setActiveProject({...activeProject, languageStyle: e.target.value as any})} className="bg-slate-800 text-[10px] p-1.5 rounded border border-slate-700 focus:border-rose-500 outline-none">
                      <option>Modern/Colloquial</option>
                      <option>Cholitobhasha</option>
                      <option>Sadhu</option>
                    </select>
                 </div>
              </div>
              
              <Editor 
                content={activeProject.chapters[activeChapterIndex].content}
                onChange={updateChapterContent}
                onRewrite={handleRewrite}
                isGenerating={isGenerating}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500 blur-3xl opacity-10 animate-pulse"></div>
                <div className="w-40 h-40 bg-slate-900 rounded-full flex items-center justify-center text-rose-500 border-2 border-slate-800 shadow-2xl relative z-10">
                  <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
              </div>
              <div className="max-w-xl">
                <h2 className="text-4xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-orange-300">কল্পসাগর এআই: আপনার গল্পের জগত</h2>
                <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                  আধুনিক এআই প্রযুক্তির সাহায্যে তৈরি করুন দীর্ঘ ও উন্নতমানের বাংলা উপন্যাস। রোমান্স, অ্যাডাল্ট ড্রামা এবং বাস্তবধর্মী বর্ণনায় সমৃদ্ধ কাহিনী রচনার এক অনন্য ডিজিটাল প্ল্যাটফর্ম।
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <button onClick={createNewProject} className="px-10 py-4 bg-rose-600 hover:bg-rose-500 rounded-full text-lg font-bold shadow-2xl shadow-rose-900/50 transition transform hover:scale-105 active:scale-95 flex items-center gap-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    নতুন কাহিনী শুরু করুন
                  </button>
                  {savedProjects.length > 0 && (
                     <div className="flex flex-col items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Continue writing</span>
                        <div className="flex gap-2">
                           {savedProjects.slice(0, 2).map(p => (
                             <button 
                                key={p.id}
                                onClick={() => loadProject(p)}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-2"
                             >
                               {p.title}
                             </button>
                           ))}
                        </div>
                     </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
