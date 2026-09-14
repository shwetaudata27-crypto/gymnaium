import { useMemo, useState } from 'react';
import { Client, Renewal, RenewalPayment } from '@/types/gym';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { renewalApi } from '@/services/apiService';
import { RenewalPaymentModal } from './RenewalPaymentModal';
import {
  filterRenewalSummaries,
  formatDisplayDate,
  getCurrentRenewalSummaries,
  getMembershipLabels,
  getMembershipLabel,
  RenewalDashboardView,
  RenewalSummary,
} from './renewalUtils';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Edit,
  Eye,
  MessageSquare,
  Phone,
  Send,
  Trash2,
  Users,
} from 'lucide-react';

interface RenewalsTabProps {
  renewals: Renewal[];
  payments: RenewalPayment[];
  clients: Client[];
  view: RenewalDashboardView;
  loading: boolean;
  onRefresh: () => void;
  onEditRenewal: (renewal: Renewal, client: Client) => void;
  onSendEmail: (client: Client) => void;
}

function buildClientFromRenewal(renewal: RenewalSummary, clients: Client[]): Client {
  const existing = clients.find((client) => client.clientId === renewal.clientId);
  if (existing) return existing;

  return {
    id: 0,
    clientId: renewal.clientId,
    name: renewal.name,
    email: renewal.email || '',
    phone: renewal.phone || '',
    dob: '',
    address: '',
    occupation: '',
    emergencyContact: '',
    gender: '',
    membershipType: renewal.membershipType,
    slot: renewal.memberSlot || 'morning',
    membershipPeriod: renewal.membershipPeriod || 0,
    startDate: renewal.startDate || '',
    endDate: renewal.endDate || '',
    registrationDay: '',
    createdAt: renewal.createdAt || new Date().toISOString(),
    updatedAt: renewal.createdAt || new Date().toISOString(),
    payments: [],
    finalAmount: renewal.finalAmount || 0,
    photo: renewal.photo || '',
    signature: '',
    notes: renewal.notes || '',
  };
}

function getStatusClass(status: RenewalSummary['status']) {
  if (status === 'Active') return 'bg-success/20 text-success border-success/30';
  if (status === 'Pending Payment') return 'bg-destructive/20 text-destructive border-destructive/30';
  return 'bg-warning/20 text-warning border-warning/30';
}

function RenewalCard({
  renewal,
  client,
  onPayment,
  onEdit,
  onSendEmail,
  onDelete,
}: {
  renewal: RenewalSummary;
  client: Client;
  onPayment: (renewal: RenewalSummary) => void;
  onEdit: (renewal: RenewalSummary, client: Client) => void;
  onSendEmail: (client: Client) => void;
  onDelete: (renewal: RenewalSummary) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const membershipLabels = getMembershipLabels(renewal.membershipType);
  const photo = renewal.photo || client.photo;

  return (
    <Card variant="glass" className="overflow-hidden hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-0">
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-gym-gold flex items-center justify-center flex-shrink-0 overflow-hidden">
              {photo ? (
                <img src={photo} alt={`${renewal.name} profile`} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-primary-foreground">
                  {renewal.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg truncate">{renewal.name}</h3>
                <Badge variant="outline" className="text-xs">ID: {renewal.clientId}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {renewal.phone || client.phone || 'No mobile'}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {renewal.email || client.email || 'No email'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(true)} aria-label="View renewal">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onPayment(renewal)} aria-label="Record renewal payment">
              <CreditCard className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(renewal, client)} aria-label="Edit renewal">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onSendEmail(client)} aria-label="Send renewal email">
              <Send className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(renewal)}
              className="text-destructive hover:text-destructive"
              aria-label="Delete renewal"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} aria-label="Toggle renewal details">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {membershipLabels.map((label) => (
            <Badge key={label} className="bg-primary/20 text-primary border-primary/30">
              {label}
            </Badge>
          ))}
          <Badge variant="outline" className="text-muted-foreground">
            {renewal.membershipPeriod} month{renewal.membershipPeriod === 1 ? '' : 's'}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            Renewal Date: {formatDisplayDate(renewal.endDate)}
          </Badge>
          <Badge variant="outline" className={getStatusClass(renewal.status)}>
            {renewal.status}
          </Badge>
        </div>

        {isExpanded && (
          <div className="border-t border-border p-4 space-y-4 animate-fade-in bg-secondary/10">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Renewal Details</h4>
                <p>Current Plan: {getMembershipLabel(renewal.membershipType)}</p>
                <p>Slot: {renewal.memberSlot || 'Not set'}</p>
                <p>Renewal Start: {formatDisplayDate(renewal.startDate)}</p>
                <p>Renewal Date: {formatDisplayDate(renewal.endDate)}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Renewal Status</h4>
                <p>Status: {renewal.status}</p>
                <p>Total Amount: Rs.{(renewal.finalAmount || 0).toLocaleString('en-IN')}</p>
                <p>Paid: Rs.{renewal.paidAmount.toLocaleString('en-IN')}</p>
                <p>Pending: Rs.{renewal.pendingAmount.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RenewalsTab({
  renewals,
  payments,
  clients,
  view,
  loading,
  onRefresh,
  onEditRenewal,
  onSendEmail,
}: RenewalsTabProps) {
  const { toast } = useToast();
  const [paymentRenewal, setPaymentRenewal] = useState<RenewalSummary | null>(null);

  const renewalSummaries = useMemo(() => getCurrentRenewalSummaries(renewals, payments), [renewals, payments]);
  const filteredRenewals = useMemo(
    () => filterRenewalSummaries(renewalSummaries, view),
    [renewalSummaries, view],
  );

  const titleByView: Record<RenewalDashboardView, string> = {
    all: 'Renewal Members',
    pending: 'Renewal Pending Payments',
    due: 'Renewal Due Members',
    active: 'Active Renewal Members',
    monthly: 'This Month Renewal Members',
  };

  const handleDelete = async (renewal: RenewalSummary) => {
    if (!window.confirm(`Delete renewal record for ${renewal.name}?`)) return;

    try {
      await renewalApi.remove(String(renewal.id));
      toast({ title: 'Renewal deleted', description: 'Renewal record removed successfully.' });
      onRefresh();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Could not delete renewal record.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card variant="glass">
        <CardContent className="p-12 text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading renewal members...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {titleByView[view]} ({filteredRenewals.length})
        </h2>
      </div>

      {filteredRenewals.length === 0 ? (
        <Card variant="glass">
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Renewal Members Found</h3>
            <p className="text-muted-foreground">Renewal records will appear here after members renew.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRenewals.map((renewal) => {
            const client = buildClientFromRenewal(renewal, clients);
            return (
              <RenewalCard
                key={`${renewal.clientId}-${renewal.id}`}
                renewal={renewal}
                client={client}
                onPayment={setPaymentRenewal}
                onEdit={onEditRenewal}
                onSendEmail={onSendEmail}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}

      {paymentRenewal && (
        <RenewalPaymentModal
          renewal={paymentRenewal}
          onClose={() => setPaymentRenewal(null)}
          onPaymentRecorded={onRefresh}
        />
      )}
    </div>
  );
}
