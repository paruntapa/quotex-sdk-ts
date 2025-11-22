/**
 * Asset-related type definitions
 */

export interface Asset {
  id: string;
  name: string;
  displayName: string;
  isOpen: boolean;
  isOTC?: boolean;
  category?: string;
}

export interface AssetInfo {
  id: string;
  name: string;
  displayName: string;
  isOpen: boolean;
  payout: number;
  category?: string;
}

export interface PayoutInfo {
  asset: string;
  payout: number; // percentage
  timestamp: number;
}

export interface InstrumentData {
  id: string;
  symbol: string;
  name: string;
  isEnabled: boolean;
  isOpen: boolean;
  category: string;
  payout: number;
}

