import {
  Suspense,
  lazy,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ThemeProvider } from './contexts/ThemeContext';

import ProtectedRoute from './components/ProtectedRoute';
import {
  WaterCursorTrail,
  BubbleClickEffect,
} from './components/WaterEffects';

import CommonOceanBackground from './components/CommonOceanBackground';
import XAIFloatingPopup from './components/XAIFloatingPopup';
import BackendStatusBanner from './components/BackendStatusBanner';

import './styles/ocean-page.css';

// ================================================================
// EAGERLY LOADED PAGES
// ================================================================

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';

// ================================================================
// SMART LAZY LOADER
// Handles stale Vite chunks / optimize-deps refreshes.
// ================================================================

function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();

      window.sessionStorage.removeItem('vite_chunk_reload');

      return mod;
    } catch (error) {
      console.error('Lazy chunk load failed:', error);

      const hasReloaded =
        window.sessionStorage.getItem('vite_chunk_reload');

      if (!hasReloaded) {
        window.sessionStorage.setItem(
          'vite_chunk_reload',
          'true'
        );

        window.location.reload();

        return new Promise(() => {});
      }

      window.sessionStorage.removeItem(
        'vite_chunk_reload'
      );

      throw error;
    }
  });
}

// ================================================================
// OCEAN PAGE FRAME
//
// Every routed page gets this wrapper.
// The shared CommonOceanBackground remains mounted only once
// at the application level.
// ================================================================

function OceanPageFrame({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="ocean-page-frame">
      {children}
    </div>
  );
}

function oceanPage(element: ReactElement) {
  return (
    <OceanPageFrame>
      {element}
    </OceanPageFrame>
  );
}

// ================================================================
// LAZY LOADED PAGES
// ================================================================

const ChatPage = lazyWithRetry(
  () => import('./pages/ChatPage')
);

const WorldMapPage = lazyWithRetry(
  () => import('./pages/WorldMapPage')
);

const DashboardPage = lazyWithRetry(
  () => import('./pages/DashboardPage')
);

const MapPage = lazyWithRetry(
  () => import('./pages/MapPage')
);

const CyclonePage = lazyWithRetry(
  () => import('./pages/CyclonePage')
);

const SurfacePage = lazyWithRetry(
  () => import('./pages/SurfacePage')
);

const Profile3DPage = lazyWithRetry(
  () => import('./pages/Profile3DPage')
);

const DocsPage = lazyWithRetry(
  () => import('./pages/DocsPage')
);

const GovPortalPage = lazyWithRetry(
  () => import('./pages/GovPortalPage')
);

const ValidationPage = lazyWithRetry(
  () => import('./pages/ValidationPage')
);

const ForecastPage = lazyWithRetry(
  () => import('./pages/ForecastPage')
);

const ModelComparisonPage = lazyWithRetry(
  () => import('./pages/ModelComparisonPage')
);

const OceanHeatPage = lazyWithRetry(
  () => import('./pages/OceanHeatPage')
);

const SeasonalPredictionPage = lazyWithRetry(
  () => import('./pages/SeasonalPredictionPage')
);

const PredictionsPage = lazyWithRetry(
  () => import('./pages/PredictionsPage')
);

// ================================================================
// PAGE LOADER
// ================================================================

