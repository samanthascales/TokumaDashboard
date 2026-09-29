import type { BusinessProfile } from '../types';

/** A brand-new account: nothing filled in until the owner completes onboarding. */
export const emptyProfile: BusinessProfile = {
  ownerName: '',
  email: '',
  role: '',
  businessName: '',
  industry: '',
  country: '',
  founded: '',
  description: '',
  website: '',
  employees: '',
  primaryMaterials: [],
  circularModel: '',
  annualRevenue: '',
  fundingGoal: '',
  bankConnected: false,
};
