# Licence použitých knihoven a fontů

Tato appka je postavená na několika open-source knihovnách a fontech. Všechny
použité licence jsou permisivní (MIT / Apache-2.0 / OFL-1.1) — nejde o žádnou
copyleftovou (např. GPL) licenci, takže není problém appku volně provozovat
na webu (např. GitHub Pages), a to i pro výuku. Níže je přehled pro pořádek
a pro splnění licenčních podmínek (zejména u fontů, viz níže).

## Knihovny (JS)

- **Chart.js** v4.4.1 — vykreslování grafů (`chart.min.js`)
  Licence: MIT. © 2023 Chart.js Contributors. https://www.chartjs.org

- **KaTeX** — sazba matematiky/TeXu (`katex.min.js` + fonty v `style.css`)
  Licence: MIT. © 2013–2020 Khan Academy a přispěvatelé. https://katex.org

- **marked.js** — parsování Markdownu (návod), načítáno z CDN (jsdelivr)
  Licence: MIT. © MarkedJS (2018+), Christopher Jeffrey (2011–2018).
  https://marked.js.org

- **math.js (mathjs)** v12.4.3 — matematické výpočty, načítáno z CDN (jsdelivr)
  Licence: Apache-2.0. © Jos de Jong. https://mathjs.org

## Fonty

- **Sora** (self-hostováno jako base64 přímo ve `style.css`, řezy 400/500/600/700,
  sada latin-ext kvůli české diakritice)
  Licence: SIL Open Font License 1.1 (OFL-1.1).
  © 2019 The Sora Project Authors (https://github.com/sora-xor/sora-font)

- **Fira Code** (self-hostováno jako base64 přímo ve `style.css`, řezy 400/500,
  sada latin-ext)
  Licence: SIL Open Font License 1.1 (OFL-1.1).
  © 2014–2020 The Fira Code Project Authors (https://github.com/tonsky/FiraCode)

  OFL vyžaduje, aby licenční text/copyright doprovázel font i po vložení do
  jiného software — proto je krátká poznámka i přímo v komentáři nad vloženými
  `@font-face` pravidly ve `style.css`, a plné znění OFL-1.1 je k dispozici na
  http://scripts.sil.org/OFL (shrnutí: font lze volně používat, upravovat a
  šířit i v komerčních produktech zdarma; nesmí se ale prodávat samostatně a
  upravená verze se musí přejmenovat — appka fonty nijak needituje, jen je
  vkládá beze změny).

## Shrnutí pro veřejné nasazení

Žádná z výše uvedených licencí appce nebrání v tom, aby byla veřejně dostupná
na webu (statický hosting typu GitHub Pages), zdarma i pro výuku. MIT a
Apache-2.0 vyžadují jen zachování copyright poznámky ve zdrojovém kódu
knihovny samotné (což vendorované soubory splňují), OFL-1.1 vyžaduje totéž
u fontů (splněno tímto souborem + poznámkou ve `style.css`).
