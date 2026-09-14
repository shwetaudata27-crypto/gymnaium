import { useState } from 'react';
import { Client } from '@/types/gym';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { emailApi } from '@/services/apiService';
import { formatCurrency, calculateDiscountedPrice } from '@/utils/pricing';
import { CreditCard, Send, MessageSquare, User, IndianRupee, AlertTriangle } from 'lucide-react';

interface PendingPaymentsModalProps {
  clients: Client[];
  onClose: () => void;
  onAddPayment: (client: Client) => void;
  onEmailSent?: () => void;
}

const COOLDOWN_DAYS = 7;

const getPaymentReminderKey = (clientId: string) => `payment_reminder_${clientId}`;

export const isPaymentReminderInCooldown = (clientId: string): boolean => {
  const sentTime = localStorage.getItem(getPaymentReminderKey(clientId));
  if (!sentTime) return false;
  const sentDate = new Date(parseInt(sentTime, 10));
  const now = new Date();
  const diffDays = (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < COOLDOWN_DAYS;
};

const markPaymentReminderSent = (clientId: string) => {
  localStorage.setItem(getPaymentReminderKey(clientId), Date.now().toString());
};

export function PendingPaymentsModal({ clients, onClose, onAddPayment, onEmailSent }: PendingPaymentsModalProps) {
  const { toast } = useToast();
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentMessages, setSentMessages] = useState<Set<string>>(() => {
    const inCooldown = new Set<string>();
    clients.forEach(c => {
      if (isPaymentReminderInCooldown(c.clientId)) inCooldown.add(c.clientId);
    });
    return inCooldown;
  });

  const clientsWithPendingPayments = clients.filter((client) => {
    if (isPaymentReminderInCooldown(client.clientId)) return false;
    const totalPaid = client.payments?.reduce((sum, p) => sum + p.paidAmount, 0) || 0;
    const totalAmount = client.finalAmount || calculateDiscountedPrice(client.membershipType, client.membershipPeriod);
    return totalAmount - totalPaid > 0;
  }).map((client) => {
    const totalPaid = client.payments?.reduce((sum, p) => sum + p.paidAmount, 0) || 0;
    const totalAmount = client.finalAmount || calculateDiscountedPrice(client.membershipType, client.membershipPeriod);
    return { ...client, totalAmount, totalPaid, remainingAmount: totalAmount - totalPaid };
  }).sort((a, b) => b.remainingAmount - a.remainingAmount);

  const handleSendReminder = async (client: typeof clientsWithPendingPayments[0]) => {
    setSendingTo(client.clientId);
    try {
      const message = [
        `Hi ${client.name},`,
        '',
        `This is a reminder that your pending gym payment is Rs.${client.remainingAmount.toLocaleString()}.`,
        `Total: Rs.${client.totalAmount.toLocaleString()}, Paid: Rs.${client.totalPaid.toLocaleString()}.`,
        '',
        'Please settle the remaining amount at your earliest convenience to keep your membership active.',
        'If you have any questions, reply to this email and we’ll assist you immediately.',
      ].join('\n');

      await emailApi.send({
        clientId: client.clientId,
        emailType: 'payment_reminder',
        message,
        subject: 'Payment Reminder from US Gymnasium',
      });

      markPaymentReminderSent(client.clientId);
      setSentMessages(prev => new Set([...prev, client.clientId]));
      onEmailSent?.();

      toast({
        title: "Reminder Email Sent! 📧",
        description: `Payment reminder sent to ${client.name} (${client.email})`,
      });
    } catch (error) {
      toast({
        title: "Failed to send email",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSendingTo(null);
    }
  };

  const totalPending = clientsWithPendingPayments.reduce((sum, c) => sum + c.remainingAmount, 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="w-6 h-6 text-primary" />
            Pending Payments
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {clientsWithPendingPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No pending payments to show!</p>
              <p className="text-xs text-muted-foreground mt-2">Clients with reminders sent will reappear after 1 week</p>
            </div>
          ) : (
            <>
              <Card variant="glass" className="bg-destructive/10 border-destructive/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <span className="font-medium">Total Pending</span>
                    </div>
                    <span className="text-xl font-bold text-destructive">{formatCurrency(totalPending)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {clientsWithPendingPayments.length} member{clientsWithPendingPayments.length > 1 ? 's have' : ' has'} pending payments
                  </p>
                </CardContent>
              </Card>
              
              {clientsWithPendingPayments.map((client) => (
                <Card key={client.clientId} variant="glass">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{client.name}</p>
                          <p className="text-sm text-muted-foreground">{client.phone}</p>
                          <p className="text-xs text-muted-foreground">ID: {client.clientId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <span>Total:</span><span>{formatCurrency(client.totalAmount)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-success">
                          <span>Paid:</span><span>{formatCurrency(client.totalPaid)}</span>
                        </div>
                        <div className="flex items-center gap-1 font-bold text-destructive mt-1">
                          <IndianRupee className="w-4 h-4" />
                          <span>{client.remainingAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 justify-end">
                      <Button size="sm" variant="outline" onClick={() => { onAddPayment(client); onClose(); }} className="gap-2">
                        <CreditCard className="w-4 h-4" /> Add Payment
                      </Button>
                      <Button
                        size="sm"
                        variant={sentMessages.has(client.clientId) ? "outline" : "hero"}
                        onClick={() => handleSendReminder(client)}
                        disabled={sendingTo === client.clientId || sentMessages.has(client.clientId)}
                        className="gap-2"
                      >
                        {sentMessages.has(client.clientId) ? (
                          <><MessageSquare className="w-4 h-4" /> Sent</>
                        ) : sendingTo === client.clientId ? 'Sending...' : (
                          <><Send className="w-4 h-4" /> Send Email</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
