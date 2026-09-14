import { ReactNode } from 'react';
import { useGym } from '@/context/GymContext';
import { AdminLogin } from '@/components/gym/AdminLogin';
import { AdminDashboard } from '@/components/gym/AdminDashboard';

interface AdminRouteProps {
  children?: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAdminLoggedIn } = useGym();

  if (!isAdminLoggedIn) {
    return <AdminLogin />;
  }

  return children || <AdminDashboard />;
}