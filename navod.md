# Regresní analýza

## Vložení dat

Data lze do tabulky zadat ručně kliknutím do příslušného políčka tabulky a napsáním/vložením čísla. Aplikace považuje za desetinnou čárku znaky `,` a `.`. Stisknutím klávesy `Enter` dojde automaticky k přeskočení do dalšího políčka tabulky. Tímto způsobem je možné bez použití myši postupně zadávat dvojice $(x_1, y_1), (x_2, y_2), \ldots$

Aplikace umožňuje kromě ručního zadávání také nahrát data ve formátech `.txt`, `.csv`, `.tsv` a `.dat` kliknutím na tlačítko `načíst soubor`. Autodetekce oddělovače sloupců rozpoznává `,` (čárku), `;` (středník), tabulátor a mezeru. Aplikace má ve výchozím stavu osy pojmenované jako $x$ a $y$ (políčka nad tabulkou). Pokud nahraný soubor obsahuje záhlaví (první řádek s názvy sloupců), aplikace ho automaticky rozpozná a použije jako názvy os. V obou případech je možné názvy libovolně přepsat.

Sloupce tabulky je možné prohodit tlačítkem `prohodit x ↔ y`, tím dojde k prohození os $(x_1 \leftrightarrow y_1,\ x_2 \leftrightarrow y_2,\ \ldots)$. Tlačítkem `uložit data` dojde k uložení dat tabulky ve formátu `.txt` a tlačítkem `smazat data` k jejich odstranění. Jsou-li v tabulce data a uživatel vloží tlačítkem `načíst soubor` nová data, dojde k přepsání starých.

## Vyhodnocení dat

Symbolem ✅ jsou označeny ty řádky tabulky, na kterých se provádí regresní analýza. Při spuštění aplikace jsou takto označeny všechny řádky, přičemž je možné klikem myši na tento symbol libovolné řádky z účasti v regresi vyloučit. Stejným symbolem v záhlaví tabulky je možné najednou odznačit a zpětně označit všechny řádky najednou, případně zrušit provedení výběru bodů. Dále je možné provést výběr bodů pro regresi pomocí tlačítka `výběr oblasti`. V takovém případě dojde automaticky ke zrušení označení všech bodů tabulky. Označení bodů se zde provede podržením levého tlačítka myši a současným tažením přes zvolené body. Tyto body se po provedení označení označí zpět v tabulce.
