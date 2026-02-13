This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Plan wdrożenia UI (etapy)

### Etap 1: motyw + kontrast + komponenty bazowe filtrów
- [ ] Ujednolicenie tokenów motywu (kolory, tło, obramowania, stany hover/focus).
- [ ] Poprawa kontrastu elementów tekstowych i kontrolek w trybie dark mode.
- [ ] Dostarczenie bazowych komponentów filtrów (np. `FilterBar`, `FilterChips`, `SortSelect`, `QuickToggle`) do wielokrotnego użycia.

**Checklista akceptacyjna (Etap 1)**
- [ ] Kryteria zgodne z [`docs/ui-redesign-plan.md#etap-1`](docs/ui-redesign-plan.md#etap-1).

### Etap 2: ekran główny i kluczowe ekrany armii (dashboard/roster/unit/resources)
- [ ] Przeniesienie nowego motywu i bazowych filtrów na ekran główny.
- [ ] Spójne wdrożenie wzorców UI na widokach armii: dashboard, roster, unit, resources.
- [ ] Ujednolicenie nawigacji, sekcji kart i stanów ładowania/pustych widoków.

**Checklista akceptacyjna (Etap 2)**
- [ ] Kryteria zgodne z [`docs/ui-redesign-plan.md#etap-2`](docs/ui-redesign-plan.md#etap-2).

### Etap 3: logowanie + frakcje
- [ ] Dostosowanie ekranu logowania do nowego systemu motywu i kontrastu.
- [ ] Ujednolicenie ekranów/list frakcji (filtry, typografia, komponenty sekcji).
- [ ] Sprawdzenie zgodności walidacji i komunikatów błędów ze standardem UI.

**Checklista akceptacyjna (Etap 3)**
- [ ] Kryteria zgodne z [`docs/ui-redesign-plan.md#etap-3`](docs/ui-redesign-plan.md#etap-3).

### Etap 4: cały panel admin
- [ ] Ujednolicenie wszystkich ekranów panelu admin pod kątem motywu, kontrastu i komponentów.
- [ ] Standaryzacja formularzy, tabel/list oraz akcji CRUD.
- [ ] Domknięcie spójności UX pomiędzy sekcjami: factions, subfactions, perks, templates, weapons, effects.

**Checklista akceptacyjna (Etap 4)**
- [ ] Kryteria zgodne z [`docs/ui-redesign-plan.md#etap-4`](docs/ui-redesign-plan.md#etap-4).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
