import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGymOptional } from '@/context/GymContext';
import { useToast } from '@/hooks/use-toast';
import { calculateAge, calculateEndDate, getDayOfWeek } from '@/utils/pricing';
import { MembershipType } from '@/types/gym';
import { clientApi } from '@/services/apiService';
import { User, MapPin, Briefcase, Phone, Calendar, Mail, Dumbbell, Heart, Zap, UserCheck, FileText, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PhotoCapture } from './PhotoCapture';

const PERIOD_OPTIONS = [
  { value: '1', label: '1 Month' },
  { value: '3', label: '3 Months' },
  { value: '6', label: '6 Months' },
  { value: '12', label: '1 Year' },
  { value: 'custom', label: 'Custom' },
];

export function ClientRegistrationForm() {
  const navigate = useNavigate();
  const gym = useGymOptional();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    occupation: '',
    phone: '',
    dob: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    email: '',
    slot: '' as 'morning' | 'evening' | '',
    membershipPeriod: '',
    customMonths: '',
    startDate: '',
  });

  const [membershipType, setMembershipType] = useState<MembershipType>({
    gym: false,
    cardio: false,
    crossfit: false,
    pt: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsConfirmName, setTermsConfirmName] = useState('');
  const [clientPhoto, setClientPhoto] = useState<string>('');
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<'active' | 'non-active' | ''>('');

  const calculatedAge = formData.dob ? calculateAge(formData.dob) : 0;
  const months = formData.membershipPeriod === 'custom' 
    ? parseInt(formData.customMonths) || 0 
    : parseInt(formData.membershipPeriod) || 0;
  const endDate = formData.startDate && months ? calculateEndDate(formData.startDate, months) : '';
  const isMembershipCompleted = (() => {
    if (!endDate) return false;
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return false;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return end < todayStart;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone || !formData.dob || !formData.gender || !formData.slot) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including time slot",
        variant: "destructive",
      });
      return;
    }

    if (!membershipType.gym && !membershipType.cardio && !membershipType.crossfit && !membershipType.pt) {
      toast({
        title: "Select Membership",
        description: "Please select at least one membership type",
        variant: "destructive",
      });
      return;
    }

    if (!months || months < 1) {
      toast({
        title: "Invalid Period",
        description: "Please select a valid membership period",
        variant: "destructive",
      });
      return;
    }

    if (!formData.startDate) {
      toast({
        title: "Start Date Required",
        description: "Please select a membership start date.",
        variant: "destructive",
      });
      return;
    }

    if (isMembershipCompleted && !membershipStatus) {
      toast({
        title: "Member Status Required",
        description: "This membership period is already completed. Please select Active or Non-Active.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const registrationDay = getDayOfWeek(new Date());
      
      const response = await clientApi.register({
        name: formData.name,
        address: formData.address,
        occupation: formData.occupation,
        phone: formData.phone,
        dob: formData.dob,
        age: calculatedAge,
        gender: formData.gender as 'male' | 'female' | 'other',
        email: formData.email,
        slot: formData.slot as 'morning' | 'evening',
        membershipType,
        membershipPeriod: months,
        startDate: formData.startDate,
        endDate,
        membershipStatus: isMembershipCompleted ? membershipStatus : 'active',
        registrationDay,
        termsAcceptedBy: termsConfirmName,
        photo: clientPhoto || undefined,
      });

      const client = response.client;
      
      // Refresh clients in context
      gym?.refreshClients();

      toast({
        title: response.email?.sent
          ? "Registration Successful! Email Sent"
          : "Registration Successful! Email Not Sent",
        description: response.email?.sent
          ? `Welcome to US Gymnasium! Your Client ID is ${client.clientId}.`
          : `Client ID is ${client.clientId}. Email delivery failed: ${response.email?.error || 'SMTP not configured'}`,
        variant: response.email?.sent ? "default" : "destructive",
      });

      navigate(`/payment/${client.clientId}`);
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card variant="glass" className="max-w-2xl mx-auto animate-slide-up">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-3xl gradient-text">New Member Registration</CardTitle>
        <CardDescription>Join the US Gymnasium family and transform your life</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo Capture */}
          <div className="flex justify-center pb-4">
            <div className="space-y-2 text-center">
              <Label className="flex items-center justify-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Client Photo
              </Label>
              <PhotoCapture 
                onCapture={(photo) => setClientPhoto(photo)} 
                currentPhoto={clientPhoto}
              />
            </div>
          </div>

          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Personal Information
            </h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="Enter phone number"
                    className="pl-10"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="dob"
                    type="date"
                    className="pl-10"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    required
                  />
                </div>
                {calculatedAge > 0 && (
                  <p className="text-sm text-primary">Age: {calculatedAge} years</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value as 'male' | 'female' | 'other' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="occupation">Occupation</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="occupation"
                    placeholder="Your occupation"
                    className="pl-10"
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slot">Member Slot *</Label>
                <Select
                  value={formData.slot}
                  onValueChange={(value) => setFormData({ ...formData, slot: value as 'morning' | 'evening' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="address"
                    placeholder="Enter your address"
                    className="pl-10"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Membership Type */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary" />
              Membership Type *
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'gym', label: 'Gym', icon: Dumbbell, price: '₹1,500/mo' },
                { key: 'cardio', label: 'Cardio', icon: Heart, price: '₹500/mo' },
                { key: 'crossfit', label: 'Crossfit', icon: Zap, price: '₹500/mo' },
                { key: 'pt', label: 'PT', icon: UserCheck, price: '₹15,000/mo' },
              ].map(({ key, label, icon: Icon, price }) => (
                <label
                  key={key}
                  className={`relative flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                    membershipType[key as keyof MembershipType]
                      ? 'border-primary bg-primary/10 glow-sm'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    checked={membershipType[key as keyof MembershipType]}
                    onCheckedChange={(checked) =>
                      setMembershipType({ ...membershipType, [key]: checked })
                    }
                    className="sr-only"
                  />
                  <Icon className={`w-8 h-8 mb-2 ${
                    membershipType[key as keyof MembershipType] ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <span className="font-semibold">{label}</span>
                  <span className="text-xs text-muted-foreground">{price}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Membership Period */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Membership Period
            </h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period">Select Period *</Label>
                <Select
                  value={formData.membershipPeriod}
                  onValueChange={(value) => setFormData({ ...formData, membershipPeriod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {formData.membershipPeriod === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="customMonths">Number of Months</Label>
                  <Input
                    id="customMonths"
                    type="number"
                    min="1"
                    placeholder="Enter months"
                    value={formData.customMonths}
                    onChange={(e) => setFormData({ ...formData, customMonths: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    setFormData({ ...formData, startDate: e.target.value });
                    setMembershipStatus('');
                  }}
                  required
                />
              </div>
              
              {endDate && (
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <div className="h-11 flex items-center px-4 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-primary font-medium">{new Date(endDate).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>

            {isMembershipCompleted && (
              <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
                <Label>Membership period completed. Is this member still active?</Label>
                <RadioGroup
                  value={membershipStatus}
                  onValueChange={(value) => setMembershipStatus(value as 'active' | 'non-active')}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <label className="flex items-center gap-3 rounded-lg border border-border bg-background/70 px-4 py-3 cursor-pointer">
                    <RadioGroupItem value="active" id="member-active" />
                    <span className="text-sm font-medium">Active - send to renewals</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-border bg-background/70 px-4 py-3 cursor-pointer">
                    <RadioGroupItem value="non-active" id="member-non-active" />
                    <span className="text-sm font-medium">Non-Active - follow up later</span>
                  </label>
                </RadioGroup>
              </div>
            )}
          </div>

          {/* Terms and Conditions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Terms & Conditions
            </h3>
            
            <div 
              className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3 max-h-48 overflow-y-scroll text-sm text-muted-foreground"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
              onScroll={(e) => {
                const element = e.currentTarget;
                const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
                if (isAtBottom && !hasScrolledTerms) {
                  setHasScrolledTerms(true);
                }
              }}
            >
              <p className="font-semibold text-foreground">US Gymnasium Membership Terms:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Membership fees are non-refundable once paid.</li>
                <li>Members must carry their ID card at all times during gym hours.</li>
                <li>Gym timings: Morning 5:00 AM - 11:00 AM, Evening 4:00 PM - 10:00 PM.</li>
                <li>Members are responsible for their personal belongings. The gym is not liable for any loss or damage.</li>
                <li>Proper gym attire and footwear must be worn at all times.</li>
                <li>Members must follow the instructions of trainers and staff.</li>
                <li>Use of equipment should be done under supervision or with proper knowledge.</li>
                <li>Members must wipe down equipment after use.</li>
                <li>No smoking, alcohol, or any prohibited substances are allowed on the premises.</li>
                <li>The gym reserves the right to terminate membership in case of misconduct.</li>
                <li>Health declaration: Members confirm they are physically fit to exercise and have no medical conditions that would restrict their participation.</li>
                <li>Members must inform the gym of any health issues or injuries before starting workouts.</li>
              </ol>
            </div>

            {!hasScrolledTerms ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Please scroll and read the terms and conditions to continue
              </p>
            ) : (
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                />
                <label
                  htmlFor="terms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  I have read and agree to the Terms & Conditions
                </label>
              </div>
            )}

            {acceptedTerms && (
              <div className="space-y-2 mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <Label htmlFor="termsConfirmName" className="text-primary font-medium">
                  Type your full name to confirm acceptance *
                </Label>
                <Input
                  id="termsConfirmName"
                  placeholder="Enter your full name exactly as above"
                  value={termsConfirmName}
                  onChange={(e) => setTermsConfirmName(e.target.value)}
                  className="border-primary/30 focus:border-primary"
                />
                {termsConfirmName && termsConfirmName.toLowerCase().trim() !== formData.name.toLowerCase().trim() && (
                  <p className="text-xs text-destructive">Name must match the full name entered above</p>
                )}
              </div>
            )}
          </div>

          {acceptedTerms && termsConfirmName.toLowerCase().trim() === formData.name.toLowerCase().trim() && termsConfirmName.trim() !== '' && (
            <Button type="submit" variant="hero" size="xl" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Complete Registration'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
