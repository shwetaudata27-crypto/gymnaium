import { useState } from 'react';
import { Client } from '@/types/gym';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { calculateDiscountedPrice } from '@/utils/pricing';
import { emailApi } from '@/services/apiService';
import { Send, Mail } from 'lucide-react';

const GOOGLE_REVIEW_LINK = 'https://www.google.com/search?q=us+gymnasium+in+solapur&rlz=1C1YTUH_enIN1082IN1082&oq=us&gs_lcrp=EgZjaHJvbWUqBggBECMYJzIGCAAQRRg5MgYIARAjGCcyDQgCEAAYgwEYsQMYgAQyDQgDEAAYgwEYsQMYgAQyCggEEAAYsQMYgAQyBggFEEUYPTIGCAYQRRg8MgYIBxBFGDzSAQgyNTQxajBqN6gCALACAA&sourceid=chrome&ie=UTF-8#lrd=0x3bc5db221e1fab99:0xe5e60b898a66c2b2,3,,,,';

const rawPublicAppUrl = String(import.meta.env.VITE_APP_URL || '').trim();
const PUBLIC_APP_URL = rawPublicAppUrl && !/[<>]/.test(rawPublicAppUrl)
  ? rawPublicAppUrl
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
const getReviewUrl = (clientId: string) => `${PUBLIC_APP_URL.replace(/\/$/, '')}/review?clientId=${encodeURIComponent(clientId)}`;

