import {ChangeDetectionStrategy, Component, signal, computed, OnInit, OnDestroy, inject, CUSTOM_ELEMENTS_SCHEMA, PLATFORM_ID} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { WalletService } from './wallet.service';
import {MatIconModule} from '@angular/material/icon';
import {translations, Language} from '../translations';
import {ethers} from 'ethers';

const RPC_URL = "https://mainnet.base.org";
const GBLIN_ABI = [
  "function totalSupply() view returns (uint256)",
  "function stabilityFund() view returns (uint256)",
  "function getVaultStats() view returns (uint256 tvl, uint256 fund, uint256[] weights)",
  "function getRecentRebalances() view returns (tuple(uint256 timestamp, address executor, uint256 reward)[])",
  "function incentivizedRebalance() external",
  "function buyGBLIN(uint256 minGblinOut) external payable",
  "function buyGBLINWithToken(bytes calldata path, uint256 amountIn, uint256 minWethOut, uint256 minGblinOut) external",
  "function sellGBLINForEth(uint256 gblinAmount, uint256 minEthOut) external",
  "function quoteBuyGBLIN(uint256 ethAmount) view returns (uint256 gblinOut, uint256 founderFee, uint256 stabFee)",
  "function quoteSellGBLIN(uint256 gblinAmount) view returns (uint256 ethOut)",
  "function balanceOf(address account) view returns (uint256)"
];

// Removed unused interface BasescanTransaction

interface BlockscoutTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timeStamp: string;
  functionName?: string;
  input?: string;
}

interface BlockscoutResponse {
  status: string;
  message: string;
  result: BlockscoutTransaction[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [MatIconModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private walletService = inject(WalletService);
  userAccount = this.walletService.account;
  contractAddress = "0xc475851f9101A2AC48a84EcF869766A94D301FaA";
  copied = signal(false);
  showLangSelector = signal(false);
  language = signal<Language>('it');

  t = computed(() => {
    const lang = this.language();
    const dict = translations[lang] || translations['en'];
    return (key: string) => {
      const keys = key.split('.');
      let val: Record<string, unknown> = dict as Record<string, unknown>;
      for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
          val = val[k] as Record<string, unknown>;
        } else {
          return key;
        }
      }
      return val as unknown as string;
    };
  });

