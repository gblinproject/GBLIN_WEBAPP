# Esperimento: la sfida 402 servita dal bordo Vercel, senza invocare funzioni

**Stato: PREPARATO, NON APPLICATO.** Niente di qui dentro tocca la produzione finche'
non si copiano i file al loro posto su un branch. Il `vercel.json` vero non e' stato modificato.

## Perche'
Misurato il 22/08/2026: il **91% della CPU fatturata** (7h10m su 7h53m, contro 4h incluse) e'
il middleware x402 che risponde 402 a crawler e sonde — ~7.400 volte al giorno solo su gblin.
Il middleware gira **prima** della cache CDN, quindi nessuna cache puo' ridurlo, e su Vercel
il 402 non e' uno stato cacheabile. Il Firewall Vercel non puo' emettere un corpo personalizzato
(azioni disponibili: Log, Deny, Challenge, Bypass, Rate Limit): verificato sulla dashboard.

Resta un candidato che non richiede ne' Cloudflare ne' un cambio di DNS: le `routes` legacy di
`vercel.json`, che sanno servire un **file statico con uno status personalizzato**. Se il routing
serve il 402 da un file, la funzione non parte e il costo sparisce.

## Le tre trappole (grazie a Grok) — l'esperimento fallisce se le ignori
1. **Ordine di routing.** Il middleware gira PRIMA del filesystem. Se il matcher continua a
   coprire `/api/x402/*`, il middleware parte lo stesso e il test non dimostra nulla sul 91%.
   Va gattato anche il matcher (diff sotto).
2. **Corpo e Content-Type.** Lo `status` da solo non produce il corpo giusto: serve `dest` verso
   un file statico e gli header di contratto. La sfida vive anche nell'header `payment-required`
   (base64), non solo nel body: va replicato identico.
3. **I paganti.** Una route che manda sempre al 402 statico ROMPE i pagamenti. Serve la condizione
   `missing` sugli header di pagamento. Se `missing` non funziona con l'App Router, il candidato
   muore qui — ed e' un fallimento utile, non un incidente.

## Rischio noto in partenza
`vercel.json` non ha rewrites/redirects/headers, ma **`next.config.js` ha `headers()` e `redirects()`**:
le `routes` legacy convivono male con quello che genera il builder Next. Probabilita' reale che il
candidato non regga. Si scopre sul preview, che e' il punto.

## Come applicare (su un BRANCH, mai su main)
1. `cp public-x402/attestation.json ../../public/x402-static/attestation.json`
2. `cp vercel.json.PROPOSTA ../../vercel.json`
3. In `src/middleware.ts`, nel `config.matcher`, sostituire la voce
   `"/api/x402/attestation"` con la forma condizionale:

```js
{ source: "/api/x402/attestation",
  has: [{ type: "header", key: "x-payment" }] },
{ source: "/api/x402/attestation",
  has: [{ type: "header", key: "payment-signature" }] },
```

   (solo attestation: si prova UN endpoint, non tutti e nove.)
4. Push del branch, Vercel crea il preview, e si misura.

## Criteri di successo — tutti e quattro, altrimenti si scarta
    node misura.mjs https://<url-del-preview>

1. richiesta senza pagamento -> **402**;
2. corpo **byte-identico** alla fixture golden (`test/x402-golden`);
3. header `payment-required` identico;
4. richiesta CON header di pagamento -> **non** riceve la copia statica, arriva all'handler vero.

E il criterio che conta davvero, che lo script non puo' leggere da solo:
su Vercel **Observability > Functions** e **Usage > Invocations (scheda Type)** le richieste
non paganti **non devono generare invocazioni** ne' di middleware ne' di function.
Senza quel dato l'esperimento non conclude niente.

## Rollback
Ripristinare `vercel.json`, togliere la cartella `public/x402-static/`, rimettere il matcher
originale. Il branch si cancella e la produzione non ha mai visto niente.

## Se fallisce
Piano B: bordo esterno (Worker Cloudflare, che gia' abbiamo e gia' serve l'MCP), sapendo che
Vercel sconsiglia i reverse proxy davanti a se' e che il riferimento Coinbase per x402 e' invece
proprio "edge + origin intoccata". Quella decisione la prende il founder, non io.
