
import React, { useState, useEffect, useRef } from 'react';
import { ProjectRecord, Language, LocationType, User } from './types';
import { TRANSLATIONS, BUILDING_TYPES, COLORS, CULTURE_MODES } from './constants';
import { Navbar, Footer } from './components/Layout';
import { Chatbot } from './components/Chatbot';
import { PlotVisualizer } from './components/Visualizer';
import { getArchitecturalAnalysis, generateBuildingRenders, analyzePlotImage } from './services/gemini';
import { 
  Plus, Camera, LayoutGrid, ChevronRight, Briefcase, 
  BarChart3, Clock, Building2, Upload, X, ZoomIn, Info, RefreshCw, Sparkles, User as UserIcon,
  Circle, Image as ImageIcon, ArrowRight, CheckCircle2, DollarSign, Maximize2, LogOut, Loader2, Trash2, Hash
} from 'lucide-react';

const INITIAL_PROJECTS: ProjectRecord[] = [
  {
    id: 'ZB-7F9K2L',
    clientName: 'Suresh Kumar',
    buildingName: 'Skyline Mansion',
    date: '10/05/2026',
    totalArea: 4500,
    length: 50,
    breadth: 90,
    buildingType: 'modernVilla',
    location: LocationType.URBAN,
    budget: '$1,200,000',
    mainColor: '#475569',
    style: 'contemporary',
    floors: 3,
    afterImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800'
  }
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<{ role: 'CLIENT' | 'DEVELOPER'; mode: 'login' | 'register' } | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [projects, setProjects] = useState<ProjectRecord[]>(INITIAL_PROJECTS);
  const [currentProject, setCurrentProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'analytics'>('dashboard');

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<ProjectRecord>>({
    buildingName: '',
    clientName: '',
    totalArea: 2400,
    length: 60,
    breadth: 40,
    buildingType: BUILDING_TYPES[0],
    location: LocationType.URBAN,
    budget: '$250,000',
    mainColor: COLORS[0].value,
    style: CULTURE_MODES[0],
    floors: 2
  });

  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(err => console.error("Video play failed:", err));
    }
  }, [isCameraOpen]);

  useEffect(() => {
    if (formData.length && formData.breadth) {
      const area = formData.length * formData.breadth;
      if (area !== formData.totalArea) setFormData(p => ({ ...p, totalArea: area }));
    }
  }, [formData.length, formData.breadth]);

  const handleAreaChange = (val: number) => {
    setFormData(p => {
      const l = p.length || Math.sqrt(val);
      const b = val / l;
      return { ...p, totalArea: val, breadth: parseFloat(b.toFixed(1)) };
    });
  };

  const generateUniqueId = () => {
    return `ZB-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  };

  const handleNewProject = () => {
    setFormData({
      buildingName: '',
      clientName: currentUser?.fullName || '',
      totalArea: 2400,
      length: 60,
      breadth: 40,
      buildingType: BUILDING_TYPES[0],
      location: LocationType.URBAN,
      budget: '$250,000',
      mainColor: COLORS[0].value,
      style: CULTURE_MODES[0],
      floors: 2
    });
    setPreviewImage(null);
    setCurrentProject(null);
    setViewMode('dashboard');
    setTimeout(() => {
       const dashboard = document.getElementById('main-content');
       if(dashboard) dashboard.classList.add('animate-in', 'fade-in', 'slide-in-from-top-4');
    }, 10);
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (currentProject?.id === id) {
      setCurrentProject(null);
      setViewMode('dashboard');
    }
  };

  const deleteAllProjects = () => {
    if (window.confirm("Are you sure you want to clear all projects from the registry? This action cannot be undone.")) {
      setProjects([]);
      setCurrentProject(null);
      setViewMode('dashboard');
      // Ensure the state is truly empty by force updating if needed
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const { username, password } = credentials;
    const role = authView?.role || 'CLIENT';

    let success = false;
    if (role === 'CLIENT' && username === 'client@zerobuild.ai' && password === '123456') success = true;
    if (role === 'DEVELOPER' && username === 'admin@zerobuild.ai' && password === '789000') success = true;

    if (success) {
      setCurrentUser({
        id: Math.random().toString(36).substr(2, 9),
        username: username,
        role: role,
        fullName: username.split('@')[0]
      });
      setAuthView(null);
      setViewMode('dashboard');
    } else {
      alert("Invalid Credentials. Please check the login hints.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthView(null);
    setCurrentProject(null);
    setPreviewImage(null);
    setCredentials({ username: '', password: '' });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (err) {
      alert("Camera access denied or device not found.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      setIsFlashing(true);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        setPreviewImage(base64);
        setTimeout(() => {
          setIsFlashing(false);
          stopCamera();
        }, 150);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateProject = async () => {
    if (!formData.buildingName || !formData.totalArea) {
      alert("Please enter project details.");
      return;
    }
    setIsLoading(true);
    try {
      const result: ProjectRecord = {
        ...formData as ProjectRecord,
        id: generateUniqueId(),
        clientName: formData.clientName || 'Private Client',
        date: new Date().toLocaleDateString()
      };
      
      // Execute architectural analysis and render generation in parallel
      const [renders, analysisText] = await Promise.all([
        generateBuildingRenders(result, previewImage),
        getArchitecturalAnalysis(result, lang)
      ]);
      
      const finalProject = { 
        ...result, 
        beforeImage: previewImage || renders.before,
        afterImage: renders.after, 
        constructionSteps: analysisText 
      };
      
      // Simulated delay for premium synthesis feeling
      await new Promise(r => setTimeout(r, 1500));
      
      setCurrentProject(finalProject);
      setProjects(prev => [finalProject, ...prev]);
      setViewMode('analytics');
    } catch (err: any) {
      console.error("Generation failed", err);
      alert(err.message || "AI Synthesis encountered an error. The model might be busy. Please try again in a few moments.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    if (!authView) {
      return (
        <div className="min-h-screen bg-[#020617] flex flex-col">
          <Navbar lang={lang} onLangChange={setLang} onHistoryClick={() => setShowHistory(true)} onLogout={handleLogout} isLoggedIn={false} />
          <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.08),transparent)] pointer-events-none"></div>
            <div className="w-full max-w-7xl flex flex-col lg:flex-row items-center justify-between gap-16 relative z-10">
              <div className="flex-1 text-center lg:text-left animate-in slide-in-from-left-12 duration-1000">
                <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white mb-12 mx-auto lg:mx-0 shadow-2xl shadow-indigo-500/40 transform hover:rotate-6 transition-transform cursor-pointer">
                  <Building2 size={56} />
                </div>
                <h1 className="text-8xl md:text-[11rem] font-black text-white heading-font tracking-tighter leading-[0.75] mb-12 select-none">
                  {TRANSLATIONS.appName[lang]}
                </h1>
                <p className="text-slate-400 text-2xl md:text-3xl font-medium max-w-3xl mx-auto lg:mx-0 leading-relaxed opacity-80">
                  {TRANSLATIONS.heroSubtitle[lang]}
                </p>
              </div>
              <div className="w-full lg:w-[520px] space-y-6 animate-in slide-in-from-right-12 duration-1000 delay-300">
                <div className="mb-8 text-center lg:text-left">
                  <p className="text-indigo-400 font-black uppercase tracking-[0.4em] text-sm mb-2">Select Workspace</p>
                  <div className="h-1 w-24 bg-indigo-600 rounded-full mx-auto lg:mx-0"></div>
                </div>
                {[
                  { role: 'CLIENT', label: TRANSLATIONS.clientLogin[lang], desc: 'Access your dream home portfolio', hint: 'client@zerobuild.ai / 123456', icon: UserIcon },
                  { role: 'DEVELOPER', label: TRANSLATIONS.devLogin[lang], desc: 'Professional site synthesis & registry', hint: 'admin@zerobuild.ai / 789000', icon: Briefcase }
                ].map((item, idx) => (
                  <button 
                    key={item.role}
                    onClick={() => setAuthView({ role: item.role as any, mode: 'login' })} 
                    style={{ animationDelay: `${idx * 150}ms` }}
                    className={`group w-full p-10 bg-[#0f172a]/80 backdrop-blur-2xl border border-slate-800/80 rounded-[3rem] hover:border-indigo-500 hover:bg-slate-800/40 transition-all text-left flex items-center gap-10 shadow-2xl active:scale-[0.98] animate-in slide-in-from-bottom-6 duration-700`}
                  >
                    <div className={`w-24 h-24 bg-slate-900 border border-slate-800 rounded-[2rem] flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner`}>
                      <item.icon size={40} />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-white mb-2 heading-font">{item.label}</h3>
                      <p className="text-slate-400 text-sm font-medium mb-3 opacity-60">{item.desc}</p>
                      <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">{item.hint}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col">
        <Navbar lang={lang} onLangChange={setLang} onHistoryClick={() => setShowHistory(true)} onLogout={handleLogout} isLoggedIn={false} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 p-12 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-500">
            <button onClick={() => setAuthView(null)} className="absolute top-8 left-8 text-slate-500 hover:text-white transition-colors flex items-center gap-2 font-bold uppercase text-xs tracking-widest group">
              <ChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={16} /> {TRANSLATIONS.back[lang]}
            </button>
            <div className="mt-8 mb-10 text-center">
              <h2 className="text-3xl font-black text-white heading-font">
                {authView.role === 'CLIENT' ? TRANSLATIONS.clientLogin[lang] : TRANSLATIONS.devLogin[lang]}
              </h2>
              <p className="text-slate-500 mt-2 font-medium tracking-wide uppercase text-[10px]">Verified Credentials Required</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" placeholder={TRANSLATIONS.username[lang]} className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl p-5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:opacity-50" value={credentials.username} onChange={e => setCredentials(p => ({ ...p, username: e.target.value }))} />
              <input type="password" placeholder={TRANSLATIONS.password[lang]} className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl p-5 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:opacity-50" value={credentials.password} onChange={e => setCredentials(p => ({ ...p, password: e.target.value }))} />
              <button type="submit" className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xl uppercase tracking-widest transition-all shadow-xl active:scale-[0.98]">
                {TRANSLATIONS.accessPortal[lang]}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <Navbar lang={lang} onLangChange={setLang} onHistoryClick={() => setShowHistory(true)} onLogout={handleLogout} isLoggedIn={true} />
      
      {isLoading && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
           <div className="relative mb-12">
              <div className="absolute inset-0 bg-indigo-600 rounded-full blur-[100px] opacity-20 animate-pulse"></div>
              <div className="w-32 h-32 border-[12px] border-slate-800 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Building2 className="text-white animate-bounce" size={40} />
              </div>
           </div>
           <div className="text-center space-y-4">
              <h2 className="text-4xl font-black text-white heading-font tracking-tight uppercase animate-in slide-in-from-bottom-4">Generating Realistic Render</h2>
              <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-sm opacity-60">Architectural photography synthesis in progress...</p>
           </div>
           <div className="mt-12 flex gap-2">
              {[0, 1, 2].map(i => <div key={i} className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />)}
           </div>
        </div>
      )}

      <div className="flex">
        <aside className="hidden lg:flex w-72 flex-col bg-[#0f172a]/40 border-r border-slate-800 h-[calc(100vh-80px)] p-6 gap-2 sticky top-[80px]">
          <button onClick={() => { setViewMode('dashboard'); setCurrentProject(null); }} className={`flex items-center gap-4 w-full p-5 rounded-[1.5rem] transition-all duration-300 ${viewMode === 'dashboard' ? 'bg-indigo-600/20 text-white border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}>
            <LayoutGrid size={22} /><span className="font-bold">{TRANSLATIONS.dashboard[lang]}</span>
          </button>
          <button onClick={() => setViewMode('analytics')} className={`flex items-center gap-4 w-full p-5 rounded-[1.5rem] transition-all duration-300 ${viewMode === 'analytics' ? 'bg-indigo-600/20 text-white border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}>
            <BarChart3 size={22} /><span className="font-bold">{TRANSLATIONS.analysis[lang]}</span>
          </button>
          <button onClick={() => setShowHistory(true)} className="flex items-center gap-4 w-full p-5 rounded-[1.5rem] text-slate-400 hover:bg-slate-800/50 hover:text-white transition-all duration-300">
            <Clock size={22} /><span className="font-bold">{TRANSLATIONS.history[lang]}</span>
          </button>
        </aside>

        <main id="main-content" className="flex-1 p-10 overflow-x-hidden">
          {viewMode === 'dashboard' && !currentProject ? (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-16 max-w-7xl mx-auto">
              <header className="flex justify-between items-end">
                <div className="space-y-2">
                   <h2 className="text-5xl font-black text-white heading-font tracking-tight">Project Registry</h2>
                   <p className="text-slate-500 text-xl font-medium">Harnessing generative AI for high-fidelity architectural planning.</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={handleNewProject} 
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-3"
                  >
                    <Plus size={24} /> New Project
                  </button>
                </div>
              </header>

              <div className="grid lg:grid-cols-12 gap-12">
                <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-[3.5rem] p-12 space-y-10 shadow-2xl hover:border-slate-700 transition-colors">
                  <div className="space-y-8">
                     <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => fileInputRef.current?.click()} className="group bg-slate-800 hover:bg-slate-700 text-white p-6 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all border border-slate-700 active:scale-95">
                           <Upload size={24} className="group-hover:scale-110 transition-transform" /> Upload Plot
                           <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                        </button>
                        <button onClick={startCamera} className="group bg-slate-800 hover:bg-slate-700 text-white p-6 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all border border-slate-700 active:scale-95">
                           <Camera size={24} className="group-hover:scale-110 transition-transform" /> Capture
                        </button>
                     </div>

                     <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-4">
                           <input type="text" placeholder={TRANSLATIONS.buildingName[lang]} className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:opacity-40" value={formData.buildingName} onChange={e => setFormData(p => ({ ...p, buildingName: e.target.value }))} />
                           <input type="text" placeholder={TRANSLATIONS.clientName[lang]} className="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:opacity-40" value={formData.clientName} onChange={e => setFormData(p => ({ ...p, clientName: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                           <input type="number" placeholder={TRANSLATIONS.length[lang]} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={formData.length} onChange={e => setFormData(p => ({ ...p, length: Number(e.target.value) }))} />
                           <input type="number" placeholder={TRANSLATIONS.breadth[lang]} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={formData.breadth} onChange={e => setFormData(p => ({ ...p, breadth: Number(e.target.value) }))} />
                           <input type="number" placeholder={TRANSLATIONS.plotArea[lang]} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={formData.totalArea} onChange={e => handleAreaChange(Number(e.target.value))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={formData.buildingType} onChange={e => setFormData(p => ({ ...p, buildingType: e.target.value }))}>
                              {BUILDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                           </select>
                           <input type="text" placeholder={TRANSLATIONS.budget[lang]} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={formData.budget} onChange={e => setFormData(p => ({ ...p, budget: e.target.value }))} />
                        </div>
                     </div>
                     
                     <button onClick={generateProject} disabled={isLoading} className="group w-full bg-indigo-600 hover:bg-indigo-500 text-white p-6 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all shadow-2xl active:scale-95 disabled:opacity-50">
                        {isLoading ? <RefreshCw className="animate-spin" size={24} /> : <><Sparkles size={24} className="group-hover:rotate-12 transition-transform" /> {TRANSLATIONS.generate[lang]}</>}
                     </button>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-[3.5rem] p-12 overflow-hidden flex flex-col items-center justify-center text-center shadow-2xl relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent pointer-events-none group-hover:opacity-100 opacity-50 transition-opacity"></div>
                  {previewImage ? (
                    <div className="relative w-full h-full group/preview">
                       <img src={previewImage} className="w-full h-full object-cover rounded-[2rem] border border-slate-800 animate-in fade-in duration-500" alt="Site" />
                       <button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 p-4 bg-red-600/90 text-white rounded-full hover:bg-red-500 transition-all active:scale-95 shadow-xl opacity-0 group-hover/preview:opacity-100"><X size={20}/></button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="w-32 h-32 bg-slate-800 rounded-[2.5rem] flex items-center justify-center text-slate-500 group-hover:bg-indigo-600/20 group-hover:text-indigo-400 transition-all duration-700 mx-auto">
                        <ImageIcon size={64} className="group-hover:scale-110 transition-transform duration-500" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-3xl font-black text-white heading-font">Visualize Site</h4>
                        <p className="text-slate-500 max-w-sm font-medium mx-auto">Capture or upload a plot photo to trigger architectural extrapolation.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : viewMode === 'analytics' || currentProject ? (
            <div className="animate-in fade-in slide-in-from-right-12 duration-700 space-y-16 max-w-7xl mx-auto">
              <header className="flex justify-between items-center">
                 <div className="space-y-2">
                    <h2 className="text-5xl font-black text-white heading-font tracking-tight">Analysis & Insights</h2>
                    <p className="text-slate-500 text-xl font-medium italic">Architectural Audit for <span className="text-indigo-400 font-black not-italic">{currentProject?.buildingName || 'Selected Project'}</span></p>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={handleNewProject} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-3">
                      <Plus size={24} /> New Project
                    </button>
                    <button onClick={() => { setViewMode('dashboard'); setCurrentProject(null); }} className="group flex items-center gap-4 px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest border border-slate-700 active:scale-95 transition-all shadow-xl">
                      <ChevronRight className="rotate-180 group-hover:-translate-x-2 transition-transform" size={24} /> Back to Registry
                    </button>
                 </div>
              </header>
              {currentProject ? (
                <div className="grid lg:grid-cols-12 gap-12">
                   <div className="lg:col-span-5 space-y-10 animate-in slide-in-from-left-8 duration-700 delay-100">
                      <div className="bg-slate-900/90 backdrop-blur-3xl border border-slate-800 rounded-[3.5rem] p-12 space-y-10 shadow-2xl">
                         <div className="flex items-center gap-4 text-white">
                            <div className="w-12 h-12 bg-indigo-600/20 rounded-2xl flex items-center justify-center text-indigo-400"><Info size={28} /></div>
                            <h4 className="text-3xl font-black heading-font">Synthesis Steps</h4>
                         </div>
                         <div className="space-y-6">
                            {currentProject.constructionSteps?.split('\n').filter(s => s.trim()).map((step, idx) => (
                              <div key={idx} 
                                style={{ animationDelay: `${idx * 150 + 400}ms` }}
                                className="flex gap-6 items-start bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:bg-slate-800/50 hover:border-indigo-500/30 transition-all cursor-default animate-in slide-in-from-left-4">
                                 <span className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-xl">{idx + 1}</span>
                                 <p className="text-slate-200 leading-relaxed font-bold text-lg">{step}</p>
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                   <div className="lg:col-span-7 space-y-10 animate-in slide-in-from-bottom-8 duration-700 delay-300">
                      <div className="relative group overflow-hidden rounded-[4rem] border border-indigo-600/30 shadow-2xl cursor-zoom-in hover:shadow-indigo-500/20 transition-all" onClick={() => setIsZoomed(true)}>
                         <img src={currentProject.afterImage} className="w-full h-auto object-cover group-hover:scale-110 transition-transform duration-[2000ms]" alt="Result" />
                         <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-transparent to-transparent p-16 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                            <div className="flex items-end justify-between w-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-700">
                               <div>
                                  <h4 className="text-white font-black text-6xl heading-font tracking-tighter">{currentProject.buildingName}</h4>
                                  <p className="text-indigo-400 font-black text-sm uppercase tracking-widest mt-2 flex items-center gap-2">
                                     <Hash size={14} /> {currentProject.id}
                                  </p>
                               </div>
                               <p className="text-slate-300 font-bold text-xl flex items-center gap-4">
                                  <CheckCircle2 className="text-emerald-400" size={28} /> AI Structural Optimization Active
                               </p>
                            </div>
                         </div>
                         {currentProject.beforeImage && (
                           <div className="absolute top-10 left-10 w-48 h-32 rounded-3xl border-2 border-white/20 overflow-hidden shadow-2xl group/before hover:scale-105 transition-transform">
                              <img src={currentProject.beforeImage} className="w-full h-full object-cover" alt="Original Site" />
                              <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-md p-2 text-center">
                                <p className="text-[10px] font-black text-white uppercase tracking-widest">Original Site</p>
                              </div>
                           </div>
                         )}
                         <div className="absolute inset-0 border-[20px] border-white/5 pointer-events-none rounded-[4rem]"></div>
                      </div>
                      <div className="grid grid-cols-3 gap-6">
                        {[
                          { label: 'Site Area', value: `${currentProject.totalArea} sqft`, icon: Maximize2, delay: 500 },
                          { label: 'Floors', value: currentProject.floors, icon: Building2, delay: 600 },
                          { label: 'Cost Basis', value: currentProject.budget, icon: DollarSign, delay: 700 }
                        ].map((item, i) => (
                          <div key={i} 
                            style={{ animationDelay: `${item.delay}ms` }}
                            className="bg-slate-900/60 border border-slate-800 p-8 rounded-[2.5rem] text-center space-y-3 hover:border-indigo-500/40 hover:bg-slate-800/80 transition-all animate-in zoom-in-95 shadow-xl">
                              <item.icon size={32} className="mx-auto text-indigo-500 mb-2" />
                              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{item.label}</p>
                              <p className="text-2xl font-black text-white heading-font">{item.value}</p>
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>

      <Chatbot currentProject={currentProject} lang={lang} />
      <Footer lang={lang} />

      {isCameraOpen && (
        <div className="fixed inset-0 z-[1200] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
          <div className="relative w-full max-w-5xl aspect-video bg-slate-900 rounded-[4rem] overflow-hidden border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-500">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {isFlashing && <div className="absolute inset-0 bg-white z-[1210] animate-in fade-in out-fade-out duration-150" />}
            <div className="absolute inset-x-0 bottom-12 flex justify-center items-center gap-16 z-[1220]">
               <button onClick={stopCamera} className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 border border-white/20 active:scale-90 transition-all">
                 <X size={36} />
               </button>
               <button onClick={capturePhoto} className="w-28 h-28 rounded-full bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-500 shadow-2xl border-[6px] border-white active:scale-90 transition-all group">
                 <Circle size={56} fill="white" className="group-hover:scale-110 transition-transform" />
               </button>
            </div>
          </div>
        </div>
      )}

      {isZoomed && currentProject && (
        <div className="fixed inset-0 z-[1500] bg-black/99 backdrop-blur-3xl flex items-center justify-center p-12 cursor-zoom-out animate-in fade-in duration-300" onClick={() => setIsZoomed(false)}>
           <img src={currentProject.afterImage} className="max-w-full max-h-full object-contain rounded-3xl animate-in zoom-in-95 duration-500 shadow-2xl" alt="Full Resolution" />
           <button className="absolute top-12 right-12 text-white p-6 rounded-full hover:bg-white/10 transition-colors"><X size={48}/></button>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center p-10 animate-in fade-in duration-500">
           <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-[4rem] shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-500">
              <div className="p-12 border-b border-slate-800 flex justify-between items-center bg-slate-800/40">
                 <h3 className="text-4xl font-black text-white heading-font tracking-tight">Project Registry</h3>
                 <div className="flex gap-4">
                    <button 
                      onClick={deleteAllProjects} 
                      className="bg-red-900/20 text-red-400 border border-red-900/30 px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-red-600 hover:text-white active:scale-95 transition-all flex items-center gap-2"
                    >
                       <X size={16} /> Clear All
                    </button>
                    <button onClick={() => setShowHistory(false)} className="bg-slate-800 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-700 active:scale-95 transition-all">Close Vault</button>
                 </div>
              </div>
              <div className="p-12 overflow-y-auto max-h-[75vh] space-y-6">
                 {projects.length === 0 ? (
                    <div className="text-center py-20 opacity-40">
                       <LayoutGrid size={64} className="mx-auto mb-4" />
                       <p className="font-black uppercase tracking-widest">Registry is Empty</p>
                    </div>
                 ) : projects.map((p, idx) => (
                   <div key={p.id} 
                     style={{ animationDelay: `${idx * 100}ms` }}
                     className="bg-slate-800/30 border border-slate-800/50 p-8 rounded-[2.5rem] flex items-center justify-between group hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all cursor-pointer animate-in slide-in-from-bottom-6" 
                     onClick={() => { setCurrentProject(p); setShowHistory(false); setViewMode('analytics'); }}>
                      <div className="flex items-center gap-8">
                         <div className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-700 shadow-inner group-hover:scale-105 transition-transform"><img src={p.afterImage} className="w-full h-full object-cover" /></div>
                         <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                               <p className="text-white font-black text-2xl">{p.buildingName}</p>
                               <span className="bg-slate-900 px-3 py-1 rounded-full text-indigo-400 text-[10px] font-black tracking-widest border border-slate-700">ID: {p.id}</span>
                            </div>
                            <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em] mt-1">{p.clientName} • {p.date}</p>
                         </div>
                      </div>
                      <div className="flex gap-3">
                         <button 
                           onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                           className="p-4 bg-red-900/20 text-red-400 border border-red-900/30 rounded-xl hover:bg-red-600 hover:text-white transition-all active:scale-95"
                           title="Delete Project"
                         >
                            <Trash2 size={18} />
                         </button>
                         <button className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest group-hover:bg-indigo-500 transition-colors active:scale-95">Audit Site</button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
