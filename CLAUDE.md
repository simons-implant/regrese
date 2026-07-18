# Poznámky pro Clauda (interní údržba projektu)

Tento soubor čte Claude na začátku každé práce v této složce — technické
poznámky k údržbě, aby se nezapomněly mezi sezeními.

## Co je to za projekt

„Regresní analýza" — čistě statická webová appka (HTML/CSS/JS, bez build kroku)
pro regresní analýzu v prohlížeči, pro studenty. Autor Šimon Svoboda. Otevírá se
i přímo ze souboru (file://), počítej s tím. Verze se zobrazuje v index.html
(hledej `v2.5.` u `.app-title`) — **při každé změně povýšit o setinku**.

## KRITICKÉ pravidlo: style.css ↔ style-embed.js

`style-embed.js` je kopie obsahu style.css jako JS řetězec
(`window.__STYLE_CSS_TEXT__`). Export SVG z něj vkládá KaTeX CSS a fonty,
protože čtení `document.styleSheets` na file:// selže (SecurityError).

**Po JAKÉKOLI úpravě style.css musím znovu vygenerovat style-embed.js:**

```
node -e "const fs=require('fs');let c=fs.readFileSync('style.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');if(c.includes('<')||c.includes('&'))throw new Error('XML-unsafe znak v CSS');fs.writeFileSync('style-embed.js','// VYGENEROVANO ze style.css - needitovat rucne!\nwindow.__STYLE_CSS_TEXT__='+JSON.stringify(c)+';')"
```

(Komentáře se odstraňují a kontroluje se nepřítomnost `<`/`&` — obsah se vkládá
do `<style><![CDATA[...]]></style>` v exportovaném SVG a nesmí rozbít XML.)

## Ověření po každé změně

- `node --check app.js` (a případně style-embed.js)
- kontrola párovosti tagů index.html (Python html.parser skript)
- U exportu SVG: sestavit testovací SVG a validovat jako XML (xml.etree)

## Architektura ve zkratce

- `app.js` — veškerá logika UI, grafu, nástrojů i Pokročilého průvodce exportem
- `regression-core.js` — regresní výpočty (LM fit, Fourier, GE eliminace…)
- `index.html` — markup + inline app CSS (v `<style>` bloku v hlavě)
- `style.css` — POUZE fonty (Sora/Fira Code base64) + KaTeX CSS, jeden dlouhý řádek
- `chart.min.js`, `katex.min.js` — vendorované knihovny (neupravovat)
- `THIRD-PARTY-LICENSES.md` — licence, udržovat při přidání závislosti

## Zásadní poučení z vývoje (neopakovat chyby)

- Export SVG musí fungovat na file:// — nikdy nespoléhat na fetch/XHR/CSSOM.
- KaTeX HTML v legendě musí být uvnitř flex kontejneru zabalené v jednom
  `<span>` (jinak flexbox ořízne mezery mezi textovými uzly).
- `katex.renderToString` vždy s `output:'html'` (jinak zdvojený MathML obsah).
- Stahování souborů přes Blob, ne data: URI (limit délky).
- Parsování vkládaných dat: mezera má přednost před čárkou (české desetinné čárky).
- Vizuální chyby jde odhalit jen screenshotem od uživatele nebo testem
  v prohlížeči — node testy ověří jen logiku a syntaxi.
