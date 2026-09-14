import { useState } from 'react';
import { Client, MembershipType } from '@/types/gym';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGym } from '@/context/GymContext';
import { useToast } from '@/hooks/use-toast';
import { calculateEndDate } from '@/utils/pricing';

interface EditClientModalProps {
  client: Client;
  onClose: () => void;
}

export function EditClientModal({ client, onClose }: EditClientModalProps) {
  const { updateClient } = useGym();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: client.name,
    email: client.email,
    phone: client.phone,
    address: client.address,
    occupation: client.occupation,
    dob: client.dob,
    gender: client.gender,
    membershipPeriod: client.membershipPeriod.toString(),
    startDate: client.startDate,
  });

  const [membershipType, setMembershipType] = useState<MembershipType>(client.membershipType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const months = parseInt(formData.membershipPeriod);
    const endDate = calculateEndDate(formData.startDate, months);

    try {
      await updateClient(client.clientId, {
        ...formData,
        membershipPeriod: months,
        endDate,
        membershipType,
      });

      toast({
        title: "Client Updated",
        description: "The client information has been updated successfully.",
      });

      onClose();
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client - {client.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value as 'male' | 'female' | 'other' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Membership Type</Label>
            <div className="grid grid-cols-4 gap-2">
              {(['gym', 'cardio', 'crossfit', 'pt'] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={membershipType[type]}
                    onCheckedChange={(checked) =>
                      setMembershipType({ ...membershipType, [type]: checked })
                    }
                  />
                  <span className="text-sm capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period">Membership Period (months)</Label>
              <Input
                id="period"
                type="number"
                min="1"
                value={formData.membershipPeriod}
                onChange={(e) => setFormData({ ...formData, membershipPeriod: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
