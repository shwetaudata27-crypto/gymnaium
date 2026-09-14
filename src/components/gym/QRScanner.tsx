import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/utils/pricing';
import phonePeQR from '@/assets/phonepe-qr.jpeg';

interface QRScannerProps {
  amount: number;
  clientId: string;
  clientName: string;
}

export function QRScanner({ amount, clientId, clientName }: QRScannerProps) {
  return (
    <Card variant="glass" className="animate-slide-up bg-black/90 border-purple-500/30">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">₱</span>
          </div>
          <span className="text-2xl font-semibold text-white">PhonePe</span>
        </div>
        <p className="text-purple-400 font-semibold tracking-wide">ACCEPTED HERE</p>
        <p className="text-gray-300 text-sm">Scan & Pay Using PhonePe App</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <div className="p-2 bg-white rounded-xl">
            <img 
              src={phonePeQR} 
              alt="PhonePe Payment QR Code" 
              className="w-64 h-64 object-contain rounded-lg"
            />
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-xl font-bold text-white uppercase tracking-wide">{clientName}</p>
          <p className="text-gray-400 text-sm">Client ID: <span className="text-purple-400">{clientId}</span></p>
        </div>

        <div className="text-center p-4 rounded-xl bg-purple-600/20 border border-purple-500/30">
          <p className="text-sm text-gray-400 mb-1">Amount to Pay</p>
          <p className="text-3xl font-bold text-white">{formatCurrency(amount)}</p>
        </div>

        <div className="text-center text-sm text-gray-400">
          <p>Open PhonePe app → Scan QR → Pay</p>
        </div>
      </CardContent>
    </Card>
  );
}
