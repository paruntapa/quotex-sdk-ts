/**
 * Account-related type definitions
 */

import type { AccountMode } from './common';

export interface Profile {
  nickName: string;
  email?: string;
  profileId: string;
  demoBalance: number;
  liveBalance: number;
  avatar?: string;
  countryName: string;
  timezone: string;
  offset: number;
}

export interface BalanceInfo {
  mode: AccountMode;
  balance: number;
  currency?: string;
}

export interface AccountSettings {
  mode: AccountMode;
  defaultAsset?: string;
  defaultAmount?: number;
  defaultDuration?: number;
}

