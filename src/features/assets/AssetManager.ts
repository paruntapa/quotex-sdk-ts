/**
 * Asset management operations
 */

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
   * Get all available instruments
   */
  async getInstruments(): Promise<InstrumentData[]> {
    if (this.instruments.length > 0) {
      return [...this.instruments];
    }

    // Request instruments
    const message = '42["instruments/get"]';
    console.log(message, 'message for all the assets')
    this.ws.send(message);

    // Wait for instruments data
    return this.waitForInstruments(5000);
  }

  /**
   * Get all asset names
   */
  async getAllAssetNames(): Promise<string[]> {
    const instruments = await this.getInstruments();
    return instruments.map(i => i.symbol);
  }

  /**
   * Get all assets with info
   */
  async getAllAssets(): Promise<Asset[]> {
    const instruments = await this.getInstruments();
    return instruments.map(i => this.instrumentToAsset(i));
  }

  /**
   * Check if asset is open
   */
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
   * Get available asset (tries OTC if closed)
   */
  async getAvailableAsset(assetName: string, forceOpen: boolean = false): Promise<AssetInfo | null> {
    let assetInfo = await this.checkAssetOpen(assetName);

    if (forceOpen && assetInfo && !assetInfo.isOpen) {
      // Try OTC version
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

    return assetInfo;
  }

  /**
   * Get asset payout information
   */
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

  /**
   * Get all payout data
   */
  getAllPayouts(): Map<string, number> {
    return new Map(this.payoutData);
  }

  /**
   * Get payout percentage by asset
   */
  getPayoutByAsset(assetName: string): number {
    return this.payoutData.get(assetName) || 0;
  }

  /**
   * Filter assets by category
   */
  async getAssetsByCategory(category: string): Promise<Asset[]> {
    const instruments = await this.getInstruments();
    return instruments
      .filter(i => i.category === category)
      .map(i => this.instrumentToAsset(i));
  }

  /**
   * Filter only open assets
   */
  async getOpenAssets(): Promise<Asset[]> {
    const instruments = await this.getInstruments();
    return instruments
      .filter(i => i.isOpen)
      .map(i => this.instrumentToAsset(i));
  }

  /**
   * Search assets by name
   */
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

  /**
   * Setup WebSocket handlers for asset events
   */
  private setupAssetHandlers(): void {
    // Instruments list
    this.ws.subscribe('instruments', (data) => {
      this.handleInstrumentsUpdate(data);
    });

    // Instrument updates
    this.ws.subscribe('instruments/update', (data) => {
      this.handleInstrumentUpdate(data);
    });

    // Payout updates
    this.ws.subscribe('payout', (data) => {
      this.handlePayoutUpdate(data);
    });
  }

  /**
   * Handle instruments update
   */
  private handleInstrumentsUpdate(data: any): void {
    if (!data || !Array.isArray(data)) return;

    this.instruments = data.map((item: any) => this.parseInstrument(item));
    this.logger.debug(`Loaded ${this.instruments.length} instruments`);

    // Extract payout data
    for (const instrument of this.instruments) {
      if (instrument.payout) {
        this.payoutData.set(instrument.symbol, instrument.payout);
      }
    }
  }

  /**
   * Handle individual instrument update
   */
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

  /**
   * Handle payout update
   */
  private handlePayoutUpdate(data: any): void {
    if (!data) return;

    if (typeof data === 'object') {
      for (const [asset, payout] of Object.entries(data)) {
        this.payoutData.set(asset, payout as number);
      }
    }
  }

  /**
   * Parse instrument data
   */
  private parseInstrument(data: any): InstrumentData {
    // Quotex sends instruments as arrays: [id, symbol, name, ...]
    const payout = data.payout || data[5] || 0; // Try payout or index 5
    
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

  /**
   * Convert instrument to asset
   */
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

  /**
   * Wait for instruments data
   */
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

