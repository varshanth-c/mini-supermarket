// src/App.tsx
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import RAGKnowledgeEngine from './pages/RAGKnowledgeEngine';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';

// Public & Auth Pages
import Index from './pages/Index';
import Auth from './pages/Auth';
import UpdatePassword from './pages/UpdatePassword';
import NotFound from './pages/NotFound';

// Core Business Pages
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import CustomerPOSPage from './pages/CustomerPOSPage';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import FreshnessMonitor from './pages/FreshnessMonitor';
import { ProfilePage } from './pages/ProfilePage';

// NEW INTEGRATED AI MODULES
import AIShoppingAssistant from './pages/AIShoppingAssistant'; // Member 2
import RAGAdvisor from './pages/RAGAdvisor';                   // Member 2
import Suppliers from './pages/Suppliers';                     // Member 4

// Customer Pages
import CustomerDashboard from './pages/CustomerDashboard';

import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { session, profile } = useAuth();

  // =====================================================
  // DYNAMIC ROLE ROUTING
  // =====================================================

  const DashboardRoute = () => {
    if (profile?.role === 'customer') {
      return <CustomerDashboard />;
    }
    return <Dashboard />;
  };

  const SalesRoute = () => {
    if (profile?.role === 'customer') {
      return <CustomerPOSPage />;
    }
    return <Sales />;
  };

  return (
    <Routes>
      {/* ── PUBLIC ROUTES ──────────────────────────────── */}
      <Route
        path="/"
        element={!session ? <Index /> : <Navigate to="/dashboard" replace />}
      />

      <Route
        path="/auth"
        element={!session ? <Auth /> : <Navigate to="/dashboard" replace />}
      />

      <Route path="/update-password" element={<UpdatePassword />} />

      {/* ── SHARED PROTECTED ROUTES ───────────────────── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardRoute />
          </ProtectedRoute>
        }
      />
      <Route
  path="/ai-advisor"
  element={
    <ProtectedRoute>
      <AdminRoute>
        <RAGKnowledgeEngine />
      </AdminRoute>
    </ProtectedRoute>
  }
/>

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/sales"
        element={
          <ProtectedRoute>
            <SalesRoute />
          </ProtectedRoute>
        }
      />

      {/* ── CUSTOMER SPECIFIC AI ──────────────────────── */}
      <Route
        path="/ai-assistant"
        element={
          <ProtectedRoute>
            <AIShoppingAssistant />
          </ProtectedRoute>
        }
      />

      {/* ── OPERATIONAL (ADMIN + STAFF) ───────────────── */}
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <Inventory />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/freshness-monitor"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <FreshnessMonitor />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      {/* ── STRATEGIC (STRICT ADMIN ONLY) ─────────────── */}
      <Route
        path="/expense"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <Expenses />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      

      <Route
        path="/advisor"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <RAGAdvisor />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/suppliers"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <Suppliers />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <Reports />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      {/* ── 404 ───────────────────────────────────────── */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const AppContent = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-green-500" />
      </div>
    );
  }

  return <AppRoutes />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;