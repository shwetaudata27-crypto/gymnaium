import { useState } from 'react';
import { Renewal } from '@/types/gym';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { renewalPaymentApi } from '@/services/apiService';
import { CreditCard, IndianRupee } from 'lucide-react';

interface RenewalPaymentModalProps {
  renewal: Renewal & { pendingAmount?: number };
  onClose: () => void;
  onPaymentRecorded?: () => void;
}

export function RenewalPaymentModal({ renewal, onClose, onPaymentRecorded }: RenewalPaymentModalProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const amountDue = renewal.pendingAmount ?? renewal.finalAmount ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paid = parseFloat(amount);
    if (isNaN(paid) || paid <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid payment amount.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await renewalPaymentApi.create({
        renewalId: renewal.id,
        clientId: renewal.clientId,
        amount: renewal.finalAmount || 0,
        finalAmount: renewal.finalAmount || 0,
        paidAmount: paid,
        membershipPeriod: renewal.membershipPeriod || 0,
        notes,
        paidDate: paidDate + 'T00:00:00',
      });

      toast({ title: 'Payment Recorded', description: `Rs.${paid.toLocaleString()} recorded for ${renewal.name}` });
      onPaymentRecorded && onPaymentRecorded();
      onClose();
    } catch (err: any) {
      toast({ title: 'Payment Failed', description: err?.message || 'Could not record payment', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Record Renewal Payment
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-gym-gold/10 border border-primary/20 mb-4">
          <div className="text-center text-sm">Renewal for <strong>{renewal.name}</strong></div>
          <div className="text-center text-xs text-muted-foreground">Amount due: ₹{(renewal.finalAmount || 0).toLocaleString()}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="amount" type="number" className="pl-10" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paidDate">Payment Date</Label>
            <Input id="paidDate" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" variant="hero" className="flex-1" disabled={isSubmitting}>{isSubmitting ? 'Recording...' : 'Record Payment'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
