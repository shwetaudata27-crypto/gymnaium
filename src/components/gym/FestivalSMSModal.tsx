import { useState } from 'react';
import { Client } from '@/types/gym';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { emailApi } from '@/services/apiService';
import { PartyPopper, Send, Users } from 'lucide-react';

interface FestivalSMSModalProps {
  clients: Client[];
  onClose: () => void;
}

const FESTIVAL_TEMPLATES = {
  diwali: {
    subject: 'Happy Diwali from US Gymnasium',
    message: `Warm Diwali wishes from US Gymnasium. May this festival of lights bring joy, health, and strength to you and your family.`,
  },
  holi: {
    subject: 'Happy Holi from US Gymnasium',
    message: `Warm Holi greetings from US Gymnasium. May your days be bright, healthy, and full of energy.`,
  },
  newyear: {
    subject: 'Happy New Year from US Gymnasium',
    message: `Wishing you a strong and healthy new year from US Gymnasium. Thank you for being part of our fitness family.`,
  },
  independence: {
    subject: 'Independence Day greetings from US Gymnasium',
    message: `Happy Independence Day from US Gymnasium. Celebrate freedom with strength, health, and determination.`,
  },
  custom: {
    subject: '',
    message: '',
  },
};

export function FestivalSMSModal({ clients, onClose }: FestivalSMSModalProps) {
  const { toast } = useToast();
  const [templateType, setTemplateType] = useState<keyof typeof FESTIVAL_TEMPLATES>('diwali');
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });

  const getMessage = () => {
    if (templateType === 'custom') return customMessage;
    return FESTIVAL_TEMPLATES[templateType].message;
  };

  const handleSendToAll = async () => {
    const message = getMessage();
    if (!message.trim()) {
      toast({ title: "Missing Message", description: "Please provide a message", variant: "destructive" });
      return;
    }

    setIsSending(true);
    setProgress({ sent: 0, total: clients.length });

    let successCount = 0;
    let failCount = 0;

    for (const client of clients) {
      try {
        await emailApi.send({
          clientId: client.clientId,
          emailType: 'festival',
          message,
          subject: FESTIVAL_TEMPLATES[templateType].subject || 'Greetings from US Gymnasium',
        });
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to send email to ${client.email}:`, error);
      }
      setProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
    }

    setIsSending(false);

    if (successCount > 0) {
      toast({
        title: "Emails Sent! 🎉",
        description: `Successfully sent to ${successCount} member${successCount > 1 ? 's' : ''}${failCount > 0 ? `. Failed: ${failCount}` : ''}`,
      });
    } else {
      toast({ title: "Failed to send email", description: "Could not send messages. Please try again.", variant: "destructive" });
    }

    if (failCount === 0) onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <PartyPopper className="w-6 h-6 text-primary" />
            Festival / Holiday Emails
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-sm">
              Email will be sent to <strong>{clients.length}</strong> member{clients.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2">
            <Label>Select Occasion</Label>
            <Select value={templateType} onValueChange={(v) => setTemplateType(v as keyof typeof FESTIVAL_TEMPLATES)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diwali">🪔 Diwali</SelectItem>
                <SelectItem value="holi">🎨 Holi</SelectItem>
                <SelectItem value="newyear">🎉 New Year</SelectItem>
                <SelectItem value="independence">🇮🇳 Independence Day</SelectItem>
                <SelectItem value="custom">✏️ Custom Message</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {templateType === 'custom' ? (
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea placeholder="Type your email message..." rows={4} maxLength={160} value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} />
              <p className="text-xs text-muted-foreground text-right">{customMessage.length}/160 characters</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Message Preview</Label>
              <div className="p-4 rounded-lg bg-secondary/50 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                {FESTIVAL_TEMPLATES[templateType].message}
              </div>
            </div>
          )}

          {isSending && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sending messages...</span>
                <span>{progress.sent} / {progress.total}</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(progress.sent / progress.total) * 100}%` }} />
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSending}>Cancel</Button>
            <Button variant="hero" className="flex-1 gap-2" onClick={handleSendToAll} disabled={isSending || clients.length === 0}>
              <Send className="w-4 h-4" />
              {isSending ? `Sending... (${progress.sent}/${progress.total})` : 'Send to All'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
