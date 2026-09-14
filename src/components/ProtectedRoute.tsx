import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useGym } from '@/context/GymContext';
import { GateLogin } from '@/components/gym/GateLogin';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isGateUnlocked, unlockGate } = useGym();
  const location = useLocation();

  if (!isGateUnlocked) {
    return <GateLogin onUnlock={unlockGate} />;
  }

  return <>{children}</>;
}