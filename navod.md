<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='64' height='64'>
  <rect width='32' height='32' rx='7' fill='#c83030'/>
  <polyline points='4,26 10,18 16,20 22,10 28,6' fill='none' stroke='white' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'/>
  <circle cx='10' cy='18' r='2' fill='white'/>
  <circle cx='16' cy='20' r='2' fill='white'/>
  <circle cx='22' cy='10' r='2' fill='white'/>
  <line x1='4' x2='28' y1='28' y2='28' stroke='white' stroke-width='1.5' opacity='0.4'/>
  <line x1='4' x2='4' y1='4' y2='28' stroke='white' stroke-width='1.5' opacity='0.4'/>
</svg>

# Regresní analýza

## Vložení dat

Data lze do tabulky zadat ručně kliknutím do příslušného políčka tabulky a napsáním/vložením čísla. Aplikace považuje za desetinnou čárku znaky `,` a `.`. Stisknutím klávesy `Enter` dojde automaticky k přeskočení do dalšího políčka tabulky. Tímto způsobem je možné bez použití myši postupně zadávat dvojice $(x_1, y_1), (x_2, y_2), \ldots$

Aplikace umožňuje kromě ručního zadávání také nahrát data ve formátech `.txt`, `.csv`, `.tsv` a `.dat` kliknutím na tlačítko `načíst soubor`. Autodetekce oddělovače sloupců rozpoznává `,` (čárku), `;` (středník), tabulátor a mezeru. Aplikace má ve výchozím stavu osy pojmenované jako $x$ a $y$ (políčka nad tabulkou). Pokud nahraný soubor obsahuje záhlaví (první řádek s názvy sloupců), aplikace ho automaticky rozpozná a použije jako názvy os. V obou případech je možné názvy libovolně přepsat.

Sloupce tabulky je možné prohodit tlačítkem `prohodit x ↔ y`, tím dojde k prohození os $(x_1 \leftrightarrow y_1,\ x_2 \leftrightarrow y_2,\ \ldots)$. Tlačítkem `uložit data` dojde k uložení dat tabulky ve formátu `.txt` a tlačítkem `smazat data` k jejich odstranění. Jsou-li v tabulce data a uživatel vloží tlačítkem `načíst soubor` nová data, dojde k přepsání starých.

## Vyhodnocení dat

Symbolem ✅ jsou označeny ty řádky tabulky, na kterých se provádí regresní analýza. Při spuštění aplikace jsou takto označeny všechny řádky, přičemž je možné klikem myši na tento symbol libovolné řádky z účasti v regresi vyloučit. Stejným symbolem v záhlaví tabulky je možné najednou odznačit a zpětně označit všechny řádky najednou, případně zrušit provedení výběru bodů. Dále je možné provést výběr bodů pro regresi pomocí tlačítka `výběr oblasti`. V takovém případě dojde automaticky ke zrušení označení všech bodů tabulky. Označení bodů se zde provede podržením levého tlačítka myši a současným tažením přes zvolené body. Tyto body se po provedení označení označí zpět v tabulce. Označené body jsou v grafu zobrazeny plným kruhem a neoznačené body kružnicí.

Kliknutím na tlačítko `typ regrese` se zobrazí rozbalovací nabídka, ve které je možné vybrat tvar fitované funkce. Po výběru se její obecný předpis vypíše v poli dole pod grafem. Zapnutí a vypnutí zobrazení fitované funkce v grafu se provede tlačítkem `spustit analýzu`. V pravém sloupci se zobrazí parametry fitování a v oblasti dole pod grafem se pod obecným předpisem fitované funkce zobrazí stejná s konkrétními parametry. Tlačítko `interval spolehlivosti` v grafu zobrazí 95% oblast spolehlivosti. Tlačítkem `uložit PNG` dojde k uložení grafu ve formátu PNG.

Nad grafem se zobrazuje legenda, ve které mohou být celkem 3 pojmy: `Data` označují body, na kterých je prováděna regrese, `fit` je nafitovaná funkce a `Vyloučeno (X)` jsou body vyloučené z regrese včetně jejich počtu v závorce.  Kliknutím na libovolný údaj dojde ke zrušení zobrazování příslušných dat v grafu. Rozsahy os se nastavují automaticky, ale je možné je nastavit manuálně prostřednictvím políček `x min`, `x max`, `y min` a `y max`. Kliknutím na tlačítko `reset os` dojde k opětovnému přepnutí na automatické nastavení.