function PageLoader() {
  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">

        <div
          className="
            h-12
            w-12
            rounded-full
            border-2
            border-[#0b76ae]/20
            border-t-[#0b76ae]
            animate-spin
          "
        />

        <p className="text-[#31566c] text-sm font-medium">
          Loading OceanIntel...
        </p>

      </div>
    </div>
  );
}

// ================================================================
// APP
// ================================================================

export default function App() {
  return (
    <BrowserRouter>

      <ThemeProvider>

        {/* ======================================================
            GLOBAL COMMON OCEAN BACKGROUND
            Mounted ONCE for the entire application.
           ====================================================== */}

        <CommonOceanBackground />

        {/* Existing global effects */}
        <WaterCursorTrail />
        <BubbleClickEffect />

        <AuthProvider>

          {/* Global backend status */}
          <BackendStatusBanner />

          <DataProvider>

            {/* ==================================================
                GLOBAL ROUTE LAYER
               ================================================== */}

            <div className="ocean-route-shell">

              <Suspense fallback={<PageLoader />}>

                <Routes>

                  {/* =================================================
                      HOME
                     ================================================= */}

                  <Route
                    path="/"
                    element={oceanPage(
                      <HomePage />
                    )}
                  />

                  {/* =================================================
                      LOGIN
                     ================================================= */}

                  <Route
                    path="/login"
                    element={oceanPage(
                      <LoginPage />
                    )}
                  />

                  {/* =================================================
                      CORE APPLICATION
                     ================================================= */}

                  <Route
                    path="/chat"
                    element={oceanPage(
                      <ChatPage />
                    )}
                  />

                  <Route
                    path="/input"
                    element={<Navigate to="/dashboard" replace />}
                  />

                  <Route
                    path="/worldmap"
                    element={oceanPage(
                      <WorldMapPage />
                    )}
                  />

                  <Route
                    path="/dashboard"
                    element={oceanPage(
                      <DashboardPage />
                    )}
                  />

                  <Route
                    path="/map"
                    element={oceanPage(
                      <MapPage />
                    )}
                  />

                  {/* =================================================
                      OCEAN VISUALIZATION
                     ================================================= */}

                  <Route
                    path="/surface"
                    element={<Navigate to="/dashboard?subpage=surface" replace />}
                  />

                  <Route
                    path="/profile-3d"
                    element={oceanPage(
                      <Profile3DPage />
                    )}
                  />

                  {/* =================================================
                      UNIFIED PREDICTIONS (CYCLONE, OCEAN HEAT, SEASONAL)
                     ================================================= */}

                  <Route
                    path="/predictions"
                    element={oceanPage(
                      <PredictionsPage />
                    )}
                  />

                  {/* Legacy Route Redirects to Predictions Subpages */}
                  <Route
                    path="/cyclone"
                    element={<Navigate to="/predictions?tab=cyclone" replace />}
                  />

                  {/* =================================================
                      FORECAST
                     ================================================= */}

                  <Route
                    path="/forecast"
                    element={oceanPage(
                      <ForecastPage />
                    )}
                  />

                  {/* =================================================
                      MODEL COMPARISON
                     ================================================= */}

                  <Route
                    path="/compare"
                    element={oceanPage(
                      <ModelComparisonPage />
                    )}
                  />

                  {/* =================================================
                      OCEAN HEAT (REDIRECTS TO PREDICTIONS TAB)
                     ================================================= */}

                  <Route
                    path="/ocean-heat"
                    element={<Navigate to="/predictions?tab=heat" replace />}
                  />

                  <Route
                    path="/heat"
                    element={<Navigate to="/predictions?tab=heat" replace />}
                  />

                  {/* =================================================
                      SEASONAL (REDIRECTS TO PREDICTIONS TAB)
                     ================================================= */}

                  <Route
                    path="/seasonal"
                    element={<Navigate to="/predictions?tab=seasonal" replace />}
                  />

                  <Route
                    path="/seasonal-prediction"
                    element={<Navigate to="/predictions?tab=seasonal" replace />}
                  />

                  {/* =================================================
                      VALIDATION
                     ================================================= */}

                  <Route
                    path="/validation"
                    element={oceanPage(
                      <ValidationPage />
                    )}
                  />

                  {/* =================================================
                      PROTECTED DOCUMENTATION
                     ================================================= */}

                  <Route
                    path="/docs"
                    element={oceanPage(
                      <ProtectedRoute requiresDocs>
                        <DocsPage />
                      </ProtectedRoute>
                    )}
                  />

                  {/* =================================================
                      GOVERNMENT & EMERGENCY OPERATIONS PORTAL
                     ================================================= */}

                  <Route
                    path="/gov"
                    element={oceanPage(
                      <ProtectedRoute requiresGovernment>
                        <GovPortalPage />
                      </ProtectedRoute>
                    )}
                  />

                  <Route
                    path="/government"
                    element={<Navigate to="/gov" replace />}
                  />

                  <Route
                    path="/gov-portal"
                    element={<Navigate to="/gov" replace />}
                  />


                </Routes>

              </Suspense>

              {/* ==================================================
                  GLOBAL XAI FLOATING ASSISTANT
                 ================================================== */}

              <XAIFloatingPopup />

            </div>

          </DataProvider>

        </AuthProvider>

      </ThemeProvider>

    </BrowserRouter>
  );
}