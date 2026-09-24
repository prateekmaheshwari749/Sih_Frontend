import { Suspense, lazy, type ComponentType } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import { WaterCursorTrail, BubbleClickEffect } from './components/WaterEffects';
import CommonOceanBackground from './components/CommonOceanBackground';

import './styles/ocean-page.css';

// Eagerly loaded
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import XAIFloatingPopup from './components/XAIFloatingPopup';
import BackendStatusBanner from './components/BackendStatusBanner';

/**
 * Smart resilient lazy-loader that gracefully handles Vite "504 Outdated Optimize Dep"
 * or stale dynamic chunk errors when the dev server re-bundles dependencies.
 */
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      window.sessionStorage.removeItem('vite_chunk_reload');
      return mod;
    } catch (error) {
      const hasReloaded = window.sessionStorage.getItem('vite_chunk_reload');
      if (!hasReloaded) {
        window.sessionStorage.setItem('vite_chunk_reload', 'true');
        window.location.reload();
        return new Promise(() => {});
      }
      window.sessionStorage.removeItem('vite_chunk_reload');
      throw error;
    }
  });
}

// Lazy loaded pages with automatic cache recovery
const ChatPage            = lazyWithRetry(() => import('./pages/ChatPage'));
const InputPage           = lazyWithRetry(() => import('./pages/InputPage'));
const WorldMapPage        = lazyWithRetry(() => import('./pages/WorldMapPage'));
const DashboardPage       = lazyWithRetry(() => import('./pages/DashboardPage'));
const MapPage             = lazyWithRetry(() => import('./pages/MapPage'));
const CyclonePage         = lazyWithRetry(() => import('./pages/CyclonePage'));
const SurfacePage         = lazyWithRetry(() => import('./pages/SurfacePage'));
const Profile3DPage       = lazyWithRetry(() => import('./pages/Profile3DPage'));
const DocsPage            = lazyWithRetry(() => import('./pages/DocsPage'));
const GovPortalPage       = lazyWithRetry(() => import('./pages/GovPortalPage'));
const ValidationPage      = lazyWithRetry(() => import('./pages/ValidationPage'));
const ForecastPage        = lazyWithRetry(() => import('./pages/ForecastPage'));
const ModelComparisonPage = lazyWithRetry(() => import('./pages/ModelComparisonPage'));
const OceanHeatPage       = lazyWithRetry(() => import('./pages/OceanHeatPage'));
const SeasonalPredictionPage = lazyWithRetry(() => import('./pages/SeasonalPredictionPage'));

function PageLoader() {
  return (
    <div className="min-h-screen gradient-ocean flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <CommonOceanBackground />
        <WaterCursorTrail />
        <BubbleClickEffect />
        <AuthProvider>
          <BackendStatusBanner />
          <DataProvider>
            <Suspense fallback={<PageLoader />}>
              <div className="relative z-10">
              <Routes>
                <Route path="/"         element={<HomePage />} />
                <Route path="/login"    element={<LoginPage />} />
                <Route path="/chat"     element={<ChatPage />} />
                <Route path="/input"    element={<InputPage />} />
                <Route path="/worldmap" element={<WorldMapPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/map"      element={<MapPage />} />
                <Route path="/cyclone"  element={<CyclonePage />} />
                <Route path="/surface"  element={<SurfacePage />} />
                <Route
                      path="/profile-3d"
                      element={<Profile3DPage />}
                    />
                <Route path="/docs"     element={
                  <ProtectedRoute requiresDocs>
                    <DocsPage />
                  </ProtectedRoute>
                } />
                <Route path="/gov"      element={
                  <ProtectedRoute requiresGovernment>
                    <GovPortalPage />
                  </ProtectedRoute>
                } />
                <Route path="/validation" element={<ValidationPage />} />
                <Route path="/forecast"  element={<ForecastPage />} />
                <Route path="/compare"   element={<ModelComparisonPage />} />
                <Route path="/ocean-heat" element={<OceanHeatPage />} />
                <Route path="/heat"       element={<OceanHeatPage />} />
                <Route path="/seasonal"   element={<SeasonalPredictionPage />} />
                <Route path="/seasonal-prediction" element={<SeasonalPredictionPage />} />
              </Routes></div>
            </Suspense>
            {/* Global X AI Interactive Floating Pop-up Assistant */}
            <XAIFloatingPopup />
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

