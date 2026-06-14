// ============================================
// Shared frontend types for EXPensio
// ============================================

export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface Group {
  id: number;
  name: string;
  invite_code: string;
  created_by: number | null;
  created_at: string;
  member_count?: number;
  net_balance?: number;
}

export interface GroupMember {
  id: number;
  group_id: number;
  user_id: number;
  joined_at: string;
  left_at: string | null;
  user_name?: string;
  user_email?: string;
  user_avatar?: string | null;
  net_balance?: number;
}

export type SplitType = 'equal' | 'percentage' | 'exact' | 'shares';

export interface Expense {
  id: number;
  group_id: number;
  paid_by_user_id: number;
  paid_by_name?: string;
  description: string;
  amount_original: number;
  currency: string;
  amount_inr: number;
  exchange_rate: number;
  expense_date: string;
  split_type: SplitType;
  notes: string | null;
  created_at: string;
  is_deleted: boolean;
  splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: number;
  expense_id: number;
  user_id: number;
  user_name?: string;
  share_amount_inr: number;
  split_value: number | null;
}

export interface Settlement {
  id: number;
  group_id: number;
  payer_id: number;
  payer_name?: string;
  payee_id: number;
  payee_name?: string;
  amount_inr: number;
  settled_at: string;
  created_at: string;
}

export interface NetBalance {
  userId: number;
  userName: string;
  amount: number;
}

export interface SimplifiedDebt {
  from: number;
  fromName: string;
  to: number;
  toName: string;
  amount: number;
}

export interface GroupBalanceResult {
  netBalances: NetBalance[];
  simplifiedDebts: SimplifiedDebt[];
}

// Import types
export interface ImportAnomaly {
  rowNumber: number;
  columnName: string;
  anomalyType: string;
  originalValue: string;
  resolvedValue: string | null;
  actionTaken: string;
  requiresReview: boolean;
}

export interface DuplicatePair {
  id: number;
  rowA: number;
  rowB: number;
  reason: string;
  status: 'pending' | 'kept_both' | 'deleted_a' | 'deleted_b' | 'merged';
}

export interface ImportPreview {
  totalRows: number;
  okRows: number;
  flaggedRows: number;
  skippedRows: number;
  anomalies: ImportAnomaly[];
  duplicatePairs: DuplicatePair[];
  processedRows: any[];
}

export interface ImportResult {
  importLogId: number;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  anomalyCount: number;
}
