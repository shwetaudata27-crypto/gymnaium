import { useMemo } from 'react';
import { Client } from '@/types/gym';

export interface MemberStats {
  totalMembers: number;
  activeMembers: number;
  totalRevenue: number;
  thisMonthMembers: number;
}

export function useMemberStats(clients: Client[]): MemberStats {
  return useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const totalMembers = clients.length;

    const activeMembers = clients.filter(c => {
      const endDate = new Date(c.endDate);
      return endDate > today;
    }).length;

    const totalRevenue = clients.reduce((sum, client) => {
      const payments = client.payments || [];
      return sum + payments.reduce((pSum, p) => pSum + (p.paidAmount || 0), 0);
    }, 0);

    const thisMonthMembers = clients.filter(c => {
      if (!c.createdAt) return false;
      const created = new Date(c.createdAt);
      return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
    }).length;

    return {
      totalMembers,
      activeMembers,
      totalRevenue,
      thisMonthMembers
    };
  }, [clients]);
}
