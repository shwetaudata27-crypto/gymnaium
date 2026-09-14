import { useMemo, useState } from 'react';
import { Client, MembershipType, Renewal } from '@/types/gym';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { calculateEndDate, calculateRenewalPrice } from '@/utils/pricing';
import { renewalApi, renewalPaymentApi } from '@/services/apiService';
import { User } from 'lucide-react';

interface RenewalFormProps {
  client: Client;
  renewal?: Renewal;
  onClose: () => void;
  onRenewalCreated: () => void;
}

const PERIOD_OPTIONS = [
  { value: '1', label: '1 Month' },
  { value: '3', label: '3 Months' },
  { value: '6', label: '6 Months' },
  { value: '12', label: '12 Months' },
  { value: 'custom', label: 'Custom' },
];

const membershipKeys: Array<keyof MembershipType> = ['gym', 'cardio', 'crossfit', 'pt'];

export function RenewalForm({ client, renewal, onClose, onRenewalCreated }: RenewalFormProps) {
  const { toast } = useToast();
  const [membershipType, setMembershipType] = useState<MembershipType>(renewal?.membershipType || client.membershipType);
  const [memberSlot, setMemberSlot] = useState<Client['slot']>(renewal?.memberSlot || client.slot || 'morning');
  const [membershipPeriod, setMembershipPeriod] = useState<string>(
    renewal ? String(renewal.membershipPeriod) : String(client.membershipPeriod || ''),
  );
  const [customMonths, setCustomMonths] = useState('');
  const [startDate, setStartDate] = useState(renewal?.startDate || '');
  const [paidAmount, setPaidAmount] = useState('');
  const [paidDate, setPaidDate] = useState(
    renewal?.startDate ? new Date(renewal.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  );
  const [notes, setNotes] = useState(renewal?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = Boolean(renewal);

  const months = useMemo(() => {
    if (membershipPeriod === 'custom') return parseInt(customMonths, 10) || 0;
    return parseInt(membershipPeriod, 10) || 0;
  }, [membershipPeriod, customMonths]);

  const finalAmount = useMemo(() => {
    return months > 0 ? calculateRenewalPrice(membershipType, months) : 0;
  }, [membershipType, months]);

  const endDate = useMemo(() => {
    return startDate && months > 0 ? calculateEndDate(startDate, months) : '';
  }, [startDate, months]);

  const handleCheckboxChange = (key: keyof MembershipType, value: boolean) => {
    setMembershipType((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!membershipType.gym && !membershipType.cardio && !membershipType.crossfit && !membershipType.pt) {
      toast({ title: 'Select Membership', description: 'Choose at least one membership option.', variant: 'destructive' });
      return;
    }
    if (!memberSlot) {
      toast({ title: 'Select Slot', description: 'Please choose a workout slot.', variant: 'destructive' });
      return;
    }
    if (!months || months < 1) {
      toast({ title: 'Invalid Duration', description: 'Please select a valid membership period.', variant: 'destructive' });
      return;
    }
    if (!startDate) {
      toast({ title: 'Select Start Date', description: 'Please choose a renewal start date.', variant: 'destructive' });
      return;
    }
    if (!paidAmount || Number(paidAmount) <= 0) {
      toast({ title: 'Payment Required', description: 'Please enter a payment amount.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      let renewalId: number | undefined;

      if (renewal) {
        const updateRes = await renewalApi.update(String(renewal.id), {
          membershipType,
          memberSlot,
          membershipPeriod: months,
          startDate,
          endDate,
          finalAmount,
          notes,
        });
        renewalId = updateRes.renewal?.id;
      } else {
        const renewalResponse = await renewalApi.create({
          clientId: client.clientId,
          name: client.name,
          membershipType,
          memberSlot,
          membershipPeriod: months,
          startDate,
          endDate,
          finalAmount,
          notes,
        });
        renewalId = renewalResponse.renewal?.id;
      }

      if (!renewalId) throw new Error('Renewal save failed');

      await renewalPaymentApi.create({
        renewalId,
        clientId: client.clientId,
        amount: finalAmount,
        finalAmount,
        paidAmount: Number(paidAmount),
        membershipPeriod: months,
        notes,
        paidDate,
      });

      toast({ title: 'Renewal Complete', description: 'Membership renewed successfully.' });
      onRenewalCreated();
      onClose();
    } catch (error) {
      toast({
        title: 'Renewal Failed',
        description: error instanceof Error ? error.message : 'Could not complete renewal.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? `Update Renewal for ${client.name}` : `Renew Membership for ${client.name}`}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Member ID</Label>
              <div className="h-12 flex items-center px-4 rounded-lg bg-secondary/50 border border-border text-sm">
                {client.clientId}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Current Slot</Label>
              <div className="h-12 flex items-center px-4 rounded-lg bg-secondary/50 border border-border text-sm">
                {client.slot || 'Not set'}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="w-4 h-4 text-primary" />
              Membership Options
            </div>
            <div className="grid grid-cols-2 gap-3">
              {membershipKeys.map((key) => (
                <label key={key} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 cursor-pointer">
                  <Checkbox
                    checked={membershipType[key]}
                    onCheckedChange={(checked) => handleCheckboxChange(key, Boolean(checked))}
                  />
                  <span className="font-medium capitalize">{key}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="slot">Workout Slot</Label>
              <Select value={memberSlot} onValueChange={(value) => setMemberSlot(value as Client['slot'])}>
                <SelectTrigger id="slot">
                  <SelectValue placeholder="Choose slot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="renewalStart">Renewal Start Date</Label>
              <Input
                id="renewalStart"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="period">Period *</Label>
              <Select value={membershipPeriod} onValueChange={setMembershipPeriod}>
                <SelectTrigger id="period">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {membershipPeriod === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="customMonths">Number of Months</Label>
                <Input
                  id="customMonths"
                  type="number"
                  min="1"
                  placeholder="Enter months"
                  value={customMonths}
                  onChange={(event) => setCustomMonths(event.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Renewal Date</Label>
              <div className="h-12 flex items-center px-4 rounded-lg bg-secondary/50 border border-border text-sm">
                {endDate || 'Choose start date and period'}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Renewal Amount</Label>
              <div className="h-12 flex items-center px-4 rounded-lg bg-secondary/50 border border-border font-semibold text-foreground">
                Rs.{finalAmount.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paidAmount">Amount Paid</Label>
              <Input
                id="paidAmount"
                type="number"
                min="0"
                placeholder="Enter paid amount"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paidDate">Payment Date</Label>
              <Input
                id="paidDate"
                type="date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional note for this renewal"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" variant="hero" className="w-full sm:w-auto" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Renew Membership'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
