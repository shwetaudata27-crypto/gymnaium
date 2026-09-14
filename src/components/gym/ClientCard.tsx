import { useState } from 'react';
import { Client } from '@/types/gym';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, calculateDiscountedPrice } from '@/utils/pricing';
import { 
  User, Phone, MessageSquare, Calendar, MapPin, Briefcase, 
  Eye, Edit, Trash2, Send, CreditCard, ChevronDown, ChevronUp, RotateCcw 
} from 'lucide-react';

interface ClientCardProps {
  client: Client;
  onView: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  onSendEmail: (client: Client) => void;
  onRenew: (client: Client) => void;
}

export function ClientCard({ client, onView, onEdit, onDelete, onSendEmail, onRenew }: ClientCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const totalPaid = client.payments?.reduce((sum, p) => sum + p.paidAmount, 0) || 0;
  // Use stored finalAmount if available, otherwise calculate discounted price
  const totalAmount = client.finalAmount || calculateDiscountedPrice(client.membershipType, client.membershipPeriod);
  const remainingAmount = totalAmount - totalPaid;

  const getMembershipBadges = () => {
    const badges = [];
    if (client.membershipType.gym) badges.push('Gym');
    if (client.membershipType.cardio) badges.push('Cardio');
    if (client.membershipType.crossfit) badges.push('Crossfit');
    if (client.membershipType.pt) badges.push('PT');
    return badges;
  };

  return (
    <Card variant="glass" className="overflow-hidden hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-0">
        {/* Main Info Row */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-gym-gold flex items-center justify-center flex-shrink-0 overflow-hidden">
              {client.photo ? (
                <img src={client.photo} alt={`${client.name} profile`} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-primary-foreground">
                  {client.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg truncate">{client.name}</h3>
                <Badge variant="outline" className="text-xs">ID: {client.clientId}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {client.phone}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {client.email || 'No email'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => onView(client)}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onRenew(client)}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(client)}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onSendEmail(client)}>
              <Send className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(client.clientId)} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Membership Badges */}
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {getMembershipBadges().map((badge) => (
            <Badge key={badge} className="bg-primary/20 text-primary border-primary/30">
              {badge}
            </Badge>
          ))}
          <Badge variant="outline" className="text-muted-foreground">
            {client.membershipPeriod} months
          </Badge>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t border-border p-4 space-y-4 animate-fade-in bg-secondary/10">
            {/* Personal Details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Personal Details</h4>
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <span>{client.gender?.charAt(0).toUpperCase() + client.gender?.slice(1)}, {client.age} years</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>DOB: {new Date(client.dob).toLocaleDateString()}</span>
                  </p>
                  {client.occupation && (
                    <p className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-primary" />
                      <span>{client.occupation}</span>
                    </p>
                  )}
                  {client.address && (
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{client.address}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Membership Period</h4>
                <div className="space-y-1 text-sm">
                  <p>Start: {new Date(client.startDate).toLocaleDateString()}</p>
                  <p>End: {new Date(client.endDate).toLocaleDateString()}</p>
                  <p>Registered on: {client.registrationDay}</p>
                </div>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-gym-gold/10 border border-primary/20">
              <h4 className="font-semibold flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-primary" />
                Payment Summary
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total (After Discount)</p>
                  <p className="font-bold text-lg">{formatCurrency(totalAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="font-bold text-lg text-success">{formatCurrency(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Remaining</p>
                  <p className={`font-bold text-lg ${remainingAmount > 0 ? 'text-destructive' : 'text-success'}`}>
                    {formatCurrency(Math.max(0, remainingAmount))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
