import type {
  AdminUserRow,
  FraudPrediction,
  Location,
  RiskLevel,
  TransactionListItem,
  TransactionStatus,
  TransactionType,
} from '@fraud/shared';

/* Response shapes of the API, mirrored here so pages stay typed without depending on the server package. */

export interface SecurityQuestion {
  id: number;
  key: string;
  text: string;
}

export interface UserDashboard {
  user: {
    id: number;
    fullName: string;
    email: string;
    phone: string;
    card: { number: string; expiry: string | null; cvc: string | null };
    location: string | null;
    createdAt: string;
  };
  balance: number | null;
  stats: { total: number; successful: number; aborted: number; pending: number; successRate: number };
  fraud: { analyzed: number; fraud: number; legit: number; avgScore: number; maxScore: number };
  recent: TransactionListItem[];
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type UserTransactionsResponse = { locked: true } | ({ locked: false } & Paged<TransactionListItem>);

export interface Recipient {
  id: number;
  fullName: string;
  email: string;
  phone: string;
}

/** Holder of a card number typed on the send form. */
export interface CardHolder {
  id: number;
  fullName: string;
  cardLast4: string;
}

export interface SendContext {
  balance: number;
  recipients: Recipient[];
  locations: readonly Location[];
  defaultLocation: Location;
  largeVolume: { count: number; totalAmount: number; blocked: boolean };
  receivers: { unique: number; blocked: boolean };
  senders: { unique: number; blocked: boolean };
}

export interface WithdrawContext {
  balance: number;
  locations: readonly Location[];
  defaultLocation: Location;
  failedAttempts: number;
  blocked: boolean;
}

export interface AdminCounters {
  newUsers24h: number;
  pendingUsers: number;
  aborted24h: number;
  fraudAlerts: number;
  highRisk: number;
  reviewQueue: number;
}

export interface AdminTxRow {
  id: number;
  transactionId: string;
  senderId: number | null;
  senderName: string | null;
  receiverId: number | null;
  receiverName: string | null;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  fraudScore: number;
  fraudPrediction: FraudPrediction | null;
  riskLevel: RiskLevel | null;
  location: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface PartyInfo {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  balance: number;
}

export interface AdminTxDetails extends AdminTxRow {
  message: string | null;
  modelVersion: string | null;
  predictionTime: string | null;
  featureData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  sender: PartyInfo | null;
  receiver: PartyInfo | null;
  admin: { id: number; fullName: string; username: string } | null;
  reviewedBy: number | null;
}

export interface AdminDashboard {
  kpis: {
    totalUsers: number;
    totalTransactions: number;
    successful: number;
    aborted: number;
    moneyMoved: number;
    revenueToday: number;
    revenueTotal: number;
    fraudDetected: number;
    highRisk: number;
    reviewQueue: number;
  };
  recentAlerts: AdminTxRow[];
  recentTransactions: AdminTxRow[];
  recentUsers: AdminUserRow[];
}

export interface AdjustmentRow {
  id: number;
  transactionId: string;
  amount: number;
  type: string;
  reason: string | null;
  createdAt: string;
}

export interface AdjustmentLogRow extends AdjustmentRow {
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  adminId: number | null;
  adminName: string | null;
  adminUsername: string | null;
  ipAddress: string | null;
}

export interface AdjustmentSummary {
  total: number;
  totalAmount: number;
  avgAmount: number;
  uniqueUsers: number;
  uniqueAdmins: number;
  byType: { type: string; count: number; total: number }[];
}

export type BalanceAdjustmentsResponse = Paged<AdjustmentLogRow> & { summary: AdjustmentSummary };

export interface AdminSummary {
  id: number;
  fullName: string;
  username: string;
}

export interface FraudOverview {
  stats: {
    total: number;
    fraud: number;
    legit: number;
    pending: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    avgScore: number;
    maxScore: number;
    minScore: number;
    highPct: number;
    mediumPct: number;
    lowPct: number;
  };
  daily: { date: string; total: number; fraud: number; legit: number }[];
  byType: { type: string; total: number; fraud: number }[];
  byHour: { hour: number; total: number; fraud: number }[];
  topSuspects: { id: number; fullName: string; email: string; fraudCount: number; totalAmount: number }[];
}

export type { AdminUserRow };
