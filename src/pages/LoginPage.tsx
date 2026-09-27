import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  User,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Building2,
  Microscope,
} from 'lucide-react';
import { useAuth, MOCK_USERS } from '../contexts/AuthContext';
import IndiaFlag from '../components/IndiaFlag';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const urlRole = searchParams.get('role');
  const initialRole =
    urlRole === 'government'
      ? 'government'
      : urlRole === 'researcher'
        ? 'researcher'
        : 'general';

  const [role, setRole] = useState<'general' | 'government' | 'researcher'>(initialRole);
  const [loginId, setLoginId] = useState(MOCK_USERS[initialRole].email);
  const [password, setPassword] = useState(MOCK_USERS[initialRole].password);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, quickLogin, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === 'government') navigate('/dashboard');
      else if (user?.role === 'researcher') navigate('/dashboard');
      else navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  // Update credentials when role changes
  const handleSelectRole = (newRole: 'general' | 'government' | 'researcher') => {
    setRole(newRole);
    setError('');
    setLoginId(MOCK_USERS[newRole].email);
    setPassword(MOCK_USERS[newRole].password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(loginId, password, role);
    setLoading(false);
    if (success) {
      if (role === 'government') navigate('/gov');
      else if (role === 'researcher') navigate('/docs');
      else navigate('/dashboard');
    } else {
      setError('Invalid Login ID or password. Please verify your credentials or use 1-Click Fast Login.');
    }
  };

  const handleInstantQuickEnter = (chosenRole: 'general' | 'government' | 'researcher') => {
    quickLogin(chosenRole);
    if (chosenRole === 'government') navigate('/gov');
    else if (chosenRole === 'researcher') navigate('/docs');
    else navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#e8f1f8] text-slate-800 flex flex-col font-sans">
      {/* ── TOP OFFICIAL GOVERNMENT HEADER STRIP ── */}
      <header className="bg-white border-b border-slate-300 shadow-xs">
        <div className="bg-[#0b3b60] text-white py-1 px-4 text-[11px]">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IndiaFlag className="w-3.5 h-2.5" />
              <span className="font-semibold">भारत सरकार &bull; Government of India</span>
              <span className="opacity-40">|</span>
              <span className="opacity-90">पृथ्वी विज्ञान मंत्रालय &bull; Ministry of Earth Sciences</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[10px] text-slate-200">
              <span>National Ocean Information Portal</span>
              <span>&bull;</span>
              <span>NIC Secured Single Sign-On</span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/emblem-india.svg" alt="Emblem of India" className="h-10 w-auto object-contain" />
            <div className="border-l border-slate-300 pl-3">
              <h1 className="text-sm sm:text-base font-black text-[#0b3b60] leading-tight">
                भारतीय राष्ट्रीय महासागर सूचना सेवा केंद्र
              </h1>
              <p className="text-[11px] font-bold text-slate-700 leading-tight">
                Indian National Centre for Ocean Information Services (INCOIS)
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Back to Portal Home</span>
          </button>
        </div>
      </header>

      {/* ── MAIN LOGIN CONTAINER ── */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full flex flex-col items-center justify-center">
        {/* Page Title & Mission Badge */}
        <div className="text-center max-w-2xl mb-8 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/30 text-white text-xs font-bold shadow-xs backdrop-blur-md">
            <CheckCircle2 size={13} className="text-cyan-300" />
            <span>Single Sign-On Authentication Gateway</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm">
            <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
              National Ocean Intelligence Portal Login
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-sky-100/90 font-medium leading-relaxed">
            Select your clearance persona below to access real-time ocean intelligence, disaster advisories, or neural scientific documentation.
          </p>
        </div>

        {/* ── 3 PERSONA ROLE CARDS (Normal Citizen, Government, Researcher) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8">
          {/* 1. NORMAL CITIZEN */}
          <div
            onClick={() => handleSelectRole('general')}
            className={`bg-white rounded-lg p-5 border-2 transition-all cursor-pointer flex flex-col justify-between shadow-xs ${role === 'general'
                ? 'border-[#0b3b60] ring-2 ring-[#0b3b60]/20 bg-blue-50/40'
                : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#0b3b60] uppercase tracking-wider">
                  Public Access
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${role === 'general' ? 'border-[#0b3b60] bg-[#0b3b60]' : 'border-slate-300'}`}>
                  {role === 'general' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0b3b60] shrink-0">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Normal Citizen</h3>
                  <p className="text-[11px] text-slate-500 font-medium">General Public & Fisherfolk</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Explore 0–1000m subsurface temperature profiles, daily 7-day ocean forecasts, surface heat maps, and AI assistant.
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleInstantQuickEnter('general');
              }}
              className="w-full py-2 px-3 rounded bg-[#0b3b60] hover:bg-[#082a45] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <span>1-Click Citizen Login</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* 2. GOVERNMENT OFFICIAL */}
          <div
            onClick={() => handleSelectRole('government')}
            className={`bg-white rounded-lg p-5 border-2 transition-all cursor-pointer flex flex-col justify-between shadow-xs ${role === 'government'
                ? 'border-amber-600 ring-2 ring-amber-600/20 bg-amber-50/40'
                : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                  MoES / NDMA / IMD
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${role === 'government' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'}`}>
                  {role === 'government' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Government Official</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Disaster Authority & NDMA</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Access official NDMA disaster warnings, cyclone heat fuel alerts, coastal evacuation protocols, technical documentation & bulletin dispatch.
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleInstantQuickEnter('government');
              }}
              className="w-full py-2 px-3 rounded bg-[#d97706] hover:bg-[#b45309] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <Shield size={13} />
              <span>1-Click Gov Command</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* 3. RESEARCHERS & SCIENTISTS */}
          <div
            onClick={() => handleSelectRole('researcher')}
            className={`bg-white rounded-lg p-5 border-2 transition-all cursor-pointer flex flex-col justify-between shadow-xs ${role === 'researcher'
                ? 'border-purple-600 ring-2 ring-purple-600/20 bg-purple-50/40'
                : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 uppercase tracking-wider">
                  Academic & R&amp;D
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${role === 'researcher' ? 'border-purple-600 bg-purple-600' : 'border-slate-300'}`}>
                  {role === 'researcher' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-800 shrink-0">
                  <Microscope size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Researchers & Scientists</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Oceanographers & ML Engineers</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Access deep learning neural documentation, 15-depth MLP loss equations, ARGO float matchups, and raw NetCDF pipeline.
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleInstantQuickEnter('researcher');
              }}
              className="w-full py-2 px-3 rounded bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <BookOpen size={13} />
              <span>1-Click Researcher Login</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* ── AUTHENTICATION FORM CARD ── */}
        <div className="bg-white rounded-lg border border-slate-300 p-6 sm:p-8 shadow-sm w-full max-w-xl">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Sign In &bull; {role === 'government' ? 'Government Official' : role === 'researcher' ? 'Researcher / Scientist' : 'Normal Citizen'}
              </h3>
              <p className="text-xs text-slate-500">Enter your Login ID and password, or use Fast Login above</p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Demo Active
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                <AlertCircle size={15} className="text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Login ID
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Enter your Login ID"
                  autoComplete="username"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 pl-9 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0b3b60] focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setLoginId(MOCK_USERS[role].email);
                    setPassword(MOCK_USERS[role].password);
                  }}
                  className="text-[11px] text-[#0b3b60] hover:underline font-semibold"
                >
                  Load {role} credentials
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 pl-9 pr-9 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0b3b60] focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-xs ${role === 'government'
                  ? 'bg-[#d97706] hover:bg-[#b45309]'
                  : role === 'researcher'
                    ? 'bg-purple-700 hover:bg-purple-800'
                    : 'bg-[#0b3b60] hover:bg-[#082a45]'
                }`}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Sign In as {role === 'government' ? 'Government Official' : role === 'researcher' ? 'Researcher' : 'Citizen'}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Demo accounts pre-configured</span>
            <span className="font-semibold text-slate-700">SSL 256-Bit Encrypted</span>
          </div>
        </div>

        {/* ── CURRENT TESTING STATUS ── */}
        <section className="w-full max-w-5xl mt-6">
          <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Current Testing
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Modules currently available in the OceanEmbed evaluation build.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                <CheckCircle2 size={11} />
                Available
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[
                { name: 'Dashboard', detail: 'Ocean intelligence', icon: Shield },
                { name: 'Forecast', detail: '7-day forecast', icon: ArrowRight },
                { name: 'Heatmap', detail: 'Depth maps', icon: CheckCircle2 },
                { name: 'Ocean Profile', detail: '15-depth profile', icon: User },
                { name: 'XAI', detail: 'Model explanations', icon: BookOpen },
                { name: 'Gov Console', detail: 'Alerts & risk', icon: Building2 },
              ].map(({ name, detail, icon: Icon }) => (
                <div
                  key={name}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 hover:border-[#0b3b60]/40 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <Icon size={14} className="text-[#0b3b60]" />
                    <span className="text-[9px] font-bold text-emerald-700 uppercase">
                      Ready
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-slate-800">{name}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-200 border-t border-slate-300 py-4 px-4 text-center text-xs text-slate-600">
        <div className="max-w-4xl mx-auto space-y-1">
          <p className="font-medium">
            &copy; 2026 Indian National Centre for Ocean Information Services (INCOIS), Ministry of Earth Sciences, Govt. of India.
          </p>
          <p className="text-[11px] text-slate-500">
            Smart India Hackathon (SIH 2026) &bull; Problem Statement 66: Subsurface Ocean Thermal Intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}
