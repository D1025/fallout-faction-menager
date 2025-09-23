import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Frakcje – upsert po ID lub name
    const factions = [
        {
            id: 'f_survivors',
            name: 'Survivors',
            limits: [
                { tag: 'Champion', tier1: 1, tier2: 3, tier3: 5 },
                { tag: 'Facility', tier1: 0, tier2: 1, tier3: 2 },
            ],
        },
        {
            id: 'f_bos',
            name: 'Brotherhood of Steel',
            limits: [
                { tag: 'Champion', tier1: 1, tier2: 2, tier3: 3 },
                { tag: 'Scribe', tier1: 1, tier2: 2, tier3: 3 },
            ],
        },
        {
            id: 'f_raiders',
            name: 'Raiders',
            limits: [{ tag: 'Champion', tier1: 0, tier2: 1, tier3: 2 }],
        },
    ];

    for (const f of factions) {
        const up = await prisma.faction.upsert({
            where: { id: f.id },
            update: { name: f.name },
            create: { id: f.id, name: f.name },
        });
        // odśwież limity (prosto i pewnie)
        await prisma.factionLimit.deleteMany({ where: { factionId: up.id } });
        if (f.limits.length) {
            await prisma.factionLimit.createMany({
                data: f.limits.map((l) => ({
                    factionId: up.id,
                    tag: l.tag,
                    tier1: l.tier1 ?? null,
                    tier2: l.tier2 ?? null,
                    tier3: l.tier3 ?? null,
                })),
            });
        }
    }

    // Domyślny admin (opcjonalnie)
    await prisma.user.upsert({
        where: { name: 'Admin' },
        update: { role: 'ADMIN' },
        create: { name: 'Admin', role: 'ADMIN' },
    });
}

main()
    .then(() => console.log('Seed OK'))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
