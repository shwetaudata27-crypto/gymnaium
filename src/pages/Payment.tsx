import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GymHeader } from '@/components/gym/GymHeader';
import { PaymentCalculator } from '@/components/gym/PaymentCalculator';
import { QRScanner } from '@/components/gym/QRScanner';
import { useGym } from '@/context/GymContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, AlertCircle } from 'lucide-react';

const Payment = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { getClientById, updateClient, loading } = useGym();
  const [showQR, setShowQR] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);

  const client = clientId ? getClientById(clientId) : undefined;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <GymHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading client data...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background">
        <GymHeader />
        <main className="container mx-auto px-4 py-8">
          <Card variant="glass" className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-bold mb-2">Client Not Found</h2>
              <p className="text-muted-foreground mb-6">
                The client you're looking for doesn't exist.
              </p>
              <Button variant="hero" onClick={() => navigate('/')}>
                Go to Home
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handleProceedToPayment = async (amount: number, discount: number) => {
    // Save the final amount with offer applied to the client record
    try {
      await updateClient(client.clientId, { finalAmount: amount });
    } catch (error) {
      console.error('Failed to update final amount:', error);
    }
    setPaymentAmount(amount);
    setShowQR(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <GymHeader />
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => showQR ? setShowQR(false) : navigate(-1)}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="max-w-lg mx-auto">
          {showQR ? (
            <QRScanner 
              amount={paymentAmount} 
              clientId={client.clientId} 
              clientName={client.name} 
            />
          ) : (
            <PaymentCalculator 
              client={client} 
              onProceedToPayment={handleProceedToPayment} 
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default Payment;