  languages: { code: Language; name: string; flag: string }[] = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  ];

  // App state
  logo = 'https://raw.githubusercontent.com/rubbe89/gblin-assets/main/LOGO_GBLIN.png';
  officialEmail = 'gblin.protocol@proton.me';
  twitterUrl = 'https://x.com/GBLIN_Protocol';
  warpcastUrl = 'https://warpcast.com/gblin';
  githubUrl = 'https://github.com/gblinproject/gblin-dapp';
  pool1Url = 'https://aerodrome.finance/pool/0x2372c88219a821b54c765aa52e47614248659e28';
  pool2Url = 'https://aerodrome.finance/pool/0xdaecc15bf028bc4d135260d044b87001dafb3c22';
  contractRenounced = true; // Renounced Ownership
  
  // Dashboard signals
  supply = signal<string>('---');
  stabilityFund = signal<string>('---');
  buyAmount = signal('0.01');
  quoteBuyGBLIN = signal('0.00');
  isMinting = signal(false);
  rebalanceData = signal<{basketData: {symbol: string, targetWeight: bigint}[]} | null>(null);

  formatWeight(weight: bigint): string {
    return (Number(weight) / 100).toString();
  }

  // Trade Interface signals
  mode = signal<'buy' | 'sell'>('buy');
  amount = signal('');
  selectedToken = signal('ETH');
  redeemOption = signal<'pro-rata' | 'zap-out'>('pro-rata');
  outputAsset = signal('WETH');
  isTokenModalOpen = signal(false);
  isWalletModalOpen = signal(false);
  isConnecting = signal(false);
  quote = signal('0');
  rawQuote = signal<bigint>(0n);
  displayQuote = computed(() => {
    const q = this.quote();
    if (q === '0') return '0.00';
    const num = parseFloat(q);
    if (num === 0) return '0.00';
    if (num < 0.000001) return q; // Show full precision for very small amounts
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 6 
    });
  });

  minOutDisplay = computed(() => {
    const raw = this.rawQuote();
    if (raw === 0n) return '0.00';
    const slip = BigInt(Math.floor(this.slippage() * 100));
    const minOut = (raw * (10000n - slip)) / 10000n;
    const formatted = ethers.formatEther(minOut);
    return parseFloat(formatted).toFixed(8);
  });

  feeDisplay = signal('0.00');
  hasQuote = computed(() => this.rawQuote() > 0n);
  isLoadingQuote = signal(false);
  isTransacting = signal(false);
  tradeTxHash = signal<string | null>(null);
  tradeError = signal<string | null>(null);
  showForceOption = signal(false);
  lastUpdate = signal<string>(new Date().toLocaleTimeString(this.language()));
  isRefreshing = signal(false);
  slippage = signal(1);
  searchQuery = signal('');
  
  ethBalance = signal('0.0000');
  gblinBalance = signal('0.0000');

  tokens = ['ETH', 'USDC', 'cbBTC', 'DEGEN', 'AERO', 'BRETT'];

  updateInputAsset(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedToken.set(target.value);
    // Trigger quote update if amount is set
    if (this.amount()) {
        const e = { target: { value: this.amount() } } as unknown as Event;
        this.updateAmount(e);
    }
  }

  updateOutputAsset(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.outputAsset.set(target.value);
    // Trigger quote update if amount is set
    if (this.amount()) {
        const e = { target: { value: this.amount() } } as unknown as Event;
        this.updateAmount(e);
    }
  }

  // Rebalance Action State
  stats = signal<{
    tvlUsd: number;
    fundEth: number;
    weights: { symbol: string; actual: number; dynamic: number; base: number }[];
    recentLogs: { txHash: string; executor: string; address: string | null; amount: string; time: string; type: string }[];
    rebalanceLogs: { txHash: string; executor: string; address: string | null; amount: string; time: string; type: string }[];
  } | null>(null);
  isLoadingStats = signal(true);
  isArbitraging = signal(false);
  arbTxHash = signal<string | null>(null);
  arbError = signal<string | null>(null);

  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private platformId = inject(PLATFORM_ID);

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(this.contractAddress, GBLIN_ABI, this.provider);
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.fetchData();
      this.intervalId = setInterval(() => this.fetchData(), 60000); // Aumento a 60 secondi
    }
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async fetchData() {
    this.isRefreshing.set(true);
    try {
      const [totalSupply, stabFund] = await Promise.all([
        this.contract['totalSupply']().catch(() => 0n),
        this.contract['stabilityFund']().catch(() => 0n)
      ]);
      
      this.supply.set(parseFloat(ethers.formatEther(totalSupply)).toLocaleString(undefined, {maximumFractionDigits: 2}));
      this.stabilityFund.set(parseFloat(ethers.formatEther(stabFund)).toFixed(8));

      // Fetch user balances if connected
      const currentAccount = this.userAccount();
      if (currentAccount) {
        const [ethBal, gblinBal] = await Promise.all([
          this.provider.getBalance(currentAccount),
          this.contract['balanceOf'](currentAccount).catch(() => 0n)
        ]);
        this.ethBalance.set(parseFloat(ethers.formatEther(ethBal)).toFixed(8));
        this.gblinBalance.set(parseFloat(ethers.formatEther(gblinBal)).toFixed(8));
      } else {
        this.ethBalance.set('0.00000000');
        this.gblinBalance.set('0.00000000');
      }

      // Fetch real balances of the contract
      const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
      const [wethBal, cbbtcBal, usdcBal] = await Promise.all([
        new ethers.Contract('0x4200000000000000000000000000000000000006', erc20Abi, this.provider)['balanceOf'](this.contractAddress).catch(() => 0n),
        new ethers.Contract('0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', erc20Abi, this.provider)['balanceOf'](this.contractAddress).catch(() => 0n),
        new ethers.Contract('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', erc20Abi, this.provider)['balanceOf'](this.contractAddress).catch(() => 0n)
      ]);

      const wethNum = parseFloat(ethers.formatUnits(wethBal, 18));
      const cbbtcNum = parseFloat(ethers.formatUnits(cbbtcBal, 8));
      const usdcNum = parseFloat(ethers.formatUnits(usdcBal, 6));

      let wethPrice = 3500;
      let btcPrice = 70000;
      try {
        const res = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH');
        const data = await res.json();
        if (data && data.data && data.data.rates && data.data.rates.USD) {
          wethPrice = parseFloat(data.data.rates.USD);
        }
        const resBtc = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=BTC');
        const dataBtc = await resBtc.json();
        if (dataBtc && dataBtc.data && dataBtc.data.rates && dataBtc.data.rates.USD) {
          btcPrice = parseFloat(dataBtc.data.rates.USD);
        }
      } catch (e) {
        console.error("Failed to fetch prices", e);
      }

      const wethUsd = wethNum * wethPrice;
      const cbbtcUsd = cbbtcNum * btcPrice;
      const usdcUsd = usdcNum * 1;

      const tvlUsd = wethUsd + cbbtcUsd + usdcUsd;

      let wethWeight = 0;
      let cbbtcWeight = 0;
      let usdcWeight = 0;

      if (tvlUsd > 0) {
        wethWeight = (wethUsd / tvlUsd) * 100;
        cbbtcWeight = (cbbtcUsd / tvlUsd) * 100;
        usdcWeight = (usdcUsd / tvlUsd) * 100;
      }

      // Fetch transactions from Blockscout
      const recentLogs = await this.fetchTransactions();

      this.stats.set({
        tvlUsd: tvlUsd,
        fundEth: parseFloat(this.stabilityFund()) || 0,
        weights: [
          { symbol: 'WETH', actual: wethWeight, dynamic: 50, base: 50 },
          { symbol: 'cbBTC', actual: cbbtcWeight, dynamic: 30, base: 30 },
          { symbol: 'USDC', actual: usdcWeight, dynamic: 20, base: 20 }
        ],
        recentLogs: recentLogs,
        rebalanceLogs: recentLogs.filter(log => log.type === 'dashboard.txTypes.rebalance')
      });
    } catch (e) {
      console.error("Error fetching dashboard data", e);
    }

    this.isLoadingStats.set(false);
    this.lastUpdate.set(new Date().toLocaleTimeString(this.language()));
    this.isRefreshing.set(false);
  }

  async fetchTransactions() {
    try {
      const url = `https://base.blockscout.com/api?module=account&action=txlist&address=${this.contractAddress}&sort=desc&page=1&offset=10`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Blockscout API error');
      
      const data = (await response.json()) as BlockscoutResponse;
      if (data.status === '1' && Array.isArray(data.result)) {
        return data.result.map((tx: BlockscoutTransaction) => {
          let txTypeKey = 'dashboard.txTypes.transaction';
          
          if (tx.to?.toLowerCase() === this.contractAddress.toLowerCase()) {
            if (tx.input && tx.input.startsWith('0xcde3791d')) {
              txTypeKey = 'dashboard.txTypes.rebalance';
            } else if (tx.functionName) {
              const fnName = tx.functionName.toLowerCase();
              if (fnName.includes('buy')) {
                txTypeKey = 'dashboard.txTypes.buy';
              } else if (fnName.includes('sell')) {
                txTypeKey = 'dashboard.txTypes.sell';
              } else {
                txTypeKey = 'dashboard.txTypes.transaction';
              }
            } else if (tx.input && tx.input !== '0x') {
              txTypeKey = 'dashboard.txTypes.transaction';
            } else if (tx.value && tx.value !== '0') {
              txTypeKey = 'dashboard.txTypes.sendEth';
            }
          } else {
            txTypeKey = 'dashboard.txTypes.transaction';
          }

          return {
            txHash: tx.hash,
            executor: tx.from,
            // If the transaction is TO the contract, the counterparty is the contract itself (or the router).
            // If the transaction is FROM the contract, the counterparty is the receiver.
            address: tx.to?.toLowerCase() === this.contractAddress.toLowerCase() 
              ? this.contractAddress 
              : (tx.to || '---'),
            // Note: Blockscout txlist only shows native ETH transfers. 
            // Token swaps often have 0 ETH value.
            amount: ethers.formatEther(tx.value),
            time: new Date(parseInt(tx.timeStamp) * 1000).toLocaleString(this.language(), {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            type: txTypeKey // Keep the key to use in HTML for color logic
          };
        });
      }
      return [];
    } catch (e) {
      console.error("Error fetching transactions", e);
      return [];
    }
  }

  async handleArbitrage() {
    if (!this.userAccount() || !(window as unknown as {ethereum: unknown}).ethereum) {
      this.openWalletModal();
      return;
    }

    try {
      this.isArbitraging.set(true);
      this.arbError.set(null);
      this.arbTxHash.set(null);

      // Check network
      const isCorrectNetwork = await this.checkNetwork();
      if (!isCorrectNetwork) {
        this.arbError.set(this.t()('trade.errors.wrongNetwork'));
        this.isArbitraging.set(false);
        return;
      }

      const provider = new ethers.BrowserProvider((window as unknown as {ethereum: ethers.Eip1193Provider}).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(this.contractAddress, GBLIN_ABI, signer);

      // We add a manual gasLimit to skip ethers.js gas estimation.
      // This forces the transaction to be sent to the wallet (e.g. MetaMask),
      // which will then simulate it and allow the user to force-send it if they want.
      const tx = await contract['incentivizedRebalance']({ gasLimit: 1000000 });
      this.arbTxHash.set(tx.hash);
      await tx.wait();
      
      this.fetchData(); // Refresh data
    } catch (err: unknown) {
      console.error(err);
      const errorObj = err as { code?: string; message?: string; info?: { error?: { code: number } } };
      const errorMsg = errorObj.message || (err as Error).message || "";
      
      if (errorObj.code === 'CALL_EXCEPTION' || errorMsg.includes('CALL_EXCEPTION')) {
        this.arbError.set(this.t()('trade.errors.noRebalance'));
      } else if (errorObj.code === '4001' || errorObj.info?.error?.code === 4001 || errorMsg.includes('user rejected')) {
        this.arbError.set(this.t()('trade.errors.userCancelled'));
      } else if (errorMsg.includes('Ledger')) {
        this.arbError.set("Ledger error: Please ensure your Ledger is unlocked, the Ethereum app is open, and 'Blind Signing' is enabled in the app settings.");
      } else {
        this.arbError.set(errorMsg || this.t()('trade.errors.txError'));
      }
    } finally {
      this.isArbitraging.set(false);
    }
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.contractAddress);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async updateBuyAmount(event: Event) {
    const target = event.target as HTMLInputElement;
    let val = target.value;
    
    // Handle comma as decimal separator
    val = val.replace(',', '.');
    this.buyAmount.set(val);
    
    if (val && !isNaN(Number(val)) && Number(val) > 0) {
      try {
        const wethAmount = ethers.parseEther(val);
        const [gblinOut] = await this.contract['quoteBuyGBLIN'](wethAmount);
        this.quoteBuyGBLIN.set(parseFloat(ethers.formatEther(gblinOut)).toFixed(4));
      } catch (e) {
        console.error("Quote error:", e);
        this.quoteBuyGBLIN.set('0.00');
      }
    } else {
      this.quoteBuyGBLIN.set('0.00');
    }
  }

  async handleMint() {
    if (!this.userAccount() || !(window as unknown as {ethereum: unknown}).ethereum || !this.buyAmount() || isNaN(Number(this.buyAmount())) || Number(this.buyAmount()) <= 0) return;
    
    try {
      this.isMinting.set(true);
      const provider = new ethers.BrowserProvider((window as unknown as {ethereum: ethers.Eip1193Provider}).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(this.contractAddress, GBLIN_ABI, signer);

      const parsedQuote = ethers.parseEther(this.quoteBuyGBLIN());
      const minOut = (parsedQuote * BigInt(10000 - this.slippage() * 100)) / 10000n;

      const parsedAmount = ethers.parseEther(this.buyAmount());
      const tx = await contract['buyGBLIN'](minOut, { value: parsedAmount });
      
      await tx.wait();
      this.buyAmount.set('');
      this.quoteBuyGBLIN.set('0.00');
      this.fetchData(); // Refresh data
    } catch (err: unknown) {
      console.error(err);
      // Could set an error state here if we had one for the mint section
    } finally {
      this.isMinting.set(false);
    }
  }

  setMaxAmount() {
    const balance = this.mode() === 'buy' ? this.ethBalance() : this.gblinBalance();
    if (this.mode() === 'buy') {
      // Leave some ETH for gas
      const eth = parseFloat(balance);
      const max = Math.max(0, eth - 0.001); // Reserve 0.001 ETH for gas
      this.amount.set(max.toString());
    } else {
      this.amount.set(balance);
    }
    // Trigger quote update
    const event = { target: { value: this.amount() } } as unknown as Event;
    this.updateAmount(event);
  }

  async checkNetwork() {
    const ethereum = (window as unknown as { ethereum: ethers.Eip1193Provider }).ethereum;
    if (!ethereum) return false;
    
    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      
      if (network.chainId !== 8453n) { // Base Mainnet
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }], // 8453 in hex
          });
          return true;
        } catch (switchError: unknown) {
          const err = switchError as { code: number };
          if (err.code === 4902) {
            try {
              await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x2105',
                  chainName: 'Base',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org']
                }],
              });
              return true;
            } catch {
              return false;
            }
          }
          return false;
        }
      }
      return true;
    } catch (e) {
      console.error("Network check error:", e);
      return false;
    }
  }

  toggleLangSelector() {
    this.showLangSelector.update(v => !v);
  }

  setLanguage(code: Language) {
    this.language.set(code);
    this.showLangSelector.set(false);
  }

  setMode(m: 'buy' | 'sell') {
    this.mode.set(m);
    this.amount.set('');
    this.tradeError.set(null);
    this.tradeTxHash.set(null);
  }

  async updateAmount(event: Event) {
    const target = event.target as HTMLInputElement;
    let val = target.value;
    
    // Handle comma as decimal separator
    val = val.replace(',', '.');
    this.amount.set(val);
    
    if (!val || isNaN(Number(val)) || Number(val) <= 0) {
      this.quote.set('0');
      this.rawQuote.set(0n);
      return;
    }

    this.isLoadingQuote.set(true);
    try {
      // Use wallet provider if connected for more accurate quote
      let activeContract = this.contract;
      if (this.userAccount() && (window as unknown as {ethereum: ethers.Eip1193Provider}).ethereum) {
        const provider = new ethers.BrowserProvider((window as unknown as {ethereum: ethers.Eip1193Provider}).ethereum);
        activeContract = new ethers.Contract(this.contractAddress, GBLIN_ABI, provider);
      }

      if (this.mode() === 'buy') {
        const wethAmount = ethers.parseEther(val);
        const result = await activeContract['quoteBuyGBLIN'](wethAmount);
        
        // result[0] is gblinOut (gross), result[1] is founderFee, result[2] is stabFee
        // We use BigInt to ensure precision and handle potential undefined/null
        const gblinOut = result[0] ? BigInt(result[0]) : 0n;
        const founderFee = result[1] ? BigInt(result[1]) : 0n;
        const stabFee = result[2] ? BigInt(result[2]) : 0n;
        
        // Il contratto sembra restituire un valore che non tiene conto di tutte le tasse
        // Applichiamo uno sconto cautelativo del 3.5% per allinearci a MetaMask
        let netGblinOut = gblinOut - founderFee - stabFee;
        const safetyMargin = (netGblinOut * 35n) / 1000n;
        netGblinOut = netGblinOut - safetyMargin;
        
        this.feeDisplay.set(ethers.formatEther(founderFee + stabFee + safetyMargin));
        
        this.rawQuote.set(netGblinOut);
        this.quote.set(ethers.formatEther(netGblinOut));
        console.log(`Buy Quote: Gross=${gblinOut}, Net=${netGblinOut}, TotalFees=${founderFee + stabFee + safetyMargin}`);
      } else {
        const parsedAmount = ethers.parseEther(val);
        const ethOut = await activeContract['quoteSellGBLIN'](parsedAmount);
        const netEthOut = BigInt(ethOut);
        
        // Apply similar logic for sell if needed (usually sell also has fees)
        // For now, let's assume quoteSellGBLIN might also be gross.
        // If we see a discrepancy in sell, we might need to adjust here too.
        
        this.rawQuote.set(netEthOut);
        this.quote.set(ethers.formatEther(netEthOut));
        console.log(`Sell Quote: Net=${netEthOut}`);
      }
    } catch (e) {
      console.error("Quote error:", e);
      // Fallback to default provider if wallet provider fails
      try {
        if (this.mode() === 'buy') {
          const result = await this.contract['quoteBuyGBLIN'](ethers.parseEther(val));
          const gblinOut = BigInt(result[0]);
          const founderFee = BigInt(result[1]);
          const stabFee = BigInt(result[2]);
          let netGblinOut = gblinOut - founderFee - stabFee;
          
          const safetyMargin = (netGblinOut * 35n) / 1000n;
          netGblinOut = netGblinOut - safetyMargin;
          
          this.feeDisplay.set(ethers.formatEther(founderFee + stabFee + safetyMargin));
          this.rawQuote.set(netGblinOut);
          this.quote.set(ethers.formatEther(netGblinOut));
        } else {
          const ethOut = await this.contract['quoteSellGBLIN'](ethers.parseEther(val));
          this.rawQuote.set(BigInt(ethOut));
          this.quote.set(ethers.formatEther(BigInt(ethOut)));
        }
      } catch (innerErr) {
        console.error("Fallback quote error:", innerErr);
        this.quote.set('0');
      }
    } finally {
      this.isLoadingQuote.set(false);
    }
  }

  openTokenModal() {
    this.isTokenModalOpen.set(true);
  }

  closeTokenModal() {
    this.isTokenModalOpen.set(false);
  }

  selectToken(token: string) {
    this.selectedToken.set(token);
    this.isTokenModalOpen.set(false);
  }

  updateSearchQuery(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  get filteredTokens() {
    const query = this.searchQuery().toLowerCase();
    return this.tokens.filter(t => t.toLowerCase().includes(query));
  }

  openWalletModal() {
    this.isWalletModalOpen.set(true);
  }

  closeWalletModal() {
    this.isWalletModalOpen.set(false);
  }

  async connectWallet() {
    this.isWalletModalOpen.set(false);
    if (typeof window === 'undefined' || !(window as unknown as {ethereum: unknown}).ethereum) {
      this.tradeError.set(this.t()('trade.errors.noWallet'));
      return;
    }

    try {
      this.isConnecting.set(true);
      this.tradeError.set(null);
      const provider = new ethers.BrowserProvider((window as unknown as {ethereum: ethers.Eip1193Provider}).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length > 0) {
        this.userAccount.set(accounts[0]);
        await this.checkNetwork();
        this.fetchData(); // Immediate balance update
      }
    } catch (err: unknown) {
      console.error(err);
      this.tradeError.set((err as Error).message || this.t()('trade.errors.txError'));
    } finally {
      this.isConnecting.set(false);
    }
  }

  async handleTrade(force = false) {
    if (!this.userAccount() || !(window as unknown as {ethereum: unknown}).ethereum || !this.amount() || Number(this.amount()) <= 0) return;

    try {
      this.isTransacting.set(true);
      this.tradeError.set(null);
      this.showForceOption.set(false);
      this.tradeTxHash.set(null);

      // Check network
      const isCorrectNetwork = await this.checkNetwork();
      if (!isCorrectNetwork) {
        this.tradeError.set(this.t()('trade.errors.wrongNetwork'));
        this.isTransacting.set(false);
        return;
      }

      // Check balance before proceeding
      const userBalance = this.mode() === 'buy' ? this.ethBalance() : this.gblinBalance();
      if (parseFloat(userBalance) < parseFloat(this.amount())) {
        this.tradeError.set(this.t()('trade.errors.insufficientBalance').replace('{balance}', userBalance).replace('{token}', this.mode() === 'buy' ? 'ETH' : 'GBLIN').replace('{amount}', this.amount()));
        this.isTransacting.set(false);
        return;
      }

      const provider = new ethers.BrowserProvider((window as unknown as {ethereum: ethers.Eip1193Provider}).ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(this.contractAddress, GBLIN_ABI, signer);

      // Re-fetch quote to be 100% sure it's fresh and from the right provider
      let currentRawQuote = 0n;
      try {
        if (this.mode() === 'buy') {
          const result = await contract['quoteBuyGBLIN'](ethers.parseEther(this.amount()));
          const gblinOut = BigInt(result[0]);
          const founderFee = BigInt(result[1]);
          const stabFee = BigInt(result[2]);
          currentRawQuote = gblinOut - founderFee - stabFee;
          
          // Apply safety margin
          currentRawQuote = (currentRawQuote * 965n) / 1000n;
        } else {
          const ethOut = await contract['quoteSellGBLIN'](ethers.parseEther(this.amount()));
          currentRawQuote = BigInt(ethOut);
        }
        this.rawQuote.set(currentRawQuote);
        this.quote.set(ethers.formatEther(currentRawQuote));
      } catch (e) {
        console.warn("Quote refresh failed, using last known", e);
        currentRawQuote = this.rawQuote();
      }

      if (currentRawQuote === 0n) {
        this.tradeError.set(this.t()('trade.errors.quoteFailed'));
        this.isTransacting.set(false);
        return;
      }

      // Calculate minOut with slippage
      const slippageBps = BigInt(Math.round(this.slippage() * 100));
      const minOut = (currentRawQuote * (10000n - slippageBps)) / 10000n;

      console.log(`Trade: ${this.mode()} ${this.amount()} - Quote: ${ethers.formatEther(currentRawQuote)} - MinOut: ${ethers.formatEther(minOut)} - Slippage: ${this.slippage()}%`);

      // Pre-flight check (Simulation)
      if (!force) {
        try {
          if (this.mode() === 'buy') {
            const parsedAmount = ethers.parseEther(this.amount());
            await contract['buyGBLIN'].staticCall(minOut, { value: parsedAmount });
          } else {
            const parsedAmount = ethers.parseEther(this.amount());
            await contract['sellGBLINForEth'].staticCall(parsedAmount, minOut);
          }
        } catch (staticErr: unknown) {
          console.error("Simulation failed:", staticErr);
          const err = staticErr as { 
            data?: string; 
            message?: string; 
            reason?: string; 
            info?: { error?: { data?: string; code?: number } } 
          };
          
          let errorData = "";
          if (typeof err.data === 'string') {
            errorData = err.data;
          } else if (err.info?.error?.data && typeof err.info.error.data === 'string') {
            errorData = err.info.error.data;
          }

          const errorMsg = err.message || "";
          
          if (errorData.includes("0x8199f5f3") || errorMsg.includes("0x8199f5f3")) {
            this.tradeError.set(this.t()('trade.errors.slippageDetected'));
            this.showForceOption.set(true);
          } else {
            this.tradeError.set(this.t()('trade.errors.simFailed') + (err.reason || "Technical error. Check balance."));
          }
          this.isTransacting.set(false);
          return;
        }
      }

      let tx;
      if (this.mode() === 'buy') {
        const parsedAmount = ethers.parseEther(this.amount());
        tx = await contract['buyGBLIN'](minOut, { value: parsedAmount });
      } else {
        const parsedAmount = ethers.parseEther(this.amount());
        tx = await contract['sellGBLINForEth'](parsedAmount, minOut);
      }

      this.tradeTxHash.set(tx.hash);
      await tx.wait();
      
      this.amount.set('');
      this.isTransacting.set(false);
      this.fetchData(); // Refresh balances
    } catch (err: unknown) {
      console.error(err);
      const error = err as { 
        data?: string; 
        message?: string; 
        code?: number | string;
        info?: { error?: { data?: string; code?: number } } 
      };
      const errorMsg = error.message || "";
      
      let errorData = "";
      if (typeof error.data === 'string') {
        errorData = error.data;
      } else if (error.info?.error?.data && typeof error.info.error.data === 'string') {
        errorData = error.info.error.data;
      }
      
      if (errorMsg.includes("0x8199f5f3") || errorData.includes("0x8199f5f3")) {
        this.tradeError.set(this.t()('trade.errors.highSlippage'));
        this.showForceOption.set(true);
      } else if (error.code === 4001 || error.info?.error?.code === 4001) {
        this.tradeError.set(this.t()('trade.errors.userCancelled'));
      } else {
        this.tradeError.set(this.t()('trade.errors.txError') + (error.message || "Unknown error"));
      }
      this.isTransacting.set(false);
    }
  }
}
