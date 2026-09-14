import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Client, PRICING } from '@/types/gym';
import { 
  calculateBasePrice, 
  getSpecialOffers, 
  calculateFinalPrice, 
  formatCurrency 
} from '@/utils/pricing';
import { Percent, Sparkles, CreditCard, Check, Gift } from 'lucide-react';

interface PaymentCalculatorProps {
  client: Client;
  onProceedToPayment: (amount: number, discount: number, freeMonths?: number) => void;
}

export function PaymentCalculator({ client, onProceedToPayment }: PaymentCalculatorProps) {
  const [selectedOffer, setSelectedOffer] = useState<{ percentage: number; freeMonths?: number } | null>(null);

  const basePrice = calculateBasePrice(client.membershipType, client.membershipPeriod);
  const specialOffers = getSpecialOffers(client.membershipType, client.membershipPeriod);
  
  const selectedPercentage = selectedOffer?.percentage || 0;
  const { finalPrice, totalDiscount } = calculateFinalPrice(
    basePrice,
    0,
    selectedPercentage
  );

  // Find the best offer (highest discount or free months)
  const bestOffer = specialOffers.reduce((best, offer) => {
    if (!best) return offer;
    if (offer.freeMonths && offer.freeMonths > (best.freeMonths || 0)) return offer;
    if (offer.percentage > best.percentage) return offer;
    return best;
  }, null as { type: string; percentage: number; freeMonths?: number } | null);

  return (
    <Card variant="glass" className="animate-slide-up">
      <CardHeader>
        <CardTitle className="text-2xl gradient-text flex items-center gap-2">
          <CreditCard className="w-6 h-6" />
          Payment Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price Breakdown */}
        <div className="space-y-3 p-4 rounded-xl bg-secondary/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Admission Fee</span>
            <span>₹100</span>
          </div>
          
          {client.membershipType.gym && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gym ({client.membershipPeriod} months)</span>
              <span>{formatCurrency(PRICING.gymPerMonth * client.membershipPeriod)}</span>
            </div>
          )}
          
          {client.membershipType.cardio && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cardio ({client.membershipPeriod} months)</span>
              <span>{formatCurrency(PRICING.cardioPerMonth * client.membershipPeriod)}</span>
            </div>
          )}
          
          {client.membershipType.crossfit && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Crossfit ({client.membershipPeriod} months)</span>
              <span>{formatCurrency(PRICING.crossfitPerMonth * client.membershipPeriod)}</span>
            </div>
          )}
          
          {client.membershipType.pt && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Personal Training ({client.membershipPeriod} months)</span>
              <span>{formatCurrency(PRICING.ptPerMonth * client.membershipPeriod)}</span>
            </div>
          )}
          
          <div className="border-t border-border pt-3 flex justify-between font-semibold">
            <span>Subtotal</span>
            <span>{formatCurrency(basePrice)}</span>
          </div>
        </div>

        {/* Available Offers */}
        {specialOffers.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gym-gold" />
              Available Offers (Select One)
            </h4>
            
            <div className="grid gap-3">
              {specialOffers.map((offer, index) => {
                const isSelected = selectedOffer?.percentage === offer.percentage && 
                                   selectedOffer?.freeMonths === offer.freeMonths;
                const isFreeMonthsOffer = offer.freeMonths && offer.freeMonths > 0;
                
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedOffer({ 
                      percentage: offer.percentage, 
                      freeMonths: offer.freeMonths 
                    })}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                      isSelected
                        ? 'border-primary bg-primary/10 glow-sm'
                        : 'border-border hover:border-primary/50 bg-secondary/20'
                    } ${offer === bestOffer ? 'animate-zoom-pulse' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isSelected ? 'bg-primary' : 'bg-secondary'
                        }`}>
                          {isFreeMonthsOffer ? (
                            <Gift className={`w-5 h-5 ${
                              isSelected ? 'text-primary-foreground' : 'text-primary'
                            }`} />
                          ) : (
                            <Percent className={`w-5 h-5 ${
                              isSelected ? 'text-primary-foreground' : 'text-primary'
                            }`} />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{offer.type}</p>
                          {isFreeMonthsOffer ? (
                            <p className="text-sm text-muted-foreground">
                              Get {offer.freeMonths} extra month{offer.freeMonths! > 1 ? 's' : ''} free!
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Save {formatCurrency((basePrice * offer.percentage) / 100)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {isFreeMonthsOffer ? (
                          <>
                            <span className="text-2xl font-bold text-primary">+{offer.freeMonths}</span>
                            <span className="text-sm text-muted-foreground block">MONTH{offer.freeMonths! > 1 ? 'S' : ''} FREE</span>
                          </>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-primary">{offer.percentage}%</span>
                            <span className="text-sm text-muted-foreground block">OFF</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    
                    {offer === bestOffer && (
                      <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-gym-gold text-primary-foreground text-xs font-bold rounded-full">
                        BEST
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Final Amount */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-primary/20 to-gym-gold/20 border border-primary/30">
          {totalDiscount > 0 && (
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Discount ({totalDiscount}%)</span>
              <span className="text-success">-{formatCurrency((basePrice * totalDiscount) / 100)}</span>
            </div>
          )}
          {selectedOffer?.freeMonths && selectedOffer.freeMonths > 0 && (
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Free Months</span>
              <span className="text-success">+{selectedOffer.freeMonths} month{selectedOffer.freeMonths > 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Total Amount</span>
            <div className="text-right">
              {totalDiscount > 0 && (
                <span className="text-sm text-muted-foreground line-through block">
                  {formatCurrency(basePrice)}
                </span>
              )}
              <span className="text-3xl font-bold gradient-text">{formatCurrency(finalPrice)}</span>
            </div>
          </div>
        </div>

        <Button 
          variant="hero" 
          size="xl" 
          className="w-full"
          onClick={() => onProceedToPayment(finalPrice, totalDiscount, selectedOffer?.freeMonths)}
        >
          Proceed to Payment
        </Button>
      </CardContent>
    </Card>
  );
}
