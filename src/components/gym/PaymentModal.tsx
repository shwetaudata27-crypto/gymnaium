import { useState } from 'react';
import { Client } from '@/types/gym';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useGym } from '@/context/GymContext';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, calculateDiscountedPrice, calculateBasePrice, getSpecialOffers } from '@/utils/pricing';
import { paymentApi } from '@/services/apiService';
import { CreditCard, IndianRupee } from 'lucide-react';

interface PaymentModalProps {
  client: Client;
  onClose: () => void;
}

export function PaymentModal({ client, onClose }: PaymentModalProps) {
  const { refreshClients } = useGym();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const totalPaid = client.payments?.reduce((sum, p) => sum + p.paidAmount, 0) || 0;
  // Calculate base price before discount
  const baseAmount = calculateBasePrice(client.membershipType, client.membershipPeriod);
  // Use stored finalAmount if available, otherwise calculate discounted price
  const totalAmount = client.finalAmount || calculateDiscountedPrice(client.membershipType, client.membershipPeriod);
  const remainingAmount = totalAmount - totalPaid;
  
  // Calculate the discount applied
  const discountAmount = baseAmount - totalAmount;
  const discountPercentage = baseAmount > 0 ? Math.round((discountAmount / baseAmount) * 100) : 0;
  
  // Get the offer name
  const offers = getSpecialOffers(client.membershipType, client.membershipPeriod);
  const offerName = offers.length > 0 ? offers.map(o => o.type).join(', ') : 'No offer';

  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidTime, setPaidTime] = useState(new Date().toTimeString().slice(0, 5));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create datetime string with date and time
      const paidDateTime = `${paidDate}T${paidTime}:00`;
      
      await paymentApi.create({
        clientId: client.clientId,
        name: client.name,
        amount: baseAmount,
        finalAmount: totalAmount,
        paidAmount: paymentAmount,
        membershipPeriod: client.membershipPeriod,
        offerDiscount: discountPercentage,
        discount: discountAmount,
        discountType: offerName,
        notes,
        paidDate: paidDateTime,
      });

      // Refresh clients to get updated payment data
      refreshClients();

      toast({
        title: "Payment Recorded! 💰",
        description: `${formatCurrency(paymentAmount)} payment recorded for ${client.name}`,
      });

      onClose();
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
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
            Record Payment
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-gym-gold/10 border border-primary/20 mb-4">
          <div className="grid grid-cols-2 gap-4 text-center mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Base Amount</p>
              <p className="text-lg font-semibold">{formatCurrency(baseAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Discount ({discountPercentage}%)</p>
              <p className="text-lg font-semibold text-success">-{formatCurrency(discountAmount)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center border-t border-primary/20 pt-3">
            <div>
              <p className="text-sm text-muted-foreground">Final Amount</p>
              <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(remainingAmount)}</p>
            </div>
          </div>
          <div className="text-center mt-2 text-xs text-muted-foreground">
            {client.membershipPeriod} month{client.membershipPeriod > 1 ? 's' : ''} • {offerName}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                className="pl-10"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paidDate">Payment Date</Label>
              <Input
                id="paidDate"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidTime">Payment Time</Label>
              <Input
                id="paidTime"
                type="time"
                value={paidTime}
                onChange={(e) => setPaidTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this payment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
