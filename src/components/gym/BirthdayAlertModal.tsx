import { useState } from 'react';
import { Client } from '@/types/gym';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { emailApi } from '@/services/apiService';
import { Cake, Send, MessageSquare, User } from 'lucide-react';

interface BirthdayAlertModalProps {
  clients: Client[];
  onClose: () => void;
  onEmailSent?: () => void;
}

const COOLDOWN_DAYS = 1;

const getBirthdayEmailKey = (clientId: string) => `birthday_email_${clientId}`;

export const isBirthdayEmailInCooldown = (clientId: string): boolean => {
  const sentTime = localStorage.getItem(getBirthdayEmailKey(clientId));
  if (!sentTime) return false;
  const sentDate = new Date(parseInt(sentTime, 10));
  const now = new Date();
  const diffDays = (now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < COOLDOWN_DAYS;
};

const markBirthdayEmailSent = (clientId: string) => {
  localStorage.setItem(getBirthdayEmailKey(clientId), Date.now().toString());
};

export function BirthdayAlertModal({ clients, onClose, onEmailSent }: BirthdayAlertModalProps) {
  const { toast } = useToast();
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentMessages, setSentMessages] = useState<Set<string>>(() => {
    const inCooldown = new Set<string>();
    clients.forEach(c => {
      if (isBirthdayEmailInCooldown(c.clientId)) inCooldown.add(c.clientId);
    });
    return inCooldown;
  });

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const birthdayClients = clients.filter((client) => {
    if (!client.dob) return false;
    if (isBirthdayEmailInCooldown(client.clientId)) return false;
    let dobDate: Date;
    if (client.dob.includes('-')) {
      const parts = client.dob.split('-');
      dobDate = parts[0].length === 4 ? new Date(client.dob) : new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else if (client.dob.includes('/')) {
      const parts = client.dob.split('/');
      dobDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      return false;
    }
    return dobDate.getMonth() + 1 === todayMonth && dobDate.getDate() === todayDay;
  });

  const handleSendBirthdayEmail = async (client: Client) => {
    setSendingTo(client.clientId);
    try {
      const message = [
        `Hi ${client.name},`,
        '',
        'Warm birthday wishes from US Gymnasium! We hope your day is full of joy, good health, and strength.',
        'If you have any questions or want a birthday membership update, reply to this email and we’ll help you right away.',
      ].join('\n');

      await emailApi.send({
        clientId: client.clientId,
        emailType: 'birthday',
        message,
        subject: 'Happy Birthday from US Gymnasium',
      });

      markBirthdayEmailSent(client.clientId);
      setSentMessages(prev => new Set([...prev, client.clientId]));
      onEmailSent?.();

      toast({
        title: "Birthday Email Sent! 🎂",
        description: `Birthday wishes sent to ${client.name} (${client.email})`,
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Cake className="w-6 h-6 text-primary" />
            Today's Birthdays
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {birthdayClients.length === 0 ? (
            <div className="text-center py-8">
              <Cake className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No birthdays to send wishes today!</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {birthdayClients.length} member{birthdayClients.length > 1 ? 's have' : ' has'} birthday today!
              </p>
              {birthdayClients.map((client) => (
                <Card key={client.clientId} variant="glass">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
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
                      <Button
                        size="sm"
                        variant={sentMessages.has(client.clientId) ? "outline" : "hero"}
                        onClick={() => handleSendBirthdayEmail(client)}
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
