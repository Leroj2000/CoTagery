# ADR 0011: Integrita provozního workflow věcí

- Stav: přijaté
- Datum: 2026-09-06

## Kontext

Stav věci je projekce pohybového ledgeru. Výdej, vrácení, servis, vyřazení a rezervace proto nesmějí stav měnit mimo jednu řízenou cestu. Dvě souběžné operace nad stejnou věcí navíc nesmějí obě vycházet ze stejného původního stavu.

## Rozhodnutí

- Každý pohyb zamkne řádek věci pomocí `SELECT … FOR UPDATE`, znovu načte aktuální stav a teprve potom ověří přechod.
- Hromadný pohyb nejprve ověří všechny položky. Jakmile při zápisu některá operace selže, transakce celého HTTP požadavku se vrátí zpět.
- Rezervace nemění stav věci na `reserved`. Je to časový závazek oddělený od aktuálního fyzického stavu. Schválení zamyká věc a odmítne překryv s jinou schválenou rezervací.
- Výdej může odkazovat na schválenou rezervaci pouze jejímu žadateli a v jejím intervalu. Úspěšný výdej ji označí jako `fulfilled`.
- Potvrzení převzetí smí provést jen uživatel propojený s osobou příjemce přes `user_id` nebo stejný normalizovaný e-mail.
- Vyřazení je koncový pohyb `dispose`: věc dostane stav `retired`, digitální objekt se archivuje a aktivní identifikátory se označí jako `destroyed`. Inventární číslo zůstává historicky rezervované.
- Neprázdné inventární číslo je unikátní v rámci tenantu bez ohledu na velikost písmen.

## Důsledky

Ledger zůstává zdrojem pravdy pro fyzický stav a souběžné požadavky se serializují po jednotlivých věcech. Rezervace lze plánovat dopředu bez blokování běžného zobrazení stavu, ale každý obecný výdej musí kontrolovat kolizi se schváleným intervalem. Vyřazený veřejný identifikátor už nesmí zpřístupnit původní objekt.

