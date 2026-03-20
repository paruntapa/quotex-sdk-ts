import  type { Logger, Asset, AssetInfo, PayoutInfo, InstrumentData } from '../../types';
import { WebSocketManager } from '../../core/websocket/WebSocketManager';

export class AssetManager {
  private instruments: InstrumentData[] = [];
  private payoutData = new Map<string, number>();

  constructor(
    private readonly ws: WebSocketManager,
    private readonly logger: Logger
  ) {
    this.setupAssetHandlers();
  }

  /**
   * Clears cached instruments and payout map. Next getInstruments() will refetch.
   * Call on disconnect / app stop so the next session does not use stale data.
   */
  clearCache(): void {
    this.instruments = [];
    this.payoutData.clear();
  }

  async getInstruments(forceRefresh = false): Promise<InstrumentData[]> {
    if (forceRefresh) {
      this.clearCache();
    }

    if (this.instruments.length > 0) {
      return [...this.instruments];
    }

    const message = '42["instruments/get"]';
    this.ws.send(message);

    return this.waitForInstruments(8000);
  }

  /** Refetch instruments + payouts from the server (clears cache first). */
  async refreshInstruments(): Promise<InstrumentData[]> {
    return this.getInstruments(true);
  }

  async getAllAssetNames(): Promise<string[]> {
    const instruments = await this.getInstruments();
    return instruments.map(i => i.symbol);
  }

  async getAllAssets(): Promise<Asset[]> {
    const instruments = await this.getInstruments();
    return instruments.map(i => this.instrumentToAsset(i));
  }

  async checkAssetOpen(assetName: string): Promise<AssetInfo | null> {
    const instruments = await this.getInstruments();
    const instrument = instruments.find(i => i.symbol === assetName);

    if (!instrument) {
      return null;
    }

    return {
      id: instrument.id,
      name: instrument.symbol,
      displayName: instrument.name,
      isOpen: instrument.isOpen,
      payout: this.payoutData.get(assetName) || instrument.payout || 0,
      category: instrument.category,
    };
  }

  /**
   * @param forceOpen — if true, only considers assets that are currently open (returns null if closed).
   * @param allowVariantSwap — if true (legacy), when the symbol is closed, try OTC ↔ live variant.
   *   Set false when the caller needs an exact symbol from an allowlist (avoids wrong payout / wrong pair).
   */
  async getAvailableAsset(
    assetName: string,
    forceOpen: boolean = false,
    allowVariantSwap: boolean = true,
  ): Promise<AssetInfo | null> {
    let assetInfo = await this.checkAssetOpen(assetName);

    if (!assetInfo) {
      return null;
    }

    if (assetInfo.isOpen) {
      return assetInfo;
    }

    if (forceOpen && allowVariantSwap) {
      const isOTC = assetName.includes('_otc');
      const alternativeName = isOTC
        ? assetName.replace('_otc', '')
        : `${assetName}_otc`;

      this.logger.debug(`Asset ${assetName} is closed, trying ${alternativeName}`);

      const alternativeAsset = await this.checkAssetOpen(alternativeName);
      if (alternativeAsset && alternativeAsset.isOpen) {
        return alternativeAsset;
      }
    }

    return forceOpen ? null : assetInfo;
  }

  getPayoutInfo(assetName: string): PayoutInfo | null {
    const payout = this.payoutData.get(assetName);
    
    if (payout === undefined) {
      return null;
    }

    return {
      asset: assetName,
      payout,
      timestamp: Date.now(),
    };
  }

  getAllPayouts(): Map<string, number> {
    return new Map(this.payoutData);
  }

  getPayoutByAsset(assetName: string): number {
    return this.payoutData.get(assetName) || 0;
  }

  async getAssetsByCategory(category: string): Promise<Asset[]> {
    const instruments = await this.getInstruments();
    return instruments
      .filter(i => i.category === category)
      .map(i => this.instrumentToAsset(i));
  }

  async getOpenAssets(): Promise<Asset[]> {
    const instruments = await this.getInstruments();
    return instruments
      .filter(i => i.isOpen)
      .map(i => this.instrumentToAsset(i));
  }

  async searchAssets(query: string): Promise<Asset[]> {
    const instruments = await this.getInstruments();
    const lowerQuery = query.toLowerCase();
    
    return instruments
      .filter(i => 
        i.symbol.toLowerCase().includes(lowerQuery) ||
        i.name.toLowerCase().includes(lowerQuery)
      )
      .map(i => this.instrumentToAsset(i));
  }

  private setupAssetHandlers(): void {
    this.ws.subscribe('instruments', (data) => {
      this.handleInstrumentsUpdate(data);
    });

    this.ws.subscribe('instruments/update', (data) => {
      this.handleInstrumentUpdate(data);
    });

    this.ws.subscribe('payout', (data) => {
      this.handlePayoutUpdate(data);
    });
  }

  private handleInstrumentsUpdate(data: any): void {
    if (!data || !Array.isArray(data)) return;

    this.instruments = data.map((item: any) => this.parseInstrument(item));
    this.logger.debug(`Loaded ${this.instruments.length} instruments`);

    for (const instrument of this.instruments) {
      if (instrument.payout) {
        this.payoutData.set(instrument.symbol, instrument.payout);
      }
    }
  }

  private handleInstrumentUpdate(data: any): void {
    if (!data || !data.symbol) return;

    const instrument = this.parseInstrument(data);
    const index = this.instruments.findIndex(i => i.symbol === instrument.symbol);

    if (index >= 0) {
      this.instruments[index] = instrument;
    } else {
      this.instruments.push(instrument);
    }

    if (instrument.payout) {
      this.payoutData.set(instrument.symbol, instrument.payout);
    }
  }

  private handlePayoutUpdate(data: any): void {
    if (!data) return;

    if (typeof data === 'object') {
      for (const [asset, payout] of Object.entries(data)) {
        this.payoutData.set(asset, payout as number);
      }
    }
  }

  private parseInstrument(data: any): InstrumentData {
    const payout = data.payout || data[5] || 0;
    
    return {
      id: data.id || data[0] || '',
      symbol: data.symbol || data[1] || '',
      name: data.name || data[2] || '',
      isEnabled: data.isEnabled ?? data.is_enabled ?? data[9] ?? true,
      isOpen: data.isOpen ?? data.is_open ?? data[13] ?? false,
      category: data.category || data.type || data[3] || 'unknown',
      payout,
    };
  }

  private instrumentToAsset(instrument: InstrumentData): Asset {
    return {
      id: instrument.id,
      name: instrument.symbol,
      displayName: instrument.name,
      isOpen: instrument.isOpen,
      isOTC: instrument.symbol.includes('_otc'),
      category: instrument.category,
    };
  }

  private async waitForInstruments(timeout: number): Promise<InstrumentData[]> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.instruments.length > 0) {
        return [...this.instruments];
      }
      await Bun.sleep(100);
    }

    return [];
  }
}

