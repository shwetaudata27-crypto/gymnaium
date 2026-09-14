import { Client } from '@/types/gym';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, calculateDiscountedPrice } from '@/utils/pricing';
import { 
  User, Phone, Mail, Calendar, MapPin, Briefcase, 
  CreditCard, Clock, CheckCircle 
} from 'lucide-react';

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
  onAddPayment: () => void;
}

export function ClientDetailModal({ client, onClose, onAddPayment }: ClientDetailModalProps) {
  const totalPaid = client.payments?.reduce((sum, p) => sum + p.paidAmount, 0) || 0;
  // Use stored finalAmount if available, otherwise calculate discounted price
  const totalAmount = client.finalAmount || calculateDiscountedPrice(client.membershipType, client.membershipPeriod);
  const remainingAmount = totalAmount - totalPaid;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-gym-gold flex items-center justify-center">
              <span className="text-xl font-bold text-primary-foreground">
                {client.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{client.name}</h2>
              <p className="text-sm text-muted-foreground">Client ID: {client.clientId}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personal Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Personal Information
              </h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {client.email}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {client.phone}
                </p>
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  DOB: {new Date(client.dob).toLocaleDateString()} ({client.age} years)
                </p>
                <p className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  {client.gender?.charAt(0).toUpperCase() + client.gender?.slice(1)}
                </p>
                {client.occupation && (
                  <p className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    {client.occupation}
                  </p>
                )}
                {client.address && (
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {client.address}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Membership Details
              </h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {client.membershipType.gym && <Badge className="bg-primary/20 text-primary">Gym</Badge>}
                {client.membershipType.cardio && <Badge className="bg-primary/20 text-primary">Cardio</Badge>}
                {client.membershipType.crossfit && <Badge className="bg-primary/20 text-primary">Crossfit</Badge>}
                {client.membershipType.pt && <Badge className="bg-primary/20 text-primary">PT</Badge>}
              </div>
              <div className="space-y-2 text-sm">
                <p>Period: {client.membershipPeriod} months</p>
                <p>Slot: {client.slot ? client.slot.charAt(0).toUpperCase() + client.slot.slice(1) : 'Not specified'}</p>
                <p>Start: {new Date(client.startDate).toLocaleDateString()}</p>
                <p>End: {new Date(client.endDate).toLocaleDateString()}</p>
                <p>Registered: {client.registrationDay}</p>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-gym-gold/10 border border-primary/20">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-primary" />
              Payment Summary
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount (After Discount)</p>
                <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-xl font-bold text-success">{formatCurrency(totalPaid)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className={`text-xl font-bold ${remainingAmount > 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatCurrency(Math.max(0, remainingAmount))}
                </p>
              </div>
            </div>

            {remainingAmount > 0 && (
              <Button variant="hero" className="w-full" onClick={onAddPayment}>
                Record Payment
              </Button>
            )}
          </div>

          {/* Payment History */}
          {client.payments && client.payments.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Payment History</h3>
              <div className="space-y-2">
                {client.payments.map((payment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <div>
                        <p className="font-medium">{formatCurrency(payment.paidAmount)}</p>
                        <p className="text-xs text-muted-foreground">{new Date(payment.paidDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {payment.notes && <p className="text-sm text-muted-foreground">{payment.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
