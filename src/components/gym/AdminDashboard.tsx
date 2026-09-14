import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGym } from '@/context/GymContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ClientCard } from './ClientCard';
import { ClientDetailModal } from './ClientDetailModal';
import { EditClientModal } from './EditClientModal';
import { SendSMSModal as SendEmailModal } from './SendSMSModal';
import { PaymentModal } from './PaymentModal';
import { ExportPdfModal, ExportOptions } from './ExportPdfModal';
import { BirthdayAlertModal, isBirthdayEmailInCooldown } from './BirthdayAlertModal';
import { PendingPaymentsModal, isPaymentReminderInCooldown } from './PendingPaymentsModal';
import { FestivalSMSModal as FestivalEmailModal } from './FestivalSMSModal';
import { RenewalForm } from './RenewalForm';
import { RenewalsTab } from './RenewalsTab';
import { Client, Renewal, RenewalPayment } from '@/types/gym';
import { useToast } from '@/hooks/use-toast';
import { calculateDiscountedPrice } from '@/utils/pricing';
import {
  Cake,
  Clock3,
  CreditCard,
  Database,
  Download,
  Dumbbell,
  IndianRupee,
  LogOut,
  PartyPopper,
  Search,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_ENDPOINTS } from '@/config/api';
import { renewalApi, renewalPaymentApi } from '@/services/apiService';
import {
  formatDisplayDate,
  getCurrentRenewalSummaries,
  getMembershipLabel,
  getRenewalPaymentsByRenewal,
  getRenewalStats,
  isSameMonth,
  RenewalDashboardView,
} from './renewalUtils';

function formatCurrency(amount: number) {
  return `Rs.${amount.toLocaleString('en-IN')}`;
}

function isDateActive(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return date.getTime() >= todayStart;
}

