![logo](https://raw.githubusercontent.com/simons-implant/regrese/main/logo.svg)

# Regresní analýza

## Vložení dat

Data lze do tabulky zadat ručně kliknutím do příslušného políčka tabulky a napsáním/vložením čísla. Aplikace považuje za desetinnou čárku znaky `,` a `.`. Stisknutím klávesy `Enter` dojde automaticky k přeskočení do dalšího políčka tabulky. Tímto způsobem je možné bez použití myši postupně zadávat dvojice $(x_1, y_1), (x_2, y_2), \ldots$

Aplikace umožňuje kromě ručního zadávání také nahrát data ve formátech `.txt`, `.csv`, `.tsv` a `.dat` kliknutím na tlačítko 📂`načíst soubor`. Autodetekce oddělovače sloupců rozpoznává `,` (čárku), `;` (středník), tabulátor a mezeru. Aplikace má ve výchozím stavu osy pojmenované jako $x$ a $y$ (políčka nad tabulkou). Pokud nahraný soubor obsahuje záhlaví (první řádek s názvy sloupců), aplikace ho automaticky rozpozná a použije jako názvy os. V obou případech je možné názvy libovolně přepsat. Od verze `1.11` obsahuje aplikace také možnost 📂`načíst pokročilé`. V tomto případě je možné vkládat data jak po sloupcích, tak i po řádcích, a to i v případě, kdy soubor obsahuje více než 2 řádky/sloupce. Toto tlačítko tedy otevře jednoduchého průvodce, kde je nutné zakliknout, jestli jsou data ve formátu řádků nebo sloupců a poté klikem na záhlaví příslušného řádku/sloupce vybrat který bude brán jako $x$ a který jako $y$.

Sloupce tabulky je možné prohodit tlačítkem 🔄`prohodit x ↔ y`, tím dojde k prohození os $(x_1 \leftrightarrow y_1,\ x_2 \leftrightarrow y_2,\ \ldots)$. Tlačítkem 💾`uložit data` dojde k uložení dat tabulky ve formátu `.txt` a tlačítkem 🗑️`smazat data` k jejich odstranění. Jsou-li v tabulce data a uživatel vloží nová, dojde k přepsání starých dat.

## Vyhodnocení dat

Symbolem ✅ jsou označeny ty řádky tabulky, na kterých se provádí regresní analýza. Při spuštění aplikace jsou takto označeny všechny řádky, přičemž je možné klikem myši na tento symbol libovolné řádky z účasti v regresi vyloučit. Stejným symbolem v záhlaví tabulky je možné najednou odznačit a zpětně označit všechny řádky najednou, případně zrušit provedení výběru bodů. Dále je možné provést výběr bodů pro regresi pomocí tlačítka ▣`výběr oblasti`. V takovém případě dojde automaticky ke zrušení označení všech bodů tabulky. Označení bodů se zde provede podržením levého tlačítka myši a současným tažením přes zvolené body. Tyto body se po provedení označení označí zpět v tabulce. Označené body jsou v grafu zobrazeny plným kruhem a neoznačené body kružnicí.

Kliknutím na tlačítko 📈`typ regrese` se zobrazí rozbalovací nabídka, ve které je možné vybrat tvar fitované funkce. Po výběru se její obecný předpis vypíše v poli dole pod grafem. Zapnutí a vypnutí zobrazení fitované funkce v grafu se provede tlačítkem ▶️`spustit analýzu`. V pravém sloupci se zobrazí parametry fitování a v oblasti dole pod grafem se pod obecným předpisem fitované funkce zobrazí stejná s konkrétními parametry. Tlačítko **95%**`interval spolehlivosti` v grafu zobrazí 95% interval spolehlivosti. Tlačítkem 💾`uložit PNG` dojde k uložení grafu ve formátu PNG.

Nad grafem se zobrazuje legenda, ve které mohou být celkem 4 pojmy: `Data` označují body, na kterých je prováděna regrese, `fit` je nafitovaná funkce, `Vyloučeno (X)` jsou body vyloučené z regrese včetně jejich počtu v závorce a `IS 95 %` je 95% interval spolehlivosti. Kliknutím na libovolný údaj dojde ke zrušení zobrazování příslušných dat v grafu. Rozsahy os se nastavují automaticky, ale je možné je nastavit manuálně prostřednictvím políček `x min`, `x max`, `y min` a `y max`. Kliknutím na tlačítko ⟳`reset os` dojde k opětovnému přepnutí na automatické nastavení.


