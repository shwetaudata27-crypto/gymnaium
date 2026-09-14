import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGym } from '@/context/GymContext';
import { formatCurrency, calculateDiscountedPrice, calculateBasePrice, getSpecialOffers } from '@/utils/pricing';
import { QRScanner } from './QRScanner';
import { Scan, Search, User, Calendar, CreditCard, Dumbbell, CheckCircle, XCircle, IndianRupee } from 'lucide-react';

export function ClientScanner() {
  const { getClientBySearch, clients } = useGym();
  const [searchTerm, setSearchTerm] = useState('');
  const [scannedClient, setScannedClient] = useState<typeof clients[0] | undefined>(undefined);
  const [hasSearched, setHasSearched] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleSearch = () => {
    setHasSearched(true);
    const results = getClientBySearch(searchTerm.trim());
    const foundClient = results.length > 0 ? results[0] : undefined;
    setScannedClient(foundClient);
    
    // Automatically show QR if client found and has remaining amount
    if (foundClient) {
      const totalPaid = foundClient.payments?.reduce((sum, p) => sum + p.paidAmount, 0) || 0;
      const clientFinalAmount = foundClient.finalAmount || calculateDiscountedPrice(foundClient.membershipType, foundClient.membershipPeriod);
      const remaining = clientFinalAmount - totalPaid;
      setShowQR(remaining > 0);
    } else {
      setShowQR(false);
    }
  };

  const isActive = scannedClient && new Date(scannedClient.endDate) > new Date();
  const totalPaid = scannedClient?.payments?.reduce((sum, p) => sum + p.paidAmount, 0) || 0;
  
  // Calculate amounts with offer details
  const baseAmount = scannedClient ? calculateBasePrice(scannedClient.membershipType, scannedClient.membershipPeriod) : 0;
  const finalAmount = scannedClient?.finalAmount || (scannedClient ? calculateDiscountedPrice(scannedClient.membershipType, scannedClient.membershipPeriod) : 0);
  const offerDiscount = baseAmount - finalAmount;
  const remainingAmount = finalAmount - totalPaid;
  
  // Get applied offers
  const appliedOffers = scannedClient ? getSpecialOffers(scannedClient.membershipType, scannedClient.membershipPeriod) : [];

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card variant="glass" className="animate-slide-up">
        <CardHeader className="text-center">
          <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-primary to-gym-gold glow mb-4">
            <Scan className="w-10 h-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl gradient-text">Client Scanner</CardTitle>
          <CardDescription>Search by Client Name or ID to view membership details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Name or Client ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="text-lg text-center"
            />
            <Button variant="hero" onClick={handleSearch}>
              <Search className="w-5 h-5" />
            </Button>
          </div>

          {hasSearched && !scannedClient && (
            <div className="text-center p-6 rounded-xl bg-destructive/10 border border-destructive/30">
              <XCircle className="w-12 h-12 mx-auto text-destructive mb-2" />
              <p className="text-destructive font-medium">Client not found</p>
              <p className="text-sm text-muted-foreground">Please check your search term and try again</p>
            </div>
          )}

          {scannedClient && (
            <div className="space-y-4 animate-fade-in">
              {/* Status Badge */}
              <div className="flex justify-center">
                {isActive ? (
                  <Badge className="bg-success/20 text-success border-success/30 text-lg py-2 px-4 gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Active Member
                  </Badge>
                ) : (
                  <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-lg py-2 px-4 gap-2">
                    <XCircle className="w-5 h-5" />
                    Membership Expired
                  </Badge>
                )}
              </div>

              {/* Client Info */}
              <div className="p-4 rounded-xl bg-secondary/30 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-gym-gold flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary-foreground">
                      {scannedClient.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{scannedClient.name}</h3>
                    <p className="text-sm text-muted-foreground">ID: {scannedClient.clientId}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {scannedClient.membershipType.gym && <Badge className="bg-primary/20 text-primary">Gym</Badge>}
                  {scannedClient.membershipType.cardio && <Badge className="bg-primary/20 text-primary">Cardio</Badge>}
                  {scannedClient.membershipType.crossfit && <Badge className="bg-primary/20 text-primary">Crossfit</Badge>}
                  {scannedClient.membershipType.pt && <Badge className="bg-primary/20 text-primary">PT</Badge>}
                </div>
              </div>

              {/* Membership Period */}
              <div className="p-4 rounded-xl bg-secondary/30">
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  Membership Period ({scannedClient.membershipPeriod} Month{scannedClient.membershipPeriod > 1 ? 's' : ''})
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Start Date</p>
                    <p className="font-medium">{new Date(scannedClient.startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">End Date</p>
                    <p className={`font-medium ${!isActive ? 'text-destructive' : ''}`}>
                      {new Date(scannedClient.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-gym-gold/10 border border-primary/20">
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Payment Details
                </h4>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actual Amount:</span>
                    <span className="font-medium">{formatCurrency(baseAmount)}</span>
                  </div>
                  
                  {offerDiscount > 0 && (
                    <>
                      <div className="flex justify-between text-success">
                        <span>Offer Discount:</span>
                        <span>-{formatCurrency(offerDiscount)}</span>
                      </div>
                      {appliedOffers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {appliedOffers.map((offer, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                              {offer.type} ({offer.percentage}%)
                            </Badge>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">Final Amount:</span>
                    <span className="font-bold text-primary">{formatCurrency(finalAmount)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
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
              </div>

              {/* Pay Now Button */}
              {remainingAmount > 0 && (
                <Button 
                  variant="hero" 
                  className="w-full"
                  onClick={() => setShowQR(!showQR)}
                >
                  <IndianRupee className="w-4 h-4 mr-2" />
                  {showQR ? 'Hide QR Code' : 'Pay Now'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Section */}
      {showQR && scannedClient && remainingAmount > 0 && (
        <QRScanner 
          amount={remainingAmount} 
          clientId={scannedClient.clientId} 
          clientName={scannedClient.name} 
        />
      )}
    </div>
  );
}
