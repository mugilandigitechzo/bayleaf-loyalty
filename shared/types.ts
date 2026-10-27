/** API data shapes shared by the server and the web app. */

export type RewardStatus = 'locked' | 'eligible' | 'redeemed' | 'revoked';
export type CardTheme = 'forest' | 'midnight' | 'ivory' | 'saffron';
export type StaffRole = 'super_admin' | 'admin' | 'staff';

export interface RewardView {
  id: string;
  milestone: number;
  name: string;
  description: string;
  terms: string;
  isPlaceholder: boolean;
  isAvailable: boolean;
  status: RewardStatus;
  /** The next locked milestone on the active card ("in progress"). */
  inProgress: boolean;
  eligibleAt: string | null;
  redeemedAt: string | null;
  redemptionRef: string | null;
  cardId: string;
  cardName: string;
  cardSequence: number;
}

export interface CardView {
  id: string;
  sequence: number;
  name: string;
  levelLabel: string;
  theme: CardTheme;
  requiredVisits: number;
  visitCount: number;
  remaining: number;
  status: 'active' | 'completed';
  /** Live card terms from Bay Leaf's configuration. */
  terms: string;
  activatedAt: string;
  completedAt: string | null;
  milestones: RewardView[];
  nextMilestone: { visit: number; rewardName: string; visitsAway: number; isPlaceholder: boolean } | null;
}

export interface NextCardView {
  state: 'locked' | 'coming_soon';
  name: string | null;
  levelLabel: string | null;
  requiredVisits: number | null;
}

export interface CustomerSummary {
  id: string;
  firstName: string;
  fullName: string;
  memberCode: string;
  status: 'active' | 'suspended';
  phoneMasked: string;
  createdAt: string;
}

export interface LoyaltyState {
  customer: CustomerSummary;
  activeCard: CardView | null;
  completedCards: CardView[];
  /** Earned and not yet redeemed, across all cards. */
  rewardsReady: RewardView[];
  nextCard: NextCardView | null;
  /** Every published card is complete; the next level has not been published yet. */
  awaitingNextLevel: boolean;
  today: { visitsToday: number; maxPerDay: number; canRecordVisit: boolean; lastVisitAt: string | null };
}

export interface VisitHistoryItem {
  id: string;
  reference: string;
  at: string;
  businessDate: string;
  cardName: string;
  cardSequence: number;
  visitNumber: number;
  outletName: string | null;
  staffName?: string | null;
  source: 'counter' | 'correction';
  status: 'valid' | 'voided';
  voidReason?: string | null;
  correctionReason?: string | null;
}

export interface RedemptionHistoryItem {
  id: string;
  reference: string;
  at: string;
  rewardName: string;
  cardName: string;
  outletName: string | null;
  staffName?: string | null;
}

export interface VisitResult {
  replayed: boolean;
  visit: { id: string; reference: string; visitNumber: number; at: string };
  unlockedRewards: RewardView[];
  cardCompleted: boolean;
  nextCardActivated: { name: string; levelLabel: string } | null;
  state: LoyaltyState;
}

export interface RedemptionResult {
  replayed: boolean;
  redemption: { id: string; reference: string; rewardName: string; at: string };
  state: LoyaltyState;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, any> };
}

export interface StaffMe {
  id: string;
  fullName: string;
  username: string;
  role: StaffRole;
  outlet: { id: string; name: string } | null;
  permissions: string[];
  mustChangePassword: boolean;
}

export interface ShareInfo {
  cardUrl: string;
  whatsappUrl: string;
  message: string;
}
