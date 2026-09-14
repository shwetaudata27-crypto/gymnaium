import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ExportPdfModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (options: ExportOptions) => void;
}

export interface ExportOptions {
  sections: {
    clients: boolean;
    payments: boolean;
    all: boolean;
  };
  startDate: string;
  endDate: string;
}

export function ExportPdfModal({ open, onClose, onSubmit }: ExportPdfModalProps) {
  const [sections, setSections] = useState({
    clients: true,
    payments: false,
    all: false,
  });

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const toggle = (key: keyof typeof sections) => {
    if (key === 'all') {
      setSections({
        clients: true,
        payments: true,
        sms: true,
        all: true,
      });
    } else {
      setSections(prev => ({
        ...prev,
        all: false,
        [key]: !prev[key]
      }));
    }
  };

  const handleSubmit = () => {
    onSubmit({ sections, startDate, endDate });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export PDF Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* All database checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="all" 
              checked={sections.all} 
              onCheckedChange={() => toggle('all')} 
            />
            <Label htmlFor="all" className="font-medium">Export Entire Database</Label>
          </div>

          {/* Individual sections */}
          {!sections.all && (
            <div className="space-y-3 pl-4 border-l-2 border-muted">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="clients" 
                  checked={sections.clients} 
                  onCheckedChange={() => toggle('clients')} 
                />
                <Label htmlFor="clients">Clients</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="payments" 
                  checked={sections.payments} 
                  onCheckedChange={() => toggle('payments')} 
                />
                <Label htmlFor="payments">Payments</Label>
              </div>
            </div>
          )}

          {/* Date Range */}
          <div className="space-y-3">
            <Label className="font-medium">Date Range (Optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="startDate" className="text-xs text-muted-foreground">Start Date</Label>
                <Input 
                  id="startDate"
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate" className="text-xs text-muted-foreground">End Date</Label>
                <Input 
                  id="endDate"
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <Button onClick={handleSubmit} className="w-full">
            Generate PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
