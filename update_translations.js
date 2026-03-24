const fs = require('fs');

let content = fs.readFileSync('translations/index.ts', 'utf8');

const newKeysEn = `
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
      target: "Target",
      imbalanceDesc: "If the actual weight deviates from the target, the asset is imbalanced and requires arbitrage.",
      recent: "Recent Arbitrage",
      noRecent: "No recent arbitrage found.",
      executeTitle: "Execute MEV Arbitrage",
      executeSub: "Maintain the Peg, Receive ETH",
      executeDesc1: "The GBLIN protocol pays users to keep the basket balanced. By clicking on ",
      executeDesc2: "Execute Arbitrage",
      executeDesc3: ", the system will check for imbalances. If a change is needed, the transaction will restore equilibrium and ",
      executeDesc4: "you will be automatically rewarded with 0.0001 ETH",
      executeDesc5: " (if the Stability Fund has reached the threshold).",
      executeBtn: "Execute Arbitrage",
      executing: "Arbitraging...",
      success: "Arbitrage executed successfully!",
      connected: "Wallet Connected"
    },
`;

const newKeysIt = `
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
      target: "Target",
      imbalanceDesc: "Se il peso reale si discosta dal target, l'asset è sbilanciato e richiede arbitraggio.",
      recent: "Ultimi Arbitraggi",
      noRecent: "Nessun arbitraggio recente trovato.",
      executeTitle: "Esegui Arbitraggio MEV",
      executeSub: "Mantieni il Peg, Ricevi ETH",
      executeDesc1: "Il protocollo GBLIN paga gli utenti per mantenere il paniere bilanciato. Cliccando su ",
      executeDesc2: "Esegui Arbitraggio",
      executeDesc3: ", il sistema verificherà se c'è uno sbilanciamento. Se la modifica è necessaria, la transazione riporterà i pesi in equilibrio e ",
      executeDesc4: "verrai ricompensato automaticamente con 0.0001 ETH",
      executeDesc5: " (se il Fondo di Stabilità ha raggiunto la soglia).",
      executeBtn: "Esegui Arbitraggio",
      executing: "Arbitraggio in corso...",
      success: "Arbitraggio eseguito con successo!",
      connected: "Wallet Connesso"
    },
`;

// Replace in content
content = content.replace(/market: \{[\s\S]*?\}\n  \},/g, match => match.slice(0, -4) + "},\n" + newKeysEn + "  },");
content = content.replace(/market: \{[\s\S]*?\}\n  \},/g, match => {
  if (match.includes("AERODROME FINANCE") && !match.includes("trade: {")) {
    return match.slice(0, -4) + "},\n" + newKeysIt + "  },";
  }
  return match;
});

// Since the regex replace might be tricky, let's just use a simpler approach.
// I will just write a new file with the added keys for 'en' and 'it' manually.
