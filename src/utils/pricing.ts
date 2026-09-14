import { MembershipType, PRICING, MEMBERSHIP_OFFERS, getMembershipKey, MembershipOffer } from '@/types/gym';

export function calculateBasePrice(membershipType: MembershipType, months: number): number {
  let monthlyTotal = 0;
  
  if (membershipType.gym) monthlyTotal += PRICING.gymPerMonth;
  if (membershipType.cardio) monthlyTotal += PRICING.cardioPerMonth;
  if (membershipType.crossfit) monthlyTotal += PRICING.crossfitPerMonth;
  if (membershipType.pt) monthlyTotal += PRICING.ptPerMonth;
  
  return PRICING.admissionFee + (monthlyTotal * months);
}

export function getDayOfWeek(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

// Day-based offers removed
export function getDayOffer(_date: Date): number {
  return 0;
}

// Get available offers based on membership type and period
export function getAvailableOffers(membershipType: MembershipType, months: number): MembershipOffer[] {
  const membershipKey = getMembershipKey(membershipType);
  
  // For PT, also include free months offers
  if (membershipKey === 'pt') {
    return MEMBERSHIP_OFFERS.filter(offer => 
      (offer.membershipKey === 'pt' || offer.membershipKey === 'pt_free') && 
      offer.months === months
    );
  }
  
  return MEMBERSHIP_OFFERS.filter(offer => 
    offer.membershipKey === membershipKey && offer.months === months
  );
}

// Legacy function - now returns offers from new system
export function getSpecialOffers(membershipType: MembershipType, months: number): { type: string; percentage: number; freeMonths?: number }[] {
  const offers = getAvailableOffers(membershipType, months);
  
  return offers.map(offer => ({
    type: offer.label,
    percentage: offer.discountPercent,
    freeMonths: offer.freeMonths,
  }));
}

export function calculateFinalPrice(
  basePrice: number,
  dayOffer: number,
  selectedSpecialOffer?: number
): { finalPrice: number; totalDiscount: number } {
  let discount = selectedSpecialOffer || dayOffer || 0;
  
  const discountAmount = (basePrice * discount) / 100;
  const finalPrice = basePrice - discountAmount;
  
  return { finalPrice, totalDiscount: discount };
}

// Calculate discounted price based on membership type and period
export function calculateDiscountedPrice(membershipType: MembershipType, months: number): number {
  const basePrice = calculateBasePrice(membershipType, months);
  const offers = getAvailableOffers(membershipType, months);
  
  // Get the best discount percentage offer
  let maxDiscount = 0;
  offers.forEach(offer => {
    if (offer.discountPercent > maxDiscount) {
      maxDiscount = offer.discountPercent;
    }
  });
  
  const discountAmount = (basePrice * maxDiscount) / 100;
  return basePrice - discountAmount;
}

// Calculate renewal price (exclude admission/registration fee)
export function calculateRenewalPrice(membershipType: MembershipType, months: number): number {
  // Calculate monthly total without admission fee
  let monthlyTotal = 0;
  if (membershipType.gym) monthlyTotal += PRICING.gymPerMonth;
  if (membershipType.cardio) monthlyTotal += PRICING.cardioPerMonth;
  if (membershipType.crossfit) monthlyTotal += PRICING.crossfitPerMonth;
  if (membershipType.pt) monthlyTotal += PRICING.ptPerMonth;

  const base = monthlyTotal * months;
  const offers = getAvailableOffers(membershipType, months);

  let maxDiscount = 0;
  offers.forEach(offer => {
    if (offer.discountPercent > maxDiscount) maxDiscount = offer.discountPercent;
  });

  const discountAmount = (base * maxDiscount) / 100;
  return base - discountAmount;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateEndDate(startDate: string, months: number): string {
  const [year, month, day] = startDate.split('-').map(Number);
  if (!year || !month || !day || !months) return '';

  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(day, lastDayOfTargetMonth);
  const targetDate = new Date(targetYear, normalizedMonthIndex, targetDay);

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function calculateAge(dob: string): number {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

// Calculate end date with free months for PT offers
export function calculateEndDateWithFreeMonths(startDate: string, months: number, freeMonths: number): string {
  const start = new Date(startDate);
  start.setMonth(start.getMonth() + months + freeMonths);
  return start.toISOString().split('T')[0];
}