function getBirthdayDate(value: string) {
  if (!value) return null;
  if (value.includes('-')) {
    const parts = value.split('-');
    const date = parts[0].length === 4 ? new Date(value) : new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value.includes('/')) {
    const parts = value.split('/');
    const date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function getRenewalRecordStatus(renewal: Renewal, paidAmount: number) {
  const pendingAmount = Math.max(0, (renewal.finalAmount || 0) - paidAmount);
  if (!isDateActive(renewal.endDate)) return 'Due';
  if (pendingAmount > 0) return 'Pending Payment';
  return 'Active';
}

export function AdminDashboard() {
  const { clients, loading, adminLogout, deleteClient, getClientBySearch } = useGym();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [emailClient, setEmailClient] = useState<Client | null>(null);
  const [emailContext, setEmailContext] = useState<'default' | 'renewal' | 'registration'>('default');
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [showPendingPayments, setShowPendingPayments] = useState(false);
  const [renewalsView, setRenewalsView] = useState<RenewalDashboardView>('all');
  const [renewalsData, setRenewalsData] = useState<Renewal[]>([]);
  const [renewalPaymentsData, setRenewalPaymentsData] = useState<RenewalPayment[]>([]);
  const [renewalsLoading, setRenewalsLoading] = useState(false);
  const [renewalsRefreshKey, setRenewalsRefreshKey] = useState(0);
  const [emailRefreshKey, setEmailRefreshKey] = useState(0);
  const [showFestivalEmails, setShowFestivalEmails] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'renewals'>('members');
  const [renewalFormState, setRenewalFormState] = useState<{ client: Client; renewal?: Renewal } | null>(null);

  const handleEmailSent = useCallback(() => {
    setEmailRefreshKey((prev) => prev + 1);
  }, []);

  const refreshRenewals = useCallback(() => {
    setRenewalsRefreshKey((prev) => prev + 1);
  }, []);

  const handleRenewalCreated = useCallback(() => {
    refreshRenewals();
    toast({ title: 'Renewal saved', description: 'Renewal record updated successfully.' });
  }, [refreshRenewals, toast]);

  const openRenewalsView = useCallback((view: RenewalDashboardView) => {
    setActiveTab('renewals');
    setRenewalsView(view);
  }, []);

  useEffect(() => {
    const loadRenewalMetrics = async () => {
      setRenewalsLoading(true);
      try {
        const [renewals, payments] = await Promise.all([
          renewalApi.getAll(),
          renewalPaymentApi.getAll(),
        ]);
        setRenewalsData((renewals || []) as Renewal[]);
        setRenewalPaymentsData((payments || []) as RenewalPayment[]);
      } catch (error) {
        console.error('Failed to load renewals data', error);
      } finally {
        setRenewalsLoading(false);
      }
    };

    loadRenewalMetrics();
  }, [renewalsRefreshKey]);

  const filteredClients = getClientBySearch(searchTerm);

  const birthdayCount = useMemo(() => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    return clients.filter((client) => {
      if (!client.dob) return false;
      if (isBirthdayEmailInCooldown(client.clientId)) return false;
      const dobDate = getBirthdayDate(client.dob);
      return Boolean(dobDate && dobDate.getMonth() + 1 === todayMonth && dobDate.getDate() === todayDay);
    }).length;
  }, [clients, emailRefreshKey]);

  const pendingPaymentsCount = useMemo(() => {
    return clients.filter((client) => {
      if (isPaymentReminderInCooldown(client.clientId)) return false;
      const totalPaid = client.payments?.reduce((sum, payment) => sum + (payment.paidAmount || 0), 0) || 0;
      const totalAmount = client.finalAmount || calculateDiscountedPrice(client.membershipType, client.membershipPeriod);
      return totalAmount - totalPaid > 0;
    }).length;
  }, [clients, emailRefreshKey]);

  const renewalSummaries = useMemo(
    () => getCurrentRenewalSummaries(renewalsData, renewalPaymentsData),
    [renewalsData, renewalPaymentsData],
  );

  const renewalStats = useMemo(() => getRenewalStats(renewalSummaries), [renewalSummaries]);

  const renewalPaymentsByRenewal = useMemo(
    () => getRenewalPaymentsByRenewal(renewalPaymentsData),
    [renewalPaymentsData],
  );

  const totalRevenue = useMemo(() => {
    return clients.reduce((sum, client) => {
      const payments = client.payments || [];
      return sum + payments.reduce((paymentSum, payment) => paymentSum + (payment.paidAmount || 0), 0);
    }, 0);
  }, [clients]);

  const activeMembers = useMemo(() => clients.filter((client) => isDateActive(client.endDate)).length, [clients]);
  const thisMonthMembers = useMemo(() => clients.filter((client) => isSameMonth(client.createdAt)).length, [clients]);

  const handleDelete = async (clientId: string) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;

    try {
      await deleteClient(clientId);
      toast({
        title: 'Client Deleted',
        description: 'The client has been removed from the system.',
      });
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadDb = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.db.download);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gym-${new Date().toISOString().split('T')[0]}.db`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Database Downloaded', description: 'gym.db has been saved.' });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Could not download database.',
        variant: 'destructive',
      });
    }
  };

  const handleExportPDF = async (options: ExportOptions) => {
    const doc = new jsPDF({ orientation: 'landscape' });

    let filteredData = [...clients];
    if (options.startDate || options.endDate) {
      filteredData = clients.filter((client) => {
        const clientDate = new Date(client.createdAt);
        const start = options.startDate ? new Date(options.startDate) : null;
        const end = options.endDate ? new Date(options.endDate) : null;

        if (start && end) return clientDate >= start && clientDate <= end;
        if (start) return clientDate >= start;
        if (end) return clientDate <= end;
        return true;
      });
    }

    let yPos = 20;
    doc.setFontSize(20);
    doc.text('Member Database Report', 14, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, yPos);
    yPos += 6;

    if (options.startDate || options.endDate) {
      doc.text(`Date Range: ${options.startDate || 'Start'} to ${options.endDate || 'End'}`, 14, yPos);
      yPos += 6;
    }

    if (options.sections.clients || options.sections.all) {
      doc.text(`Total Members: ${filteredData.length} | Active: ${filteredData.filter((client) => isDateActive(client.endDate)).length}`, 14, yPos);
      yPos += 10;

      const clientTableData = filteredData.map((client) => [
        client.clientId,
        client.name,
        client.phone,
        client.email,
        client.gender,
        getMembershipLabel(client.membershipType),
        client.slot,
        formatDisplayDate(client.startDate),
        formatDisplayDate(client.endDate),
        isDateActive(client.endDate) ? 'Active' : 'Expired',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Member ID', 'Name', 'Phone', 'Email', 'Gender', 'Membership', 'Slot', 'Start Date', 'End Date', 'Status']],
        body: clientTableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    if (options.sections.payments || options.sections.all) {
      const memberPayments = filteredData.flatMap((client) => {
        return (client.payments || []).map((payment) => ({
          clientId: client.clientId,
          clientName: payment.name || client.name,
          membershipPeriod: payment.membershipPeriod || client.membershipPeriod,
          ...payment,
        }));
      });

      if (memberPayments.length > 0) {
        if (yPos > 180) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.text('Member Payment Records', 14, yPos);
        yPos += 8;

        const paymentTableData = memberPayments.map((payment) => {
          const baseAmount = payment.amount || 0;
          const finalAmount = payment.finalAmount || baseAmount;
          const discountAmount = baseAmount - finalAmount;
          const paidDateTime = payment.paidDate ? new Date(payment.paidDate) : null;
          const dateStr = paidDateTime && !Number.isNaN(paidDateTime.getTime())
            ? paidDateTime.toLocaleDateString('en-IN')
            : 'N/A';
          const timeStr = paidDateTime && !Number.isNaN(paidDateTime.getTime())
            ? paidDateTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : '';

          return [
            payment.clientId,
            payment.clientName,
            `${payment.membershipPeriod || '-'} month${(payment.membershipPeriod || 0) > 1 ? 's' : ''}`,
            formatCurrency(baseAmount),
            `${formatCurrency(discountAmount)} (${payment.offerDiscount || 0}%)`,
            formatCurrency(finalAmount),
            formatCurrency(payment.paidAmount || 0),
            `${dateStr} ${timeStr}`,
            payment.notes || '-',
          ];
        });

        autoTable(doc, {
          startY: yPos,
          head: [['Member ID', 'Name', 'Period', 'Base Amt', 'Discount', 'Final Amt', 'Paid', 'Date & Time', 'Offer/Note']],
          body: paymentTableData,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [39, 174, 96] },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }
    }

    doc.save(`member-report-${new Date().toISOString().split('T')[0]}.pdf`);

    toast({
      title: 'PDF Downloaded',
      description: 'Member report exported successfully.',
    });
  };

  const handleExportRenewalPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    let yPos = 20;

    doc.setFontSize(20);
    doc.text('Renewal Report', 14, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, yPos);
    yPos += 10;

    if (renewalsData.length === 0) {
      doc.text('No renewal records found.', 14, yPos);
      doc.save(`renewal-report-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'Renewal PDF Downloaded', description: 'Renewal report exported successfully.' });
      return;
    }

    const renewalRows = renewalsData.map((renewal) => {
      const payments = renewalPaymentsByRenewal[String(renewal.id)] || [];
      const paidAmount = payments.reduce((sum, payment) => sum + (payment.paidAmount || 0), 0);
      const pendingAmount = Math.max(0, (renewal.finalAmount || 0) - paidAmount);

      return [
        renewal.clientId,
        renewal.name,
        getMembershipLabel(renewal.membershipType),
        `${renewal.membershipPeriod || 0} month${renewal.membershipPeriod === 1 ? '' : 's'}`,
        formatDisplayDate(renewal.startDate),
        formatDisplayDate(renewal.endDate),
        formatCurrency(renewal.finalAmount || 0),
        formatCurrency(paidAmount),
        formatCurrency(pendingAmount),
        getRenewalRecordStatus(renewal, paidAmount),
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Member ID', 'Name', 'Current Plan', 'Period', 'Start Date', 'Renewal Date', 'Final Amt', 'Paid', 'Pending', 'Status']],
      body: renewalRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [14, 165, 233] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    if (renewalPaymentsData.length > 0) {
      if (yPos > 180) {
        doc.addPage();
        yPos = 20;
      }

      const renewalsById = renewalsData.reduce((map, renewal) => {
        map[String(renewal.id)] = renewal;
        return map;
      }, {} as Record<string, Renewal>);

      const paymentRows = renewalPaymentsData.map((payment) => {
        const renewal = renewalsById[String(payment.renewalId)];
        return [
          payment.clientId,
          renewal?.name || '-',
          String(payment.renewalId),
          formatCurrency(payment.finalAmount || payment.amount || 0),
          formatCurrency(payment.paidAmount || 0),
          formatDisplayDate(payment.paidDate),
          payment.notes || 'Renewal payment',
        ];
      });

      doc.setFontSize(14);
      doc.text('Renewal Payment Records', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Member ID', 'Name', 'Renewal ID', 'Final Amt', 'Paid', 'Paid Date', 'Note']],
        body: paymentRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [39, 174, 96] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
    }

    doc.save(`renewal-report-${new Date().toISOString().split('T')[0]}.pdf`);

    toast({
      title: 'Renewal PDF Downloaded',
      description: 'Renewal report exported successfully.',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage your gym members and payments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowExportModal(true)} className="gap-2">
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportRenewalPDF} className="gap-2">
            <Download className="w-4 h-4" />
            Export Renewal PDF
          </Button>
          <Button variant="outline" onClick={() => openRenewalsView('all')} className="gap-2 relative">
            <Clock3 className="w-4 h-4" />
            Renewals
            {renewalStats.due > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-warning text-warning-foreground rounded-full text-xs flex items-center justify-center font-bold">
                {renewalStats.due}
              </span>
            )}
          </Button>
          <Button variant="outline" onClick={handleDownloadDb} className="gap-2">
            <Database className="w-4 h-4" />
            Download DB
          </Button>
          <Button variant="outline" onClick={() => { adminLogout(); navigate('/'); }} className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </div>

      {activeTab === 'members' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 relative"
            onClick={() => setShowBirthdayModal(true)}
          >
            <Cake className="w-6 h-6 text-primary" />
            <span className="font-medium">Birthdays Today</span>
            {birthdayCount > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-bold">
                {birthdayCount}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 relative"
            onClick={() => setShowPendingPayments(true)}
          >
            <IndianRupee className="w-6 h-6 text-destructive" />
            <span className="font-medium">Member Pending Payments</span>
            {pendingPaymentsCount > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center font-bold">
                {pendingPaymentsCount}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => setShowFestivalEmails(true)}
          >
            <PartyPopper className="w-6 h-6 text-gym-gold" />
            <span className="font-medium">Festival Emails</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 relative"
            onClick={() => openRenewalsView('pending')}
          >
            <CreditCard className="w-6 h-6 text-destructive" />
            <span className="font-medium">Renewal Pending Payments</span>
            {renewalStats.pendingPayments > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center font-bold">
                {renewalStats.pendingPayments}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 relative"
            onClick={() => openRenewalsView('due')}
          >
            <Clock3 className="w-6 h-6 text-warning" />
            <span className="font-medium">Renewal Due Members</span>
            {renewalStats.due > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-warning text-warning-foreground rounded-full text-xs flex items-center justify-center font-bold">
                {renewalStats.due}
              </span>
            )}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {activeTab === 'members' ? (
          <>
            <Card variant="glass">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/20">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold">{clients.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/20">
                  <Dumbbell className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Members</p>
                  <p className="text-2xl font-bold">{activeMembers}</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gym-gold/20">
                  <TrendingUp className="w-6 h-6 text-gym-gold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/20">
                  <UserPlus className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">This Month Members</p>
                  <p className="text-2xl font-bold">{thisMonthMembers}</p>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card variant="glass" className="cursor-pointer" onClick={() => openRenewalsView('pending')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-destructive/20">
                  <CreditCard className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Renewal Pending Payments</p>
                  <p className="text-2xl font-bold">{renewalStats.pendingPayments}</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass" className="cursor-pointer" onClick={() => openRenewalsView('active')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/20">
                  <Dumbbell className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Renewal Members</p>
                  <p className="text-2xl font-bold">{renewalStats.active}</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass" className="cursor-pointer" onClick={() => openRenewalsView('all')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/20">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Renewal Members</p>
                  <p className="text-2xl font-bold">{renewalStats.total}</p>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass" className="cursor-pointer" onClick={() => openRenewalsView('monthly')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/20">
                  <UserPlus className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">This Month Renewal Members</p>
                  <p className="text-2xl font-bold">{renewalStats.thisMonth}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <Button variant={activeTab === 'members' ? 'default' : 'outline'} onClick={() => setActiveTab('members')}>
              Members
            </Button>
            <Button
              variant={activeTab === 'renewals' ? 'default' : 'outline'}
              onClick={() => openRenewalsView('all')}
              className="relative"
            >
              Renewals
              {renewalStats.due > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-warning text-warning-foreground rounded-full text-xs flex items-center justify-center font-bold">
                  {renewalStats.due}
                </span>
              )}
            </Button>
          </div>

          {activeTab === 'members' && (
            <Card variant="glass" className="flex-1">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, phone, or client ID..."
                    className="pl-12 h-12 text-lg"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {activeTab === 'members' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {searchTerm ? `Search Results (${filteredClients.length})` : `All Members (${clients.length})`}
              </h2>
            </div>

            {filteredClients.length === 0 ? (
              <Card variant="glass">
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Members Found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? 'Try a different search term' : 'No members registered yet'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredClients.map((client) => (
                  <ClientCard
                    key={client.clientId}
                    client={client}
                    onView={setSelectedClient}
                    onEdit={setEditingClient}
                    onDelete={handleDelete}
                    onSendEmail={(member) => {
                      setEmailClient(member);
                      setEmailContext('default');
                    }}
                    onRenew={(member) => setRenewalFormState({ client: member })}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <RenewalsTab
            renewals={renewalsData}
            payments={renewalPaymentsData}
            clients={clients}
            view={renewalsView}
            loading={renewalsLoading}
            onRefresh={refreshRenewals}
            onEditRenewal={(renewal, client) => setRenewalFormState({ client, renewal })}
            onSendEmail={(client) => {
              setEmailClient(client);
              setEmailContext('renewal');
            }}
          />
        )}
      </div>

      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onAddPayment={() => {
            setPaymentClient(selectedClient);
            setSelectedClient(null);
          }}
        />
      )}

      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
        />
      )}

      {emailClient && (
        <SendEmailModal
          client={emailClient}
          context={emailContext}
          onClose={() => {
            setEmailClient(null);
            setEmailContext('default');
          }}
        />
      )}

      {paymentClient && (
        <PaymentModal
          client={paymentClient}
          onClose={() => setPaymentClient(null)}
        />
      )}

      {renewalFormState && (
        <RenewalForm
          client={renewalFormState.client}
          renewal={renewalFormState.renewal}
          onClose={() => setRenewalFormState(null)}
          onRenewalCreated={handleRenewalCreated}
        />
      )}

      <ExportPdfModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSubmit={handleExportPDF}
      />

      {showBirthdayModal && (
        <BirthdayAlertModal
          clients={clients}
          onClose={() => setShowBirthdayModal(false)}
          onEmailSent={handleEmailSent}
        />
      )}

      {showPendingPayments && (
        <PendingPaymentsModal
          clients={clients}
          onClose={() => setShowPendingPayments(false)}
          onAddPayment={(client) => setPaymentClient(client)}
          onEmailSent={handleEmailSent}
        />
      )}

      {showFestivalEmails && (
        <FestivalEmailModal
          clients={clients}
          onClose={() => setShowFestivalEmails(false)}
        />
      )}
    </div>
  );
}
