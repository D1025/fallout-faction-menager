# Kryteria akceptacji dla redesignu UI (Etapy 1–4)

Ten dokument definiuje **konkretne, wspólne progi akceptacji** dla etapów 1–4.
Każdy ticket etapu powinien odwoływać się do odpowiedniej sekcji poniżej.

## Wspólne kryteria (obowiązują w Etapach 1–4)

1. **Kontrast (WCAG AA):**
   - Tekst i komponenty interaktywne muszą spełniać minimum **WCAG 2.1 AA**.
   - Dla tekstu normalnego: co najmniej **4.5:1**.
   - Dla dużego tekstu (>= 18 pt lub >= 14 pt bold): co najmniej **3:1**.
   - Dla kontrolek i elementów nietekstowych (obramowania, ikony, stany focus/active): co najmniej **3:1** względem tła.

2. **Responsywność (obowiązkowe breakpointy):**
   - UI musi być zweryfikowane i wspierane przynajmniej dla szerokości:
     - **360 px**,
     - **390 px**,
     - **768 px**,
     - **1024 px i więcej**.
   - Dla każdego breakpointu wymagane są poprawne: układ, nawigacja, filtry, stany pustych list i formularze.

3. **Spójność filtrów (jedno API komponentów):**
   - Wszystkie listy (home, factions, admin i pozostałe objęte etapem) korzystają z **jednego API komponentów filtrujących**.
   - Minimalny wspólny zestaw komponentów: `FilterBar`, `FilterChips`, `SortSelect`, `QuickToggle`.
   - Nazewnictwo propsów i kontrakty zdarzeń (zmiana filtra/sortu/reset) muszą być jednolite między widokami.

4. **Regresje funkcjonalne (API + CRUD):**
   - Brak zmian w **payloadach API** (kształt request/response) względem stanu bazowego etapu.
   - Brak zmian w zachowaniu CRUD (create/read/update/delete), poza świadomie zaakceptowanymi zmianami opisanymi w ticketach.
   - Wszelkie odstępstwa muszą być jawnie opisane i zatwierdzone przed merge.

## Linkowanie z ticketów

W opisie ticketu dla danego etapu dodaj link do odpowiedniej sekcji:

- Etap 1 → [`docs/ui-redesign-plan.md#etap-1`](#etap-1)
- Etap 2 → [`docs/ui-redesign-plan.md#etap-2`](#etap-2)
- Etap 3 → [`docs/ui-redesign-plan.md#etap-3`](#etap-3)
- Etap 4 → [`docs/ui-redesign-plan.md#etap-4`](#etap-4)

## Etap 1

Etap 1 przyjmuje kryteria wspólne 1–4 bez wyjątków.

## Etap 2

Etap 2 przyjmuje kryteria wspólne 1–4 bez wyjątków.

## Etap 3

Etap 3 przyjmuje kryteria wspólne 1–4 bez wyjątków.

## Etap 4

Etap 4 przyjmuje kryteria wspólne 1–4 bez wyjątków.
