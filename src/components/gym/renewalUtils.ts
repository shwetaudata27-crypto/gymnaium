import { Client, Renewal, RenewalPayment } from '@/types/gym';

export type RenewalDashboardView = 'all' | 'pending' | 'due' | 'active' | 'monthly';
export type RenewalStatus = 'Active' | 'Due' | 'Pending Payment';

export interface RenewalSummary extends Renewal {
  email?: string;
  phone?: string;
  photo?: string;
  paidAmount: number;
  pendingAmount: number;
  status: RenewalStatus;
}

export function getMembershipLabels(membershipType?: Client['membershipType']) {
  const labels: string[] = [];
  if (membershipType?.gym) labels.push('Gym');
  if (membershipType?.cardio) labels.push('Cardio');
  if (membershipType?.crossfit) labels.push('Crossfit');
  if (membershipType?.pt) labels.push('PT');
  return labels;
}

export function getMembershipLabel(membershipType?: Client['membershipType']) {
  return getMembershipLabels(membershipType).join(', ') || 'None';
}

export function formatDisplayDate(value?: string) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-IN');
}

export function isSameMonth(value?: string, referenceDate = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getMonth() === referenceDate.getMonth() && date.getFullYear() === referenceDate.getFullYear();
}

export function getRenewalPaymentsByRenewal(payments: RenewalPayment[]) {
  return payments.reduce((map, payment) => {
    const renewalId = String(payment.renewalId);
    if (!map[renewalId]) map[renewalId] = [];
    map[renewalId].push(payment);
    return map;
  }, {} as Record<string, RenewalPayment[]>);
}

function getDateTime(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getRenewalStatus(renewal: Renewal, pendingAmount: number, referenceDate: Date): RenewalStatus {
  const endTime = getDateTime(renewal.endDate);
  if (!endTime || endTime <= startOfDay(referenceDate)) return 'Due';
  if (pendingAmount > 0) return 'Pending Payment';
  return 'Active';
}

export function getCurrentRenewalSummaries(
  renewals: Renewal[],
  payments: RenewalPayment[],
  referenceDate = new Date(),
): RenewalSummary[] {
  const paymentsByRenewal = getRenewalPaymentsByRenewal(payments);
  const latestByClient = new Map<string, Renewal>();

  [...renewals]
    .sort((a, b) => {
      const createdDiff = getDateTime(b.createdAt) - getDateTime(a.createdAt);
      if (createdDiff !== 0) return createdDiff;
      return (b.id || 0) - (a.id || 0);
    })
    .forEach((renewal) => {
      if (!latestByClient.has(renewal.clientId)) {
        latestByClient.set(renewal.clientId, renewal);
      }
    });

  return Array.from(latestByClient.values()).map((renewal) => {
    const renewalPayments = paymentsByRenewal[String(renewal.id)] || [];
    const paidAmount = renewalPayments.reduce((sum, payment) => sum + (payment.paidAmount || 0), 0);
    const pendingAmount = Math.max(0, (renewal.finalAmount || 0) - paidAmount);
    return {
      ...renewal,
      paidAmount,
      pendingAmount,
      status: getRenewalStatus(renewal, pendingAmount, referenceDate),
    };
  });
}

export function getRenewalStats(summaries: RenewalSummary[], referenceDate = new Date()) {
  return {
    pendingPayments: summaries.filter((renewal) => renewal.pendingAmount > 0).length,
    active: summaries.filter((renewal) => renewal.status === 'Active').length,
    due: summaries.filter((renewal) => renewal.status === 'Due').length,
    total: summaries.length,
    thisMonth: summaries.filter((renewal) => isSameMonth(renewal.createdAt, referenceDate)).length,
  };
}

export function filterRenewalSummaries(
  summaries: RenewalSummary[],
  view: RenewalDashboardView,
  referenceDate = new Date(),
) {
  if (view === 'pending') return summaries.filter((renewal) => renewal.pendingAmount > 0);
  if (view === 'due') return summaries.filter((renewal) => renewal.status === 'Due');
  if (view === 'active') return summaries.filter((renewal) => renewal.status === 'Active');
  if (view === 'monthly') return summaries.filter((renewal) => isSameMonth(renewal.createdAt, referenceDate));
  return summaries;
}