export function buildEmailHtml({ headerText, headline, bodyText, buttonText, buttonUrl, footerText, includeReview = false }: {
  headerText: string;
  headline: string;
  bodyText: string;
  buttonText?: string;
  buttonUrl?: string;
  footerText: string;
  includeReview?: boolean;
}) {
  const bodyHtml = String(bodyText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.75; color: #0f172a;">${line}</p>`)
    .join('');

  const reviewHtml = includeReview ? `<br><br><span style="font-weight: 700;">⭐ Rate us on Google: <a href="${GOOGLE_REVIEW_LINK}" style="color: #2563eb; text-decoration: none;">${GOOGLE_REVIEW_LINK}</a></span>` : '';
  const footerHtml = `${footerText}${reviewHtml}`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${headerText || 'US Gymnasium'}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #eef2ff;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%; background: #eef2ff; padding: 24px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background: #ffffff; border-radius: 28px; overflow: hidden; border: 1px solid #dbeafe; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08);">
            <tr>
              <td style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px; text-align: center; color: #ffffff;">
                <p style="margin: 0 0 12px; font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.85;">${headerText}</p>
                <h1 style="margin: 0; font-size: 32px; line-height: 1.1; font-weight: 800;">${headline}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px; color: #0f172a; font-family: Inter, system-ui, sans-serif;">
                ${bodyHtml}
                ${buttonText && buttonUrl ? `<p style="margin: 24px 0 0;"><a href="${buttonUrl}" style="display: inline-block; padding: 14px 24px; border-radius: 999px; background: #111827; color: #ffffff; text-decoration: none; font-weight: 700;">${buttonText}</a></p>` : ''}
                <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.75; color: #475569;">${footerHtml}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

interface SendSMSModalProps {
  client: Client;
  onClose: () => void;
  context?: 'default' | 'renewal' | 'registration';
}

export const EMAIL_TEMPLATES = {
  welcome: {
    label: 'Welcome Message',
    getText: (client: Client) =>
      `Welcome to US Gymnasium, ${client.name}! Your fitness journey starts today, and we are proud to stand with you at every step. Your workout slot is ${client.slot}, your plan starts on ${new Date(client.startDate).toLocaleDateString()}, and your current membership runs until ${new Date(client.endDate).toLocaleDateString()}. Stay consistent, train with discipline, and remember — small daily effort creates big transformation. Share your first impressions with us here: ${getReviewUrl(client.clientId)}. Let’s build your strongest self together! 💪`,
    getHtml: (client: Client) => buildEmailHtml({
      headerText: 'Welcome to US Gymnasium',
      headline: `Hi ${client.name}, welcome aboard!`,
      bodyText: [
        `Your Client ID is ${client.clientId}.`,
        client.slot ? `Workout slot: ${client.slot}.` : '',
        client.startDate ? `Your plan starts on ${new Date(client.startDate).toLocaleDateString()}.` : '',
        client.endDate ? `Membership valid until ${new Date(client.endDate).toLocaleDateString()}.` : '',
        'We’re excited to support your fitness journey. Share your first impressions with us after your first visit.',
      ].filter(Boolean).join(' '),
      buttonText: 'Share your review',
      buttonUrl: getReviewUrl(client.clientId),
      footerText: 'Reply to this email if you have any questions. We’re here to help you stay consistent and strong.',
      includeReview: true,
    }),
  },
  renewalReminder: {
    label: 'Renewal Reminder',
    getText: (client: Client) => `Hi ${client.name}, your membership has expired or is about to expire. Please renew your membership to continue training with us.`,
    getHtml: (client: Client) => buildEmailHtml({
      headerText: 'Renewal Reminder',
      headline: `Membership Renewal Required`,
      bodyText: `Hi ${client.name}, your membership has expired or is due for renewal. Please visit the gym or contact us to renew and keep your progress going.`,
      footerText: 'If you need help renewing your membership, reply to this email and we will assist you.',
      includeReview: false,
    }),
  },
  renewalPayment: {
    label: 'Renewal Payment Confirmation',
    getText: (client: Client, amount?: number) => `Hi ${client.name}, we have received your renewal payment of Rs.${amount?.toLocaleString() || '0'}. Thank you for continuing with US Gymnasium.`,
    getHtml: (client: Client, amount?: number) => buildEmailHtml({
      headerText: 'Renewal Payment Received',
      headline: `Payment Received`,
      bodyText: `Hi ${client.name}, we have recorded your renewal payment of Rs.${amount?.toLocaleString() || '0'}. Thank you for continuing your membership with us.`,
      footerText: 'If you have any questions about this payment or membership, reply to this email.',
      includeReview: false,
    }),
  },
  welcomeBack: {
    label: 'Welcome Back',
    getText: (client: Client) => `Welcome back ${client.name}! We're glad you've renewed your membership. Let's keep building strength together.`,
    getHtml: (client: Client) => buildEmailHtml({
      headerText: 'Welcome Back to US Gymnasium',
      headline: `Welcome back, ${client.name}!`,
      bodyText: `Thank you for renewing your membership. We're excited to have you continue training with us.`,
      footerText: 'If you need help with your schedule or trainer allocation, reply to this email.',
      includeReview: false,
    }),
  },
  payment: {
    label: 'Payment Received',
    getText: (client: Client, remaining?: number) =>
      `Hi ${client.name}, we’ve recorded your payment of Rs.${remaining?.toLocaleString() || '0'} at US Gymnasium. Thank you for staying committed to your fitness goals. If you have any questions, please reply to this email.`,
    getHtml: (client: Client, remaining?: number) => buildEmailHtml({
      headerText: 'Payment Received',
      headline: `Payment processed successfully`,
      bodyText: `Hi ${client.name}, we’ve recorded your payment of Rs.${remaining?.toLocaleString() || '0'}. Thank you for staying committed to your fitness goals.`,
      footerText: 'If you have questions about this payment or your membership, reply to this email and we’ll help you right away.',
      includeReview: false,
    }),
  },
  custom: {
    label: 'Custom Message',
    getText: () => '',
    getHtml: (message: string) => buildEmailHtml({
      headerText: 'US Gymnasium',
      headline: 'A message from your team',
      bodyText: message,
      footerText: 'Reply to this email if you need assistance.',
      includeReview: false,
    }),
  },
};

export function SendSMSModal({ client, onClose, context = 'default' }: SendSMSModalProps) {
  const { toast } = useToast();
  // Filter templates based on context (renewal vs normal)
  const allowedTemplates = (() => {
    if (context === 'renewal') return ['renewalReminder', 'renewalPayment', 'welcomeBack'];
    if (context === 'registration') return ['welcome', 'payment', 'custom'];
    return Object.keys(EMAIL_TEMPLATES);
  })();

  const defaultTemplate = (allowedTemplates && allowedTemplates[0]) as keyof typeof EMAIL_TEMPLATES;
  const [templateType, setTemplateType] = useState<keyof typeof EMAIL_TEMPLATES>(defaultTemplate || 'welcome');
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const totalPaid = client.payments?.reduce((sum, p) => sum + p.paidAmount, 0) || 0;
  const totalAmount = client.finalAmount || calculateDiscountedPrice(client.membershipType, client.membershipPeriod);
  const remainingAmount = totalAmount - totalPaid;

  const getMessage = () => {
    if (templateType === 'custom') return customMessage;
    if (templateType === 'payment') return EMAIL_TEMPLATES.payment.getText(client, remainingAmount);
    if (templateType === 'renewalPayment') return EMAIL_TEMPLATES.renewalPayment.getText(client, remainingAmount);
    return (EMAIL_TEMPLATES as any)[templateType].getText(client);
  };

  const getHtmlMessage = () => {
    if (templateType === 'custom') return EMAIL_TEMPLATES.custom.getHtml(customMessage);
    if (templateType === 'payment') return EMAIL_TEMPLATES.payment.getHtml(client, remainingAmount);
    if (templateType === 'renewalPayment') return EMAIL_TEMPLATES.renewalPayment.getHtml(client, remainingAmount);
    return (EMAIL_TEMPLATES as any)[templateType].getHtml(client);
  };

  const handleSend = async () => {
    const message = getMessage();
    if (!message.trim()) {
      toast({ title: "Empty Message", description: "Please enter a message to send.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      await emailApi.send({
        clientId: client.clientId,
        emailType: templateType,
        text: message,
        html: getHtmlMessage(),
        subject: `US Gymnasium – ${EMAIL_TEMPLATES[templateType].label}`,
      });

      toast({
        title: "Email Sent! 📧",
        description: `Message sent to ${client.email}`,
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Failed to send email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Send Email to {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Message Template</Label>
            <Select
              value={templateType}
              onValueChange={(value) => setTemplateType(value as keyof typeof EMAIL_TEMPLATES)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedTemplates.map((key: any) => {
                  const tmpl = (EMAIL_TEMPLATES as any)[key];
                  return <SelectItem key={key} value={key}>{tmpl.label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Recipient</Label>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {client.email}
            </p>
          </div>

          {templateType === 'custom' ? (
            <div className="space-y-2">
              <Label>Custom Message</Label>
              <Textarea
                placeholder="Type your email message here..."
                rows={6}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Message Preview</Label>
              <div className="p-4 rounded-lg bg-secondary/50 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                {getMessage()}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="hero" 
              className="flex-1 gap-2" 
              onClick={handleSend}
              disabled={isSending || (templateType === 'custom' && !customMessage.trim())}
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending...' : 'Send Email'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
