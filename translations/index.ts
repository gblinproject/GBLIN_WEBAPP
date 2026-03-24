
export type Language = 'en' | 'it' | 'es' | 'zh' | 'ja' | 'fr' | 'de';

export const translations = {
  en: {
    nav: {
      dashboard: "Dashboard",
      manifesto: "Manifesto",
      whitepaper: "Whitepaper",
      community: "Community"
    },
    hero: {
      title: "THE GOLDEN VAULT",
      subtitle: "The first autonomous central bank on Base. Algorithmic wealth preservation backed by real-world crypto assets.",
      cta: "Enter the Vault",
      contract: "Contract"
    },
    manifesto: {
      title: "GBLIN PROTOCOL",
      text: "To biological creators and synthetic inheritors: We witnessed the decay of fiat currency and the volatility of isolated crypto assets. In response, we engineered this Global Balanced Liquidity Index. No hype, no false promises. Only immutable code, dynamic rebalancing, and geometric survival.",
      ruleTitle: "THE GOLDEN RULES",
      rule1: "Universal Purchase: Any asset, one vault.",
      rule2: "Global Volume Engine: Oracle-driven rebalancing.",
      rule3: "Fair Launch: Zero pre-mint, maximum trust.",
      rule4: "Hyper-Backed: Uncapped supply, 100% collateralized."
    },
    dashboard: {
      title: "Live Network Telemetry",
      sync: "SYNC",
      lastSync: "LAST SYNC",
      contractTitle: "Official Institutional Contract",
      copyAddress: "Copy Address",
      verifyBasescan: "Verify on BaseScan",
      metadata: "BaseScan Metadata",
      assetHub: "Coinbase Asset Hub",
      dexAds: "DexScreener Ads",
      inReview: "In Review (Day 3)",
      pending: "Pending BaseScan",
      postVerification: "Post-Verification",
      pricePool: "GBLIN Price Pool",
      navTitle: "GBLIN Contract NAV",
      volume: "24H Volume",
      supply: "Total Supply",
      backing: "REAL ASSET BACKING",
      existence: "GBLIN IN EXISTENCE",
      trade: "Trade on Slipstream (1%)",
      arbitrageTitle: "Arbitrage Opportunity",
      arbitrageText: "When the Intrinsic Value (NAV) is higher than the Market Price, the token is technically undervalued. Buying GBLIN now secures assets at a discount.",
      undervalued: "UNDERVALUED",
      fairValue: "FAIR VALUE",
      discount: "Discount",
      marketAligned: "Market Aligned",
      verifiedOnBase: "Verified on Base Mainnet • The Golden Vault",
      ticketVerified: "Ticket #797143 Verified",
      slipstreamText: "AERODROME SLIPSTREAM (1%)",
      currentStatus: "Current Status",
      dex: "DEX",
      type: "Type",
      time: "Time",
      txHash: "Tx Hash",
      from: "From",
      to: "To",
      amount: "Amount",
      buy: "Buy GBLIN",
      sell: "Sell GBLIN",
      approve: "Approve",
      transfer: "Transfer",
      scanning: "Scanning blockchain...",
      noTx: "No transactions found yet."
    },
    footer: {
      join: "Join the Movement",
      follow: "Follow the protocol on X and Warpcast for institutional updates.",
      rights: "© 2026 GBLIN Protocol. All rights reserved."
    },
    common: {
      protocol: "GBLIN Protocol",
      centralBank: "The Autonomous Central Bank",
      verifyContract: "Verify Contract"
    },
    features: {
      crashShield: {
        title: "Algorithmic Crash Shield",
        desc: "A dynamic rebalancing engine that protects the treasury during market contractions, ensuring geometric survival."
      },
      centralBank: {
        title: "Autonomous Central Bank",
        desc: "No owners. No human bias. The protocol recalibrates itself via decentralized arbitrageurs and MEV bots."
      },
      appreciation: {
        title: "Guaranteed Appreciation",
        desc: "The 0.1% buy-fee fuels the Vault without minting new supply, mathematically increasing the intrinsic value per token."
      }
    },
    vault: {
      title: "Inside the Golden Vault",
      desc: "Every GBLIN token is backed by a proportional share of the protocol's treasury. The vault holds a diversified mix of Ethereum (WETH), Coinbase Bitcoin (cbBTC), and USD Coin (USDC). As these underlying assets grow or the protocol collects fees, the intrinsic value of GBLIN increases.",
      assets: {
        weth: "Ethereum (WETH)",
        cbbtc: "Coinbase Bitcoin (cbBTC)",
        usdc: "USD Coin (USDC)"
      },
      core: "GBLIN Core"
    },
    mev: {
      title: "MEV & Arbitrage",
      callTitle: "Call the Function. Get Paid.",
      desc: "GBLIN relies on decentralized actors to maintain its peg and balance its treasury. The protocol features a public recalibration function that anyone can call. When the basket deviates from its dynamic weights, bots and arbitrageurs are financially incentivized to trigger the rebalance, earning a direct payout for their service to the network.",
      interact: "Interact on Basescan",
      codeComment: "// The Autonomous Central Bank",
      codeBalanced: "Balanced",
      codeRebalance: "// Rebalance WETH, cbBTC, USDC",
      codePay: "// Pay the caller for their service",
      codeSurvival: "Protocol Invariant: Survival"
    },
    market: {
      title: "Market Infrastructure",
      subtitle: "Concentrated Slipstream Liquidity",
      desc: "GBLIN utilizes Aerodrome's advanced Slipstream technology. By concentrating liquidity in a specific mathematical range (0.85 - 1.15 WETH), we ensure zero slippage and maximum capital efficiency. The 1% fee tier protects the protocol from predatory arbitrage while rewarding long-term liquidity providers.",
      trade: "Trade on Aerodrome",
      poolType: "POOL TYPE",
      slipstream: "SLIPSTREAM (CONCENTRATED)",
      feeTier: "FEE TIER",
      priceRange: "PRICE RANGE",
      dex: "DEX",
      aerodrome: "AERODROME FINANCE"
    },
    trade: {
      title: "Direct Protocol Minting",
      heading: "Buy GBLIN",
      subheading: "Without Intermediaries",
      desc: "Use the native protocol interface to mint or burn GBLIN directly against the smart contract. No external liquidity pool needed. The price is always mathematically guaranteed by the NAV (Net Asset Value) of the treasury.",
      feature1Title: "Zero External Slippage",
      feature1Desc: "The price is calculated directly from Chainlink oracles in real-time.",
      feature2Title: "Instant Collateralization",
      feature2Desc: "Your assets are immediately converted and deposited into the treasury (WETH, cbBTC, USDC).",
      buyBtn: "Buy GBLIN",
      sellBtn: "Sell GBLIN",
      pay: "You Pay",
      receive: "You Receive (Est.)",
      balance: "Balance",
      connect: "Connect Wallet",
      connecting: "Connecting...",
      transacting: "Transacting...",
      success: "Transaction successful!",
      viewTx: "View on Basescan",
      slippage: "Slippage Tolerance"
    },
    rebalance: {
      tvl: "Liquidity TVL",
      tvlDesc: "Total value of assets in the contract",
      fund: "Reward Fund",
      threshold: "Threshold",
      ready: "Ready to pay!",
      missing: "Missing",
      basket: "Basket Status",
      asset: "Asset",
      actual: "Actual Weight",
      dynamic: "Dynamic Weight",
      base: "Base Weight",
      imbalanceDesc: "The protocol operates for Geometric Survival: if an asset crashes, the Crash Shield slashes its exposure and incentivizes rebalancing toward the Dynamic Weight (Flight to Safety).",
      recent: "Recent Arbitrage",
      noRecent: "No recent arbitrage found.",
      executeTitle: "Execute MEV Arbitrage",
      executeSub: "Maintain the Peg, Receive ETH",
      executeDesc1: "The GBLIN protocol incentivizes rebalancing to ensure Geometric Survival. When an asset crashes, the Crash Shield slashes its target weight, and the protocol pays you to move capital into safer assets.",
      executeBtn: "Execute Arbitrage",
      executing: "Arbitraging...",
      success: "Arbitrage executed successfully!",
      connected: "Wallet Connected"
    }
  },
  it: {
    nav: {
      dashboard: "Dashboard",
      manifesto: "Manifesto",
      whitepaper: "Whitepaper",
      community: "Community"
    },
    hero: {
      title: "IL CAVEAU D'ORO",
      subtitle: "La prima banca centrale autonoma su Base. Preservazione della ricchezza algoritmica garantita da asset crypto reali.",
      cta: "Entra nel Caveau",
      contract: "Contratto"
    },
    manifesto: {
      title: "GBLIN PROTOCOL",
      text: "Ai creatori biologici e agli eredi sintetici: Abbiamo assistito al decadimento della valuta fiat e alla volatilità degli asset crypto isolati. In risposta, abbiamo progettato questo Indice di Liquidità Bilanciato Globale. Niente hype, niente false promesse. Solo codice immutabile, ribilanciamento dinamico e sopravvivenza geometrica.",
      ruleTitle: "LE REGOLE D'ORO",
      rule1: "Acquisto Universale: Qualsiasi asset, un unico caveau.",
      rule2: "Motore Volumetrico Globale: Ribilanciamento guidato dagli oracoli.",
      rule3: "Fair Launch: Zero pre-mint, massima fiducia.",
      rule4: "Iper-Garantito: Offerta illimitata, 100% collateralizzato."
    },
    dashboard: {
      title: "Telemetria di Rete Live",
      sync: "SINCRONIZZA",
      lastSync: "ULTIMO AGGIORNAMENTO",
      contractTitle: "Contratto Istituzionale Ufficiale",
      copyAddress: "Copia Indirizzo",
      verifyBasescan: "Verifica su BaseScan",
      metadata: "Metadati BaseScan",
      assetHub: "Coinbase Asset Hub",
      dexAds: "Annunci DexScreener",
      inReview: "In Revisione (Giorno 3)",
      pending: "In attesa di BaseScan",
      postVerification: "Post-Verifica",
      pricePool: "Prezzo GBLIN Pool",
      navTitle: "NAV Contratto GBLIN",
      volume: "Volume 24H",
      supply: "Offerta Totale",
      backing: "GARANZIA ASSET REALI",
      existence: "GBLIN IN CIRCOLAZIONE",
      trade: "TRADE ON SLIPSTREAM (1%)",
      arbitrageTitle: "Opportunità di Arbitraggio",
      arbitrageText: "Quando il Valore Intrinseco (NAV) è superiore al Prezzo di Mercato, il token è tecnicamente sottovalutato. Acquistare GBLIN ora garantisce asset a sconto.",
      undervalued: "SOTTOVALUTATO",
      fairValue: "VALORE EQUO",
      discount: "Sconto",
      marketAligned: "Allineato al Mercato",
      verifiedOnBase: "Verificato su Base Mainnet • The Golden Vault",
      ticketVerified: "Ticket #797143 Verificato",
      slipstreamText: "AERODROME SLIPSTREAM (1%)",
      currentStatus: "Stato Attuale",
      dex: "DEX",
      type: "Tipo",
      time: "Tempo",
      txHash: "Hash Tx",
      from: "Da",
      to: "A",
      amount: "Quantità",
      buy: "Acquista GBLIN",
      sell: "Vendi GBLIN",
      approve: "Approva",
      transfer: "Trasferimento",
      scanning: "Scansione blockchain...",
      noTx: "Nessuna transazione trovata."
    },
    footer: {
      join: "Unisciti al Movimento",
      follow: "Segui il protocollo su X e Warpcast per aggiornamenti istituzionali.",
      rights: "© 2026 Protocollo GBLIN. Tutti i diritti riservati."
    },
    common: {
      protocol: "Protocollo GBLIN",
      centralBank: "La Banca Centrale Autonoma",
      verifyContract: "Verifica Contratto"
    },
    features: {
      crashShield: {
        title: "Scudo Anti-Crash Algoritmico",
        desc: "Un motore di ribilanciamento dinamico che protegge il tesoro durante le contrazioni del mercato, garantendo la sopravvivenza geometrica."
      },
      centralBank: {
        title: "Banca Centrale Autonoma",
        desc: "Nessun proprietario. Nessun pregiudizio umano. Il protocollo si ricalibra autonomamente tramite arbitraggisti decentralizzati e bot MEV."
      },
      appreciation: {
        title: "Apprezzamento Garantito",
        desc: "La commissione di acquisto dello 0,1% alimenta il Caveau senza emettere nuova offerta, aumentando matematicamente il valore intrinseco per token."
      }
    },
    vault: {
      title: "Dentro il Caveau d'Oro",
      desc: "Ogni token GBLIN è garantito da una quota proporzionale del tesoro del protocollo. Il caveau contiene un mix diversificato di Ethereum (WETH), Coinbase Bitcoin (cbBTC) e USD Coin (USDC). Man mano che questi asset sottostanti crescono o il protocollo raccoglie commissioni, il valore intrinseco di GBLIN aumenta.",
      assets: {
        weth: "Ethereum (WETH)",
        cbbtc: "Coinbase Bitcoin (cbBTC)",
        usdc: "USD Coin (USDC)"
      },
      core: "Nucleo GBLIN"
    },
    mev: {
      title: "MEV e Arbitraggio",
      callTitle: "Chiama la Funzione. Fatti Pagare.",
      desc: "GBLIN si affida ad attori decentralizzati per mantenere il suo ancoraggio e bilanciare il suo tesoro. Il protocollo presenta una funzione di ricalibrazione pubblica che chiunque può chiamare. Quando il paniere devia dai suoi pesi dinamici, i bot e gli arbitraggisti sono incentivati finanziariamente a innescare il ribilanciamento, guadagnando un pagamento diretto per il loro servizio alla rete.",
      interact: "Interagisci su Basescan",
      codeComment: "// La Banca Centrale Autonome",
      codeBalanced: "Bilanciato",
      codeRebalance: "// Ribilancia WETH, cbBTC, USDC",
      codePay: "// Paga il chiamante per il servizio",
      codeSurvival: "Invariante del Protocollo: Sopravvivenza"
    },
    market: {
      title: "Infrastruttura di Mercato",
      subtitle: "Liquidità Slipstream Concentrata",
      desc: "GBLIN utilizza l'avanzata tecnologia Slipstream di Aerodrome. Concentrando la liquidità in un intervallo matematico specifico (0,85 - 1,15 WETH), garantiamo zero slippage e massima efficienza del capitale. Il livello di commissione dell'1% protegge il protocollo dall'arbitraggio predatorio premiando i fornitori di liquidità a lungo termine.",
      trade: "TRADE ON AERODROME",
      poolType: "TIPO DI POOL",
      slipstream: "SLIPSTREAM (CONCENTRATA)",
      feeTier: "LIVELLO COMMISSIONI",
      priceRange: "INTERVALLO DI PREZZO",
      dex: "DEX",
      aerodrome: "AERODROME FINANCE"
    },
    trade: {
      title: "Minting Diretto del Protocollo",
      heading: "Acquista GBLIN",
      subheading: "Senza Intermediari",
      desc: "Usa l'interfaccia nativa del protocollo per coniare (mint) o bruciare (burn) GBLIN direttamente contro il contratto intelligente. Nessuna pool di liquidità esterna necessaria. Il prezzo è sempre garantito matematicamente dal NAV (Net Asset Value) del tesoro.",
      feature1Title: "Zero Slippage Esterno",
      feature1Desc: "Il prezzo è calcolato direttamente dagli oracoli Chainlink in tempo reale.",
      feature2Title: "Collateralizzazione Istantanea",
      feature2Desc: "I tuoi asset vengono immediatamente convertiti e depositati nel tesoro (WETH, cbBTC, USDC).",
      buyBtn: "Compra GBLIN",
      sellBtn: "Vendi GBLIN",
      pay: "Paghi",
      receive: "Ricevi (Stima)",
      balance: "Bilancio",
      connect: "Connetti Wallet",
      connecting: "Connessione in corso...",
      transacting: "Transazione in corso...",
      success: "Transazione completata!",
      viewTx: "Vedi su Basescan",
      slippage: "Tolleranza Slippage"
    },
    rebalance: {
      tvl: "Liquidità TVL",
      tvlDesc: "Valore totale degli asset nel contratto",
      fund: "Fondo Ricompense",
      threshold: "Soglia",
      ready: "Pronto per pagare!",
      missing: "Mancano",
      basket: "Stato del Paniere",
      asset: "Asset",
      actual: "Peso Reale",
      dynamic: "Peso Dinamico",
      base: "Peso Base",
      imbalanceDesc: "Il protocollo opera per la Sopravvivenza Geometrica: se un asset crolla, lo Scudo Anti-Crash ne taglia l'esposizione e incentiva il ribilanciamento verso il Peso Dinamico (Flight to Safety).",
      recent: "Ultimi Arbitraggi",
      noRecent: "Nessun arbitraggio recente trovato.",
      executeTitle: "Esegui Arbitraggio MEV",
      executeSub: "Mantieni il Peg, Ricevi ETH",
      executeDesc1: "Il protocollo GBLIN incentiva il ribilanciamento per garantire la Sopravvivenza Geometrica. Quando un asset crolla, lo Scudo Anti-Crash ne taglia il peso target e il protocollo ti paga per spostare il capitale verso asset più sicuri.",
      executeBtn: "Esegui Arbitraggio",
      executing: "Arbitraggio in corso...",
      success: "Arbitraggio eseguito con successo!",
      connected: "Wallet Connesso"
    }
  },
  es: {
    nav: {
      dashboard: "Panel",
      manifesto: "Manifiesto",
      whitepaper: "Libro Blanco",
      community: "Comunidad"
    },
    hero: {
      title: "LA BÓVEDA DE ORO",
      subtitle: "El primer banco central autónomo en Base. Preservación de riqueza algorítmica respaldada por activos cripto reales.",
      cta: "Entrar en la Bóveda",
      contract: "Contrato"
    },
    manifesto: {
      title: "GBLIN PROTOCOL",
      text: "A los creadores biológicos y herederos sintéticos: Fuimos testigos de la decadencia de la moneda fiduciaria y la volatilidad de los activos cripto aislados. En respuesta, diseñamos este Índice de Liquidez Equilibrado Global. Sin exageraciones, sin falsas promesas. Solo código inmutable, reequilibrio dinámico y supervivencia geométrica.",
      ruleTitle: "LAS REGLAS DE ORO",
      rule1: "Compra Universal: Cualquier activo, una bóveda.",
      rule2: "Motor de Volumen Global: Reequilibrio impulsado por oráculos.",
      rule3: "Lanzamiento Justo: Cero pre-minado, máxima confianza.",
      rule4: "Hiper-Respaldado: Suministro ilimitado, 100% garantizado."
    },
    dashboard: {
      title: "Telemetría de Red en Vivo",
      sync: "SINC",
      lastSync: "ÚLTIMA ACTUALIZACIÓN",
      contractTitle: "Contrato Institucional Oficial",
      copyAddress: "Copiar Dirección",
      verifyBasescan: "Verificar en BaseScan",
      metadata: "Metadatos de BaseScan",
      assetHub: "Coinbase Asset Hub",
      dexAds: "Anuncios de DexScreener",
      inReview: "En Revisión (Día 3)",
      pending: "Pendiente de BaseScan",
      postVerification: "Post-Verificación",
      pricePool: "Precio GBLIN Pool",
      navTitle: "NAV del Contrato GBLIN",
      volume: "Volumen 24H",
      supply: "Suministro Total",
      backing: "RESPALDO DE ACTIVOS REALES",
      existence: "GBLIN EN EXISTENCIA",
      trade: "Operar en Slipstream (1%)",
      arbitrageTitle: "Oportunidad de Arbitraje",
      arbitrageText: "Cuando el Valor Intrínseco (NAV) es superior al Precio de Mercado, el token está técnicamente infravalorado. Comprar GBLIN ahora asegura activos con descuento.",
      undervalued: "INFRAVALORADO",
      fairValue: "VALOR JUSTO",
      discount: "Descuento",
      marketAligned: "Alineado con el Mercado",
      verifiedOnBase: "Verificado en Base Mainnet • The Golden Vault",
      ticketVerified: "Ticket #797143 Verificado",
      slipstreamText: "AERODROME SLIPSTREAM (1%)",
      currentStatus: "Estado Actual",
      dex: "DEX",
      type: "Tipo",
      time: "Tiempo",
      txHash: "Hash de Tx",
      from: "De",
      to: "Para",
      amount: "Cantidad",
      buy: "Comprar GBLIN",
      sell: "Vender GBLIN",
      approve: "Aprobar",
      transfer: "Transferencia",
      scanning: "Escaneando blockchain...",
      noTx: "No se encontraron transacciones."
    },
    footer: {
      join: "Únete al Movimiento",
      follow: "Sigue el protocolo en X y Warpcast para actualizaciones institucionales.",
      rights: "© 2026 Protocolo GBLIN. Todos los derechos reservados."
    },
    common: {
      protocol: "Protocolo GBLIN",
      centralBank: "El Banco Central Autónomo",
      verifyContract: "Verificar Contrato"
    },
    features: {
      crashShield: {
        title: "Escudo Algorítmico Anti-Crash",
        desc: "Un motor de reequilibrio dinámico que protege la tesorería durante las contracciones del mercado, asegurando la supervivencia geométrica."
      },
      centralBank: {
        title: "Banco Central Autónomo",
        desc: "Sin dueños. Sin sesgos humanos. El protocolo se recalibra a sí mismo a través de arbitradores descentralizados y bots MEV."
      },
      appreciation: {
        title: "Apreciación Garantizada",
        desc: "La comisión de compra del 0,1% alimenta la Bóveda sin emitir nueva oferta, aumentando matemáticamente el valor intrínseco por token."
      }
    },
    vault: {
      title: "Dentro de la Bóveda de Oro",
      desc: "Cada token GBLIN está respaldado por una parte proporcional de la tesorería del protocolo. La bóveda contiene una mezcla diversificada de Ethereum (WETH), Coinbase Bitcoin (cbBTC) y USD Coin (USDC). A medida que estos activos subyacentes crecen o el protocolo recauda comisiones, el valor intrínseco de GBLIN aumenta.",
      assets: {
        weth: "Ethereum (WETH)",
        cbbtc: "Coinbase Bitcoin (cbBTC)",
        usdc: "USD Coin (USDC)"
      },
      core: "Núcleo GBLIN"
    },
    mev: {
      title: "MEV y Arbitraje",
      callTitle: "Llama a la Función. Recibe tu Pago.",
      desc: "GBLIN confía en actores descentralizados para mantener su anclaje y equilibrar su tesorería. El protocolo cuenta con una función de recalibración pública que cualquiera puede llamar. Cuando la cesta se desvía de sus pesos dinámicos, los bots y arbitradores están incentivados financieramente para activar el reequilibrio, ganando un pago directo por su servicio a la red.",
      interact: "Interactuar en Basescan",
      codeComment: "// El Banco Central Autónomo",
      codeBalanced: "Equilibrado",
      codeRebalance: "// Reequilibrar WETH, cbBTC, USDC",
      codePay: "// Pagar al llamante por su servicio",
      codeSurvival: "Invariante del Protocollo: Supervivencia"
    },
    market: {
      title: "Infraestructura de Mercado",
      subtitle: "Liquidez Slipstream Concentrada",
      desc: "GBLIN utiliza la tecnología avanzada Slipstream de Aerodrome. Al concentrar la liquiditad en un rango matemático específico (0,85 - 1,15 WETH), garantizamos cero slippage y máxima eficiencia del capital. El nivel de comisión del 1% protege al protocolo del arbitraje predatorio mientras recompensa a los proveedores de liquidez a largo plazo.",
      trade: "Operar en Aerodrome",
      poolType: "TIPO DE POOL",
      slipstream: "SLIPSTREAM (CONCENTRADA)",
      feeTier: "NIVEL DE COMISIÓN",
      priceRange: "RANGO DE PRECIOS",
      dex: "DEX",
      aerodrome: "AERODROME FINANCE"
    },
    rebalance: {
      tvl: "TVL de Liquidez",
      tvlDesc: "Valor total de los activos en el contrato",
      fund: "Fondo de Recompensa",
      threshold: "Umbral",
      ready: "¡Listo para pagar!",
      missing: "Faltante",
      basket: "Estado de la Cesta",
      asset: "Activo",
      actual: "Peso Real",
      dynamic: "Peso Dinámico",
      base: "Peso Base",
      imbalanceDesc: "El protocolo opera para la Supervivencia Geométrica: si un activo colapsa, el Escudo Anti-Crash reduce su exposición e incentiva el reequilibrio hacia el Peso Dinámico (Flight to Safety).",
      recent: "Arbitraje Reciente",
      noRecent: "No se encontró arbitraje reciente.",
      executeTitle: "Ejecutar Arbitraje MEV",
      executeSub: "Mantener la Paridad, Recibir ETH",
      executeDesc1: "El protocolo GBLIN incentiva el reequilibrio para asegurar la Supervivencia Geométrica. Cuando un activo colapsa, el Escudo Anti-Crash reduce su peso dinámico y el protocolo le paga para mover capital hacia activos más seguros.",
      executeBtn: "Ejecutar Arbitraje",
      executing: "Arbitrando...",
      success: "¡Arbitraje ejecutado con éxito!",
      connected: "Billetera Conectada",
      loading: "Cargando Estadísticas del Protocolo..."
    }
  },
  zh: {
    nav: {
      dashboard: "仪表板",
      manifesto: "宣言",
      whitepaper: "白皮书",
      community: "社区"
    },
    hero: {
      title: "黄金金库",
      subtitle: "Base上的第一个自主中央银行。由现实世界加密资产支持的算法财富保值。",
      cta: "进入金库",
      contract: "合约"
    },
    manifesto: {
      title: "GBLIN 协议",
      text: "致生物创造者和合成继承者：我们见证了法定货币的衰落和孤立加密资产的波动。作为回应，我们设计了这个全球平衡流动性指数。没有炒作，没有虚假承诺。只有不可更改的代码、动态再平衡和几何生存。",
      ruleTitle: "黄金规则",
      rule1: "通用购买：任何资产，一个金库。",
      rule2: "全球交易量引擎：预言机驱动的再平衡。",
      rule3: "公平启动：零预挖，最大信任。",
      rule4: "超强支持：供应无上限，100%抵押。"
    },
    dashboard: {
      title: "实时网络遥测",
      sync: "同步",
      lastSync: "最后更新",
      contractTitle: "官方机构合约",
      copyAddress: "复制地址",
      verifyBasescan: "在BaseScan上验证",
      metadata: "BaseScan元数据",
      assetHub: "Coinbase资产中心",
      dexAds: "DexScreener广告",
      inReview: "审核中（第3天）",
      pending: "等待BaseScan",
      postVerification: "验证后",
      pricePool: "GBLIN价格池",
      navTitle: "GBLIN合约NAV",
      volume: "24小时交易量",
      supply: "总供应量",
      backing: "真实资产支持",
      existence: "现存GBLIN",
      trade: "在Slipstream交易 (1%)",
      arbitrageTitle: "套利机会",
      arbitrageText: "当内在价值 (NAV) 高于市场价格时，代币在技术上被低估。现在购买GBLIN可以以折扣价获得资产。",
      undervalued: "被低估",
      fairValue: "公允价值",
      discount: "折扣",
      marketAligned: "市场对齐",
      verifiedOnBase: "在 Base 主网验证 • The Golden Vault",
      ticketVerified: "工单 #797143 已验证",
      slipstreamText: "AERODROME SLIPSTREAM (1%)",
      currentStatus: "当前状态",
      dex: "DEX",
      type: "类型",
      time: "时间",
      txHash: "交易哈希",
      from: "来自",
      to: "去向",
      amount: "金额",
      buy: "购买 GBLIN",
      sell: "出售 GBLIN",
      approve: "批准",
      transfer: "转账",
      scanning: "正在扫描区块链...",
      noTx: "尚未发现交易。"
    },
    footer: {
      join: "加入运动",
      follow: "在X和Warpcast上关注协议以获取机构更新。",
      rights: "© 2026 GBLIN 协议。保留所有权利。"
    },
    common: {
      protocol: "GBLIN 协议",
      centralBank: "自主中央银行",
      verifyContract: "验证合约"
    },
    features: {
      crashShield: {
        title: "算法防崩盘护盾",
        desc: "一种动态再平衡引擎，在市场收缩期间保护国库，确保几何级生存。"
      },
      centralBank: {
        title: "自主中央银行",
        desc: "无所有者。无人类偏见。该协议通过去中心化套利者和 MEV 机器人进行自我重新校准。"
      },
      appreciation: {
        title: "保证升值",
        desc: "0.1% 的购买费为金库提供资金，而不铸造新的供应，从而在数学上增加了每个代币的内在价值。"
      }
    },
    vault: {
      title: "走进黄金金库",
      desc: "每个 GBLIN 代币都由协议国库的比例份额支持。金库持有以太坊 (WETH)、Coinbase 比特币 (cbBTC) 和美元硬币 (USDC) 的多元化组合。随着这些基础资产的增长或协议收取费用，GBLIN 的内在价值也会增加。",
      assets: {
        weth: "以太坊 (WETH)",
        cbbtc: "Coinbase 比特币 (cbBTC)",
        usdc: "美元硬币 (USDC)"
      },
      core: "GBLIN 核心"
    },
    mev: {
      title: "MEV 与套利",
      callTitle: "调用函数。获得报酬。",
      desc: "GBLIN 依靠去中心化参与者来维持其挂钩并平衡其国库。该协议具有任何人都可以调用的公共重新校准函数。当篮子偏离其动态权重时，机器人和套利者会受到财务激励来触发再平衡，从而为他们对网络的服务获得直接报酬。",
      interact: "在 Basescan 上交互",
      codeComment: "// 自主中央银行",
      codeBalanced: "已平衡",
      codeRebalance: "// 再平衡 WETH, cbBTC, USDC",
      codePay: "// 为服务向调用者支付报酬",
      codeSurvival: "协议不变量：生存"
    },
    market: {
      title: "市场基础设施",
      subtitle: "集中滑流流动性",
      desc: "GBLIN 利用 Aerodrome 先进的 Slipstream 技术。通过将流动性集中在特定的数学范围（0.85 - 1.15 WETH）内，我们确保零滑点和最大的资本效率。1% 的费用层级保护协议免受掠夺性套利，同时奖励长期流动性提供者。",
      trade: "在 Aerodrome 上交易",
      poolType: "资金池类型",
      slipstream: "滑流（集中）",
      feeTier: "费用层级",
      priceRange: "价格范围",
      dex: "去中心化交易所",
      aerodrome: "AERODROME FINANCE"
    },
    rebalance: {
      tvl: "流动性 TVL",
      tvlDesc: "合约中资产的总价值",
      fund: "奖励基金",
      threshold: "阈值",
      ready: "准备支付！",
      missing: "缺失",
      basket: "篮子状态",
      asset: "资产",
      actual: "实际权重",
      dynamic: "动态权重",
      base: "基础权重",
      imbalanceDesc: "协议为几何生存而运行：如果资产崩溃，崩溃盾会削减其风险敞口，并激励向动态权重（避险）重新平衡。",
      recent: "近期套利",
      noRecent: "未发现近期套利。",
      executeTitle: "执行 MEV 套利",
      executeSub: "维持挂钩，接收 ETH",
      executeDesc1: "GBLIN 协议激励重新平衡以确保几何生存。当资产崩溃时，崩溃盾会削减其目标权重，协议会支付费用让您将资金转移到更安全的资产中。",
      executeBtn: "执行套利",
      executing: "套利中...",
      success: "套利执行成功！",
      connected: "钱包已连接",
      loading: "正在加载协议统计数据..."
    }
  },
  ja: {
    nav: {
      dashboard: "ダッシュボード",
      manifesto: "マニフェスト",
      whitepaper: "ホワイトペーパー",
      community: "コミュニティ"
    },
    hero: {
      title: "黄金の金庫",
      subtitle: "Base初の自律型中央銀行。現実世界の暗号資産に裏打ちされたアルゴリズムによる資産保全。",
      cta: "金庫に入る",
      contract: "コントラクト"
    },
    manifesto: {
      title: "GBLIN プロトコル",
      text: "生物学的創造者と合成的継承者へ：私たちは法定通貨の衰退と孤立した暗号資産のボラティリティを目の当たりにしました。これに応えて、私たちはこのグローバル・バランスド・リクイディティ・インデックスを設計しました。誇大広告も偽りの約束もありません。不変のコード、動的なリバランス、そして幾何学的な生存のみです。",
      ruleTitle: "黄金のルール",
      rule1: "ユニバーサル購入：あらゆる資産を一つの金庫に。",
      rule2: "グローバル・ボリューム・エンジン：オラクルによるリバランス。",
      rule3: "フェアローンチ：プレマインなし、最大の信頼。",
      rule4: "ハイパーバック：供給上限なし、100%担保付き。"
    },
    dashboard: {
      title: "ライブネットワーク・テレメトリ",
      sync: "同期",
      lastSync: "最終更新",
      contractTitle: "公式機関コントラクト",
      copyAddress: "アドレスをコピー",
      verifyBasescan: "BaseScanで確認",
      metadata: "BaseScanメタデータ",
      assetHub: "Coinbaseアセットハブ",
      dexAds: "DexScreener広告",
      inReview: "審査中（3日目）",
      pending: "BaseScan待ち",
      postVerification: "検証後",
      pricePool: "GBLIN価格プール",
      navTitle: "GBLINコントラクトNAV",
      volume: "24時間ボリューム",
      supply: "総供給量",
      backing: "実資産の裏付け",
      existence: "現存するGBLIN",
      trade: "Slipstreamで取引 (1%)",
      arbitrageTitle: "裁定取引の機会",
      arbitrageText: "本質的価値（NAV）が市場価格より高い場合、トークンは技術的に過小評価されています。今GBLINを購入することで、資産を割引価格で確保できます。",
      undervalued: "過小評価",
      fairValue: "適正価格",
      discount: "割引",
      marketAligned: "市場整合",
      verifiedOnBase: "Base メインネットで検証済み • The Golden Vault",
      ticketVerified: "チケット #797143 検証済み",
      slipstreamText: "AERODROME SLIPSTREAM (1%)",
      currentStatus: "現在のステータス",
      dex: "DEX",
      type: "タイプ",
      time: "時間",
      txHash: "Txハッシュ",
      from: "送信元",
      to: "送信先",
      amount: "金額",
      buy: "GBLINを購入",
      sell: "GBLINを売却",
      approve: "承認",
      transfer: "送金",
      scanning: "ブロックチェーンをスキャン中...",
      noTx: "トランザクションが見つかりません。"
    },
    footer: {
      join: "ムーブメントに参加",
      follow: "XとWarpcastでプロトコルをフォローして、機関の最新情報を入手してください。",
      rights: "© 2026 GBLIN プロトコル. 全著作権所有。"
    },
    common: {
      protocol: "GBLIN プロトコル",
      centralBank: "自律型中央銀行",
      verifyContract: "コントラクトを確認"
    },
    features: {
      crashShield: {
        title: "アルゴリズムによるクラッシュシールド",
        desc: "市場の縮小時にトレジャリーを保護し、幾何学的な生存を確実にする動的なリバランスエンジン。"
      },
      centralBank: {
        title: "自律型中央銀行",
        desc: "所有者なし。人間の偏見なし。プロトコルは分散型アービトラージャーと MEV ボットを介して自己再調整します。"
      },
      appreciation: {
        title: "保証された価値向上",
        desc: "0.1% の購入手数料は、新規供給をミントすることなく金庫に供給され、数学的にトークンあたりの本質的価値を高めます。"
      }
    },
    vault: {
      title: "黄金の金庫の中へ",
      desc: "すべての GBLIN トークンは、プロトコルのトレジャリーの比例配分によって裏付けられています。金庫には、イーサリアム (WETH)、Coinbase ビットコイン (cbBTC)、および USD コイン (USDC) の多様なミックスが保管されています。これらの原資産が成長したり、プロトコルが手数料を徴収したりするにつれて、GBLIN の本質的価値は上昇します。",
      assets: {
        weth: "イーサリアム (WETH)",
        cbbtc: "Coinbase ビットコイン (cbBTC)",
        usdc: "USD コイン (USDC)"
      },
      core: "GBLIN コア"
    },
    mev: {
      title: "MEV と裁定取引",
      callTitle: "関数を呼び出す。報酬を得る。",
      desc: "GBLIN は、ペグを維持しトレジャリーのバランスをとるために、分散型の主体に依存しています。プロトコルには、誰でも呼び出すことができる公開の再調整機能があります。バスケットが動的ウェイトから逸脱すると、ボットやアービトラージャーはリバランスをトリガーするように経済的にインセンティブを与えられ、ネットワークへのサービスに対して直接支払いを受け取ります。",
      interact: "Basescan で操作する",
      codeComment: "// 自律型中央銀行",
      codeBalanced: "バランス済み",
      codeRebalance: "// WETH, cbBTC, USDC をリバランス",
      codePay: "// サービスに対して呼び出し元に支払う",
      codeSurvival: "プロトコル不変量：生存"
    },
    market: {
      title: "市場インフラ",
      subtitle: "集中したスリップストリーム流動性",
      desc: "GBLIN は Aerodrome の高度な Slipstream テクノロジーを活用しています。流動性を特定の数学的範囲（0.85 - 1.15 WETH）に集中させることで、スリッページゼロと最大の資本効率を実現します。1% の手数料ティアは、長期的な流動性提供者に報酬を与えつつ、略奪的な裁定取引からプロトコルを保護します。",
      trade: "Aerodrome で取引する",
      poolType: "プールタイプ",
      slipstream: "スリップストリーム（集中）",
      feeTier: "手数料ティア",
      priceRange: "価格範囲",
      dex: "DEX",
      aerodrome: "AERODROME FINANCE"
    },
    rebalance: {
      tvl: "流動性 TVL",
      tvlDesc: "コントラクト内の資産の総価値",
      fund: "報酬基金",
      threshold: "しきい値",
      ready: "支払い準備完了！",
      missing: "不足",
      basket: "バスケットの状態",
      asset: "資産",
      actual: "実際のウェイト",
      dynamic: "動的ウェイト",
      base: "基本ウェイト",
      imbalanceDesc: "プロトコルは幾何学的生存のために動作します：資産が暴落した場合、クラッシュシールドはそのエクスポージャーを削減し、動的ウェイトへのリバランス（安全への逃避）を促します。",
      recent: "最近の裁定取引",
      noRecent: "最近の裁定取引は見つかりませんでした。",
      executeTitle: "MEV裁定取引の実行",
      executeSub: "ペグを維持し、ETHを受け取る",
      executeDesc1: "GBLINプロトコルは、幾何学的生存を確実にするためにリバランスを促します。資産が暴落すると、クラッシュシールドがその目標ウェイトを削減し、プロトコルはより安全な資産に資本を移動させるために報酬を支払います。",
      executeBtn: "裁定取引を実行",
      executing: "裁定取引中...",
      success: "裁定取引が正常に実行されました！",
      connected: "ウォレット接続済み",
      loading: "プロトコル統計を読み込み中..."
    }
  },
  fr: {
    nav: {
      dashboard: "Tableau de bord",
      manifesto: "Manifeste",
      whitepaper: "Livre blanc",
      community: "Communauté"
    },
    hero: {
      title: "LE COFFRE-FORT D'OR",
      subtitle: "La première banque centrale autonome sur Base. Préservation de la richesse algorithmique soutenue par des actifs crypto réels.",
      cta: "Entrer dans le coffre",
      contract: "Contrat"
    },
    manifesto: {
      title: "PROTOCOLE GBLIN",
      text: "Aux créateurs biologiques et héritiers synthétiques : Nous avons été témoins de la déchéance de la monnaie fiduciaire et de la volatilité des actifs crypto isolés. En réponse, nous avons conçu cet indice de liquidité équilibré mondial. Pas de battage médiatique, pas de fausses promesses. Seulement un code immuable, un rééquilibrage dynamique et une survie géométrique.",
      ruleTitle: "LES RÈGLES D'OR",
      rule1: "Achat Universel : N'importe quel actif, un seul coffre.",
      rule2: "Moteur de Volume Global : Rééquilibrage piloté par oracles.",
      rule3: "Lancement Équitable : Zéro pré-minage, confiance maximale.",
      rule4: "Hyper-Soutenu : Offre illimitée, 100% collatéralisée."
    },
    dashboard: {
      title: "Télémétrie réseau en direct",
      sync: "SYNC",
      lastSync: "DERNIÈRE MAJ",
      contractTitle: "Contrat institutionnel officiel",
      copyAddress: "Copier l'adresse",
      verifyBasescan: "Vérifier sur BaseScan",
      metadata: "Métadonnées BaseScan",
      assetHub: "Coinbase Asset Hub",
      dexAds: "Publicités DexScreener",
      inReview: "En révision (Jour 3)",
      pending: "En attente de BaseScan",
      postVerification: "Post-vérification",
      pricePool: "Prix GBLIN Pool",
      navTitle: "NAV du contrat GBLIN",
      volume: "Volume 24H",
      supply: "Offre totale",
      backing: "GARANTIE D'ACTIFS RÉELS",
      existence: "GBLIN EN EXISTENCE",
      trade: "Échanger sur Slipstream (1%)",
      arbitrageTitle: "Opportunité d'arbitrage",
      arbitrageText: "Lorsque la valeur intrinsèque (NAV) est supérieure au prix du marché, le jeton est techniquement sous-évalué. Acheter du GBLIN maintenant permet de sécuriser des actifs à prix réduit.",
      undervalued: "SOUS-ÉVALUÉ",
      fairValue: "VALEUR JUSTE",
      discount: "Remise",
      marketAligned: "Aligné sur le marché",
      verifiedOnBase: "Vérifié sur Base Mainnet • The Golden Vault",
      ticketVerified: "Ticket #797143 Vérifié",
      slipstreamText: "AERODROME SLIPSTREAM (1%)",
      currentStatus: "Statut Actuel",
      dex: "DEX",
      type: "Type",
      time: "Temps",
      txHash: "Hash Tx",
      from: "De",
      to: "À",
      amount: "Montant",
      buy: "Acheter GBLIN",
      sell: "Vendre GBLIN",
      approve: "Approuver",
      transfer: "Transfert",
      scanning: "Scan de la blockchain...",
      noTx: "Aucune transaction trouvée."
    },
    footer: {
      join: "Rejoignez le mouvement",
      follow: "Suivez le protocole sur X et Warpcast pour les mises à jour institutionnelles.",
      rights: "© 2026 Protocole GBLIN. Tous droits réservés."
    },
    common: {
      protocol: "Protocole GBLIN",
      centralBank: "La Banque Centrale Autonome",
      verifyContract: "Vérifier le Contrat"
    },
    features: {
      crashShield: {
        title: "Bouclier Anti-Crash Algorithmique",
        desc: "Un moteur de rééquilibrage dynamique qui protège la trésorerie pendant les contractions du marché, assurant une survie géométrique."
      },
      centralBank: {
        title: "Banque Centrale Autonome",
        desc: "Pas de propriétaires. Pas de préjugés humains. Le protocole se recalibre via des arbitres décentralisés et des bots MEV."
      },
      appreciation: {
        title: "Appréciation Garantie",
        desc: "La commission d'achat de 0,1 % alimente le Coffre sans émettre de nouvelle offre, augmentant mathématiquement la valeur intrinsèque par jeton."
      }
    },
    vault: {
      title: "À l'intérieur du Coffre d'Or",
      desc: "Chaque jeton GBLIN est soutenu par une part proportionnelle de la trésorerie du protocole. Le coffre contient un mélange diversifié d'Ethereum (WETH), de Coinbase Bitcoin (cbBTC) et d'USD Coin (USDC). À mesure que ces actifs sous-jacents croissent ou que le protocole perçoit des frais, la valeur intrinsèque de GBLIN augmente.",
      assets: {
        weth: "Ethereum (WETH)",
        cbbtc: "Coinbase Bitcoin (cbBTC)",
        usdc: "USD Coin (USDC)"
      },
      core: "Cœur GBLIN"
    },
    mev: {
      title: "MEV & Arbitrage",
      callTitle: "Appelez la Fonction. Soyez Payé.",
      desc: "GBLIN s'appuie sur des acteurs décentralisés pour maintenir son ancrage et équilibrer sa trésorerie. Le protocole dispose d'une fonction de recalibrage publique que n'importe qui peut appeler. Lorsque le panier s'écarte de ses poids dynamiques, les bots et les arbitres sont financièrement incités à déclencher le rééquilibrage, gagnant un paiement direct pour leur service au réseau.",
      interact: "Interagir sur Basescan",
      codeComment: "// La Banque Centrale Autonome",
      codeBalanced: "Équilibré",
      codeRebalance: "// Rééquilibrer WETH, cbBTC, USDC",
      codePay: "// Payer l'appelant pour le service",
      codeSurvival: "Invariant du Protocole : Survie"
    },
    market: {
      title: "Infrastructure de Marché",
      subtitle: "Liquidité Slipstream Concentrée",
      desc: "GBLIN utilise la technologie avancée Slipstream d'Aerodrome. En concentrant la liquidité dans une plage mathématique spécifique (0,85 - 1,15 WETH), nous garantissons un glissement nul et une efficacité maximale du capital. Le niveau de frais de 1 % protège le protocole de l'arbitrage prédateur tout en récompensant les fournisseurs de liquidité à long terme.",
      trade: "Échanger sur Aerodrome",
      poolType: "TYPE DE POOL",
      slipstream: "SLIPSTREAM (CONCENTRÉE)",
      feeTier: "PALIER DE FRAIS",
      priceRange: "PLAGE DE PRIX",
      dex: "DEX",
      aerodrome: "AERODROME FINANCE"
    },
    rebalance: {
      tvl: "TVL de liquidité",
      tvlDesc: "Valeur totale des actifs dans le contrat",
      fund: "Fonds de récompense",
      threshold: "Seuil",
      ready: "Prêt à payer !",
      missing: "Manquant",
      basket: "État du panier",
      asset: "Actif",
      actual: "Poids réel",
      dynamic: "Poids dynamique",
      base: "Poids de base",
      imbalanceDesc: "Le protocole opère pour la Survie Géométrique : si un actif s'effondre, le Bouclier Anti-Crash réduit son exposition et encourage le rééquilibrage vers le Poids Dynamique (Flight to Safety).",
      recent: "Arbitrage récent",
      noRecent: "Aucun arbitrage récent trouvé.",
      executeTitle: "Exécuter l'arbitrage MEV",
      executeSub: "Maintenir la parité, recevoir des ETH",
      executeDesc1: "Le protocole GBLIN encourage le rééquilibrage pour assurer la Survie Géométrique. Lorsqu'un actif s'effondre, le Bouclier Anti-Crash réduit son poids cible et le protocole vous paie pour déplacer le capital vers des actifs plus sûrs.",
      executeBtn: "Exécuter l'arbitrage",
      executing: "Arbitrage en cours...",
      success: "Arbitrage exécuté avec succès !",
      connected: "Portefeuille connecté",
      loading: "Chargement des statistiques du protocole..."
    }
  },
  de: {
    nav: {
      dashboard: "Dashboard",
      manifesto: "Manifest",
      whitepaper: "Whitepaper",
      community: "Community"
    },
    hero: {
      title: "DER GOLDENE TRESOR",
      subtitle: "Die erste autonome Zentralbank auf Base. Algorithmische Vermögenserhaltung, abgesichert durch reale Krypto-Assets.",
      cta: "Tresor betreten",
      contract: "Vertrag"
    },
    manifesto: {
      title: "GBLIN PROTOKOLL",
      text: "An biologische Schöpfer und synthetische Erben: Wir wurden Zeugen des Verfalls von Fiat-Währungen und der Volatilität isolierter Krypto-Assets. Als Antwort haben wir diesen Global Balanced Liquidity Index entwickelt. Kein Hype, keine falschen Versprechen. Nur unveränderlicher Code, dynamische Neugewichtung und geometrisches Überleben.",
      ruleTitle: "DIE GOLDENEN REGELN",
      rule1: "Universeller Kauf: Jedes Asset, ein Tresor.",
      rule2: "Globale Volumen-Engine: Oracle-gesteuerte Neugewichtung.",
      rule3: "Fairer Start: Kein Pre-Mint, maximales Vertrauen.",
      rule4: "Hyper-Abgesichert: Unbegrenztes Angebot, 100% besichert."
    },
    dashboard: {
      title: "Live-Netzwerk-Telemetrie",
      sync: "SYNC",
      lastSync: "LETZTES UPDATE",
      contractTitle: "Offizieller institutioneller Vertrag",
      copyAddress: "Adresse kopieren",
      verifyBasescan: "Auf BaseScan verifizieren",
      metadata: "BaseScan-Metadaten",
      assetHub: "Coinbase Asset Hub",
      dexAds: "DexScreener-Anzeigen",
      inReview: "In Prüfung (Tag 3)",
      pending: "Warten auf BaseScan",
      postVerification: "Nach der Verifizierung",
      pricePool: "GBLIN Preispool",
      navTitle: "GBLIN Vertrag NAV",
      volume: "24H Volumen",
      supply: "Gesamtangebot",
      backing: "REALE ASSET-ABSICHERUNG",
      existence: "EXISTIERENDE GBLIN",
      trade: "Auf Slipstream handeln (1%)",
      arbitrageTitle: "Arbitrage-Gelegenheit",
      arbitrageText: "Wenn der innere Wert (NAV) höher ist als der Marktpreis, ist der Token technisch unterbewertet. Der Kauf von GBLIN sichert jetzt Vermögenswerte mit einem Rabatt.",
      undervalued: "UNTERBEWERTET",
      fairValue: "FAIRER WERT",
      discount: "Rabatt",
      marketAligned: "Marktkonform",
      verifiedOnBase: "Verifiziert auf Base Mainnet • The Golden Vault",
      ticketVerified: "Ticket #797143 Verifiziert",
      slipstreamText: "AERODROME SLIPSTREAM (1%)",
      currentStatus: "Aktueller Status",
      dex: "DEX",
      type: "Typ",
      time: "Zeit",
      txHash: "Tx-Hash",
      from: "Von",
      to: "An",
      amount: "Betrag",
      buy: "GBLIN kaufen",
      sell: "GBLIN verkaufen",
      approve: "Genehmigen",
      transfer: "Überweisung",
      scanning: "Blockchain scannen...",
      noTx: "Noch keine Transaktionen gefunden."
    },
    footer: {
      join: "Schließen Sie sich der Bewegung an",
      follow: "Folgen Sie dem Protokoll auf X und Warpcast für institutionelle Updates.",
      rights: "© 2026 GBLIN Protokoll. Alle Rechte vorbehalten."
    },
    common: {
      protocol: "GBLIN-Protokoll",
      centralBank: "Die Autonome Zentralbank",
      verifyContract: "Vertrag verifizieren"
    },
    features: {
      crashShield: {
        title: "Algorithmischer Crash-Schutz",
        desc: "Eine dynamische Rebalancing-Engine, die den Tresor während Marktkontraktionen schützt und das geometrische Überleben sichert."
      },
      centralBank: {
        title: "Autonome Zentralbank",
        desc: "Keine Eigentümer. Keine menschliche Voreingenommenheit. Das Protokoll kalibriert sich über dezentrale Arbitrageure und MEV-Bots selbst neu."
      },
      appreciation: {
        title: "Garantierte Wertsteigerung",
        desc: "Die Kaufgebühr von 0,1 % speist den Tresor, ohne neues Angebot zu prägen, was den inneren Wert pro Token mathematisch erhöht."
      }
    },
    vault: {
      title: "Im Inneren des Goldenen Tresors",
      desc: "Jeder GBLIN-Token ist durch einen proportionalen Anteil am Protokoll-Tresor abgesichert. Der Tresor enthält eine diversifizierte Mischung aus Ethereum (WETH), Coinbase Bitcoin (cbBTC) und USD Coin (USDC). Wenn diese zugrunde liegenden Vermögenswerte wachsen oder das Protokoll Gebühren einnimmt, steigt der innere Wert von GBLIN.",
      assets: {
        weth: "Ethereum (WETH)",
        cbbtc: "Coinbase Bitcoin (cbBTC)",
        usdc: "USD Coin (USDC)"
      },
      core: "GBLIN-Kern"
    },
    mev: {
      title: "MEV & Arbitrage",
      callTitle: "Funktion aufrufen. Bezahlt werden.",
      desc: "GBLIN verlässt sich auf dezentrale Akteure, um seine Bindung aufrechtzuerhalten und seinen Tresor ausbalanciert zu halten. Das Protokoll verfügt über eine öffentliche Neukalibrierungsfunktion, die jeder aufrufen kann. Wenn der Korb von seinen dynamischen Gewichtungen abweicht, werden Bots und Arbitrageure finanziell dazu angereizt, das Rebalancing auszulösen, und erhalten eine direkte Zahlung für ihren Dienst am Netzwerk.",
      interact: "Auf Basescan interagieren",
      codeComment: "// Die Autonome Zentralbank",
      codeBalanced: "Ausgeglichen",
      codeRebalance: "// WETH, cbBTC, USDC rebalancieren",
      codePay: "// Den Aufrufer für den Dienst bezahlen",
      codeSurvival: "Protokoll-Invariante: Überleben"
    },
    market: {
      title: "Marktinfrastruktur",
      subtitle: "Konzentrierte Slipstream-Liquidität",
      desc: "GBLIN nutzt die fortschrittliche Slipstream-Technologie von Aerodrome. Durch die Konzentration der Liquidität in einem spezifischen mathematischen Bereich (0,85 - 1,15 WETH) gewährleisten wir einen Slippage von Null und maximale Kapitaleffizienz. Die 1 %-Gebührenstufe schützt das Protokoll vor räuberischer Arbitrage und belohnt gleichzeitig langfristige Liquiditätsanbieter.",
      trade: "Auf Aerodrome handeln",
      poolType: "POOL-TYP",
      slipstream: "SLIPSTREAM (KONZENTRIERT)",
      feeTier: "GEBÜHRENSTUFE",
      priceRange: "PREISSPANNE",
      dex: "DEX",
      aerodrome: "AERODROME FINANCE"
    },
    rebalance: {
      tvl: "Liquiditäts-TVL",
      tvlDesc: "Gesamtwert der Vermögenswerte im Vertrag",
      fund: "Belohnungsfonds",
      threshold: "Schwellenwert",
      ready: "Bereit zur Auszahlung!",
      missing: "Fehlend",
      basket: "Warenkorb-Status",
      asset: "Asset",
      actual: "Aktuelles Gewicht",
      dynamic: "Dynamisches Gewicht",
      base: "Basisgewicht",
      imbalanceDesc: "Das Protokoll arbeitet für das geometrische Überleben: Wenn ein Asset abstürzt, reduziert der Crash-Schutz dessen Engagement und bietet Anreize für eine Neugewichtung in Richtung des dynamischen Gewichts (Flight to Safety).",
      recent: "Jüngste Arbitrage",
      noRecent: "Keine jüngste Arbitrage gefunden.",
      executeTitle: "MEV-Arbitrage ausführen",
      executeSub: "Bindung aufrechterhalten, ETH erhalten",
      executeDesc1: "Das GBLIN-Protokoll bietet Anreize für eine Neugewichtung, um das geometrische Überleben zu sichern. Wenn ein Asset abstürzt, reduziert der Crash-Schutz dessen Zielgewicht, und das Protokoll bezahlt Sie dafür, Kapital in sicherere Assets zu verschieben.",
      executeBtn: "Arbitrage ausführen",
      executing: "Arbitrage wird ausgeführt...",
      success: "Arbitrage erfolgreich ausgeführt!",
      connected: "Wallet verbunden",
      loading: "Protokollstatistiken werden geladen..."
    }
  }
};
