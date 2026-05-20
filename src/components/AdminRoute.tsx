// src/components/AdminRoute.tsx

import React from 'react';

import { Navigate } from 'react-router-dom';

import { Loader2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';

const AdminRoute = ({
  children,
}: {
  children: React.ReactNode;
}) => {

  const {
    profile,
    loading,
  } = useAuth();

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (
      <div className="flex h-screen w-full items-center justify-center">

        <Loader2 className="h-8 w-8 animate-spin text-primary" />

      </div>
    );
  }

  // =====================================================
  // ROLE CHECK
  // =====================================================

  const role =
    profile?.role;

  const allowed =
    role === 'shop_admin' ||
    role === 'staff';

  // =====================================================
  // REDIRECT
  // =====================================================

  if (!allowed) {

    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  // =====================================================
  // ACCESS GRANTED
  // =====================================================

  return <>{children}</>;
};

export default AdminRoute;