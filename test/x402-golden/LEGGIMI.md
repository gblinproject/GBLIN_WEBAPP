# Golden fixture della sfida x402 non pagata

Il catalogo Bazaar di Coinbase **indicizza** la risposta 402 dei nostri endpoint a pagamento.
Se cambia senza che ce ne accorgiamo, spariamo dal catalogo o pubblichiamo termini sbagliati.
Questi file sono la fotografia byte-per-byte di com'e' oggi.

    node verify.mjs                 # confronta il live con le fixture (esce 1 se e' cambiato)
    node verify.mjs https://...     # stessa cosa contro un deploy di prova
    node capture.mjs                # riscrive le fixture — SOLO quando il cambio e' voluto

Coperti tutti e nove i percorsi del matcher x402, in due "flavor" (json e html).
Quattro (`quote`, `jit`, `invest`, `health`) rispondono **400** senza i parametri
richiesti, prima di arrivare al 402: e' il guard che evita di addebitare, e fa parte
del contratto pubblico tanto quanto il 402.

Si confrontano: codice di stato, header di contratto (`payment-required`,
`www-authenticate`, `content-type`) e il corpo intero.

Trappola gia' presa: `body.length` in JS conta i caratteri UTF-16, non i byte. La sfida
contiene trattini lunghi da 3 byte, quindi le due misure differiscono di una dozzina e
sembra che la sfida cambi quando invece e' stabile. Qui si usa `Buffer.byteLength`.

## verifica-metodi.mjs (aggiunto 22/08/2026)

`node verifica-metodi.mjs` — 45 confronti dal vivo: 9 percorsi x 5 metodi (GET, POST, PUT,
DELETE, OPTIONS), bordo contro origin, corpo + stato + header `payment-required`.

Serve perche' le Project Routing Rule di Vercel non sanno filtrare per metodo (le condizioni
sono solo Header, Cookie, Query, Host): al bordo arriva tutto. Il 22/08 questo ha prodotto una
regressione vera — `POST /api/x402/seal`, l'endpoint a pagamento dei sigilli, rispondeva 404
invece della sfida — trovata prima che la incontrasse un cliente. L'origin echeggia il metodo
in due campi dei metadati Bazaar e dentro l'header `payment-required`; il bordo fa lo stesso.

Le fixture golden restano catturate in GET: questo script copre il resto senza duplicarle.
