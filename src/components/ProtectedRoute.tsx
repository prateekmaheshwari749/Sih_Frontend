import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Shield, LogIn, FileText, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageLayout from './PageLayout';

interface ProtectedRouteProps {
  children: ReactNode;
  requiresGovernment?: boolean;
  requiresDocs?: boolean;
}

export default function ProtectedRoute({
  children,
  requiresGovernment = false,
  requiresDocs = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isGovernment, isResearcher, quickLogin } = useAuth();
  const navigate = useNavigate();

  // Not logged in at all
  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-140px)] py-12">
          <div className="glass-panel rounded-3xl p-8 sm:p-10 border border-white/10 text-center max-w-md w-full mx-4 depth-shadow fade-in-up">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-cyan-500/20">
              <Lock size={28} className="text-cyan-400" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Restricted Access Portal</h2>
            <p className="text-white/50 text-xs sm:text-sm mb-6 leading-relaxed">
              {requiresGovernment
                ? 'The Government Emergency Operations Portal is restricted to verified disaster response personnel (NDMA/IMD).'
                : requiresDocs
                ? 'Technical Architecture and Model Specifications are restricted to Government Officials and Research Scientists.'
                : 'Authentication is required to access this portal.'}
            </p>

            <div className="space-y-3">
              {/* Quick Persona Access for Testing */}
              {requiresGovernment && (
                <button
                  onClick={() => {
                    quickLogin('government');
                  }}
                  className="w-full btn-primary-cyan flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm cursor-pointer shadow-lg shadow-yellow-500/20"
                  style={{ background: 'linear-gradient(180deg, #eab308 0%, #ca8a04 100%)', borderColor: '#fde047' }}
                >
                  <Shield size={16} />
                  Authenticate as NDMA Officer (1-Click)
                </button>
              )}

              {requiresDocs && (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      quickLogin('government');
                    }}
                    className="w-full btn-primary-cyan flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm cursor-pointer shadow-lg shadow-yellow-500/20"
                    style={{ background: 'linear-gradient(180deg, #eab308 0%, #ca8a04 100%)', borderColor: '#fde047' }}
                  >
                    <Shield size={16} />
                    Authenticate as NDMA Officer (1-Click)
                  </button>
                  <button
                    onClick={() => {
                      quickLogin('researcher');
                    }}
                    className="w-full btn-primary-cyan flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm cursor-pointer shadow-lg shadow-purple-500/20"
                    style={{ background: 'linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%)', borderColor: '#c084fc' }}
                  >
                    <FileText size={16} />
                    Authenticate as Research Scientist (1-Click)
                  </button>
                </div>
              )}

              <button
                onClick={() => navigate(requiresGovernment ? '/login?role=government' : '/login')}
                className="w-full btn-glass flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white cursor-pointer"
              >
                <LogIn size={16} />
                Sign In with Credentials
              </button>

              <button
                onClick={() => navigate('/')}
                className="w-full text-xs text-white/40 hover:text-white pt-2 transition-colors inline-flex items-center justify-center gap-1"
              >
                Return to Public Ocean Portal <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Logged in but wrong role for government pages
  if (requiresGovernment && !isGovernment) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-140px)] py-12">
          <div className="glass-panel rounded-3xl p-8 sm:p-10 border border-yellow-500/30 text-center max-w-md w-full mx-4 depth-shadow fade-in-up">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-yellow-500/20">
              <Shield size={28} className="text-yellow-400" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Government Clearance Required</h2>
            <p className="text-white/50 text-xs sm:text-sm mb-6 leading-relaxed">
              Your current account does not have National Disaster Early Warning authorization. Only IMD & NDMA government credentials can access this portal.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => quickLogin('government')}
                className="w-full btn-primary-cyan flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm cursor-pointer shadow-lg shadow-yellow-500/20"
                style={{ background: 'linear-gradient(180deg, #eab308 0%, #ca8a04 100%)', borderColor: '#fde047' }}
              >
                <Shield size={16} />
                Switch to Government Officer (1-Click)
              </button>

              <button
                onClick={() => navigate('/login?role=government')}
                className="w-full btn-glass flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white cursor-pointer"
              >
                Log In with Government ID
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                className="w-full text-xs text-white/40 hover:text-white pt-2 transition-colors inline-flex items-center justify-center gap-1"
              >
                Back to Public Dashboard <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Logged in but wrong role for technical documentation
  if (requiresDocs && !isResearcher && !isGovernment) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-140px)] py-12">
          <div className="glass-panel rounded-3xl p-8 sm:p-10 border border-purple-500/30 text-center max-w-md w-full mx-4 depth-shadow fade-in-up">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-purple-500/20">
              <FileText size={28} className="text-purple-400" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Government / Researcher Clearance Required</h2>
            <p className="text-white/50 text-xs sm:text-sm mb-6 leading-relaxed">
              The Technical Documentation and Model Tensor specifications are restricted to authorized Government Officials, Disaster Authorities, and Research Scientists.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => quickLogin('government')}
                className="w-full btn-primary-cyan flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm cursor-pointer shadow-lg shadow-yellow-500/20"
                style={{ background: 'linear-gradient(180deg, #eab308 0%, #ca8a04 100%)', borderColor: '#fde047' }}
              >
                <Shield size={16} />
                Switch to NDMA Officer (1-Click)
              </button>

              <button
                onClick={() => quickLogin('researcher')}
                className="w-full btn-primary-cyan flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm cursor-pointer shadow-lg shadow-purple-500/20"
                style={{ background: 'linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%)', borderColor: '#c084fc' }}
              >
                <FileText size={16} />
                Switch to Research Scientist (1-Click)
              </button>

              <button
                onClick={() => navigate('/login')}
                className="w-full btn-glass flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white cursor-pointer"
              >
                Sign In with Authorized Credentials
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                className="w-full text-xs text-white/40 hover:text-white pt-2 transition-colors inline-flex items-center justify-center gap-1"
              >
                Back to Public Dashboard <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return <>{children}</>;
}
