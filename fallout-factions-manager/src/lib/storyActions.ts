export type StoryActionCategory = 'Story Action' | 'Captive Story Action';

export type StoryActionEntry = {
    id: string;
    title: string;
    category: StoryActionCategory;
    faction?: string;
    rules: string;
};

export const STORY_ACTIONS_INTRO = `This section lists the Story Actions available to a crew during each Story Phase.
Unless a rule specifically states otherwise, a crew can make the same Story Action more than once in a Story Phase.`;

export const CAPTIVE_STORY_ACTIONS_INTRO = `Captive Story Actions are faction-specific and interact with captives taken during a campaign.
During crew creation, record your faction's Captive Story Action on your Story Sheet as a reminder.`;

export const STORY_ACTIONS: StoryActionEntry[] = [
    {
        id: 'barter',
        title: 'Barter',
        category: 'Story Action',
        rules: `The crew spends time trading with locals, or at least taking their Caps.

Choose a model in your crew to make a Barter Test (3C). When building the Dice Pool for this test, gain a number of Bonus Dice equal to the crew's Reach.
If the crew has 6 or more Reach, they then lose 1 Reach.
After rolling, add 3 Caps per Hit to the crew's Stash.

Crews with a Trader Outpost Facility may increase the Caps earned per Hit from 3 to 4.`,
    },
    {
        id: 'craft-chems',
        title: 'Craft Chems',
        category: 'Story Action',
        rules: `The crew makes use of labs to brew potent Chems.
To make this Story Action, the crew must have a Chem Lab Facility.

Choose a model in your crew to make a Chemistry Test (4I).
For each Hit on a Standard Die, add a dose of any Common Chem to this crew's Roster.
For each Hit on a Lucky Die, add a dose of a random Rare Chem to this crew's Roster.`,
    },
    {
        id: 'crew-training',
        title: 'Crew Training',
        category: 'Story Action',
        rules: `The crew works hard to put what it's learned to use.

Choose any number of non-Absent models that took part in the last game to purchase an Upgrade for.
Each model may only be selected once.
You cannot purchase Upgrades for a model if the number of their Existing Upgrades matches your crew's Upgrade Limits.

Each Upgrade purchased has an XP cost, determined by the number of existing upgrades and model class:

| Existing Upgrades | Champion XP Cost | Grunt XP Cost |
| --- | --- | --- |
| 0 | 3 | 2 |
| 1-2 | 4 | 3 |
| 3-4 | 5 | 4 |
| 5 | 6 | 5 |
| 6+ | 7 | 6 |

After spending XP, roll two dice on your crew's Training Table (from its Faction Entry) and choose one result to resolve, increasing the model's Rating as required.

Crews with the Comfortable Quarters Facility may re-roll either or both dice on the Training Table.
If a crew with Comfortable Quarters rolls matching numbers on the Training Table, they gain 1 XP after resolving this Story Action.

Statistic Limits:
- Strength, Perception, Endurance, Charisma, Intelligence, and Agility cannot be raised above 9.
- Luck cannot be raised above 5.
- Health can only be upgraded once.
- If a statistic is rolled when already at max value, that die can be re-rolled.

Gaining Perks:
- A model gains a Perk when receiving its 2nd, 4th, 6th, or 8th Upgrade.
- Choose a Perk from the Perk list (pgs. 104-109) and add it to that model's Crew Roster entry.
- Innate Perks cannot be gained this way.
- If the chosen Perk is from the same S.P.E.C.I.A.L. category as the newly gained Upgrade, the crew also gains 1 XP.
- Models must meet the Perk's requisite S.P.E.C.I.A.L. value (for example: "Strength 4").
- Serious Injuries are ignored when checking requisites.`,
    },
    {
        id: 'expand',
        title: 'Expand',
        category: 'Story Action',
        rules: `The crew works to expand their territory and build up new facilities.

Spend 2 Reach, then roll one die on the Facility Table (pg. 30).
Before rolling, you may spend any number of Scouting Points. Roll one additional die for each Scouting Point spent.

Consult the Facility Table and add one rolled Facility to your crew's Home Turf on the Story Sheet.
You may not add a Facility you already own, and you may re-roll any die that matches an owned Facility.

No crew may have more Facilities on their Home Turf than their Facility Limit.`,
    },
    {
        id: 'migrate',
        title: 'Migrate',
        category: 'Story Action',
        rules: `The crew packs its bags, attempting to find more fruitful lands.

When performed, your crew becomes Nomadic (see pg. 54), then rolls five dice and adds Caps to their Stash equal to the combined total.`,
    },
    {
        id: 'modify-weapons',
        title: 'Modify Weapons',
        category: 'Story Action',
        rules: `The crew spends time tinkering in the workshop.

Choose one or more unmodified weapons carried by models in your crew to modify.
Available modifications are listed in Weapon Modifications (pgs. 95-101).
Each modification changes Type, Test, Traits, or Critical Effect and costs Parts from the crew's Stash.
Each modification also increases the carrying model's Rating by the listed amount.

After spending Parts, increase the model's Rating accordingly and update the weapon profile.

Crews with a Factory Facility may modify any weapon carried by models in their crew, even already modified weapons.
A weapon cannot be modified more than once per single Modify Weapons Story Action, but can have as many different modifications as available for that weapon.`,
    },
    {
        id: 'open-vault',
        title: 'Open Vault',
        category: 'Story Action',
        rules: `The crew attempts to open the Vault in their territory.
To make this Story Action, the crew must have an Unopened Vault Facility.

Choose one model in the crew to make a Decode Test (2I).
If Passed, you may roll on the Vault Table (pg. 54), then remove this Facility from your Home Turf.
If Failed, you may attempt this Story Action again in the future.

If this Story Action is resolved and Passed by the Attacker of an Occupy Objective (pg. 46), remove this Facility from the Defender's Home Turf.`,
    },
    {
        id: 'recruit',
        title: 'Recruit',
        category: 'Story Action',
        rules: `The crew puts out word that they're looking for new members.

If a crew has total Reputation below 200, this Action does not count toward the number of Story Actions they may take in the Story Phase.

When taken, you may purchase new models from your faction's Faction List.
Select a Model Class and Weapon Set, then spend Caps from your crew Stash equal to the selected Weapon Set's Rating.
You may purchase multiple models in the same Recruit Story Action, following Recruit Models rules (pg. 32).

Crew Limits still apply:
- Respect listed Champion limits.
- Maximum five Grunts per Champion.

Crews with a Food Store may roll on the Nourishment Table when adding a new model:

| Score | Nourishment Effect | Result |
| --- | --- | --- |
| 1 | Skin and Bones | The recruit is malnourished. Roll on the Serious Injuries Table for this model, re-rolling Dead. Afterwards, you may spend 5 Caps to upgrade this model as in Crew Training. No XP is spent for this Upgrade. |
| 2-8 | Standard Recruit | The recruit joins and contributes for a decent meal. Roll a die and add that many Caps to the crew Stash. |
| 9-10 | Potential | You may upgrade this model as in Crew Training. No XP is spent for this Upgrade. |`,
    },
    {
        id: 'recuperate',
        title: 'Recuperate',
        category: 'Story Action',
        rules: `The crew spends time patching wounds and resting.

Choose a model on your Crew Roster with a Serious Injury and make a Recuperate Test (2E).
If Passed, select one Penalized statistic and remove that penalty.
This process may be repeated for any number of models, but only once per model.

Crews with an Infirmary add one Bonus Die to all Recuperate Tests and may remove one Penalized statistic per Hit, rather than just one.`,
    },
    {
        id: 'scout',
        title: 'Scout',
        category: 'Story Action',
        rules: `A crew member heads out to scout a location.

Choose a model on your Crew Roster to go scouting and make a Scout Test (2P).
For each Hit, gain 2 Scouting Points.
If Failed, the scout is waylaid and marked as Absent.

Crews with a Lookout add 4 Bonus Dice to the Scout Test Dice Pool.`,
    },
    {
        id: 'settle',
        title: 'Settle',
        category: 'Story Action',
        rules: `The crew looks for somewhere to call home.
To make this Story Action, a crew must be Nomadic and meet one of these requirements:
- Their last game was in the Wasteland and they did not Retreat.
- Their last game had the Raid Objective and the opposing crew became Nomads.

The crew settles the Location, making it their Home Turf:
- It gains the Hazard from the last game.
- It gains a Facility based on the triggering requirement.

If last game was in the Wasteland:
- Roll a die and consult the Facility Table (pg. 30).
- You may spend any number of Scouting Points before rolling, adding one die per Scouting Point.
- If you roll multiple dice, you may resolve any one result.

If last game had Raid Objective and the opposing crew became Nomads:
- Add all Facilities from the opposing crew's Story Sheet to your own.`,
    },
    {
        id: 'surface',
        title: 'Surface',
        category: 'Story Action',
        rules: `The crew emerges from the safety of their tunnels.
To make this Action, the crew must have the Tunnels Facility and be Underground.

Spend 2 Reach. The crew is no longer Underground and can remove Underground from their Story Sheet.`,
    },
    {
        id: 'negotiate-release',
        title: 'Negotiate Release',
        category: 'Story Action',
        rules: `The crew attempts to bargain for the return of a captive.
To make this Action, a model in your crew must be a Captive of another crew.

Choose an Absent model in your crew that is currently captive and negotiate terms with the captor.
Possible terms include:
- Caps
- Rare Chems
- Parts
- Temporary use of Facilities

If terms are agreed, roll on the Handover Table.
If terms are not agreed, gain 2 XP and the capturing crew must perform their Captive Story Action without spending one of their Story Actions.

| Score | Handover Effect | Result |
| --- | --- | --- |
| 1 | Catastrophe | The handover goes wrong and the captive dies. Remove the chosen model from your Crew Roster; they are Dead. |
| 2-9 | Deal | Remove agreed payment from your Crew Roster. Clear the Absent box on the captive model. The model can participate in future games. The captor adds the payment to their Crew Roster. |
| 10 | Escape! | The captive escapes during handover. Clear the Absent box on the model. You keep the agreed payment; the captor gets nothing. |`,
    },
    {
        id: 'set-bounty',
        title: 'Set Bounty',
        category: 'Story Action',
        rules: `The crew seeks revenge.

Choose a model in a rival crew and spend any amount of Reach.
Post the model's name and crew in a campaign-visible space.
That model gains a Bounty worth Reach spent x 5 Caps.

When a model with a Bounty is Incapacitated by any crew other than yours and rolls on the Aftermath Table, they roll two dice and must choose the worse result.
If the model dies from this, the crew that caused the incapacitation adds the Bounty to their Crew Stash.

If the model is taken Captive by another crew, that crew may claim the Bounty when making the Captive Story Action instead of the usual effect.
If claimed, that crew adds the Bounty to their Crew Stash and the model is removed from its owner's Crew Roster.

A model may have multiple Bounties, increasing the total potential payout.`,
    },
    {
        id: 'judge-captive',
        title: 'Judge Captive',
        category: 'Captive Story Action',
        faction: 'Brotherhood of Steel',
        rules: `Law demands vigilance. This crew sees itself as the final arbiter of justice in the Wasteland.

Choose a Captive model on your Story Sheet from another player's Crew Roster, then roll a die and consult the Verdict Table.
This Action cannot be made if the captive was taken in your last game.

| Score | Verdict | Effect |
| --- | --- | --- |
| 1-2 | Innocent | The captive is released and returns to its original crew. The owner clears the Absent box. |
| 3-5 | Trial | Gain 3 XP. The captive makes a Persuasion Test (1C) or Logic Test (1I). If Passed, the captive is freed and owner clears Absent. If Failed, the captive is executed and removed from owner's Crew Roster. |
| 6-10 | Guilty | The captive is judged guilty and executed. You gain 2 XP. Remove the captive from its owner's Crew Roster. |`,
    },
    {
        id: 'devour-captive',
        title: 'Devour Captive',
        category: 'Captive Story Action',
        faction: 'Super Mutants',
        rules: `This crew kills, devours, and destroys captives, spreading fear throughout the Wasteland.

Choose a Captive model on your Story Sheet from another player's Crew Roster, then roll a die on the Devour Captives Table.
This Action cannot be made if the captive was taken in your last game.

| Score | Result | Effect |
| --- | --- | --- |
| 1 | Escape! | The captive escapes and returns to its original crew. The owner clears the Absent box. |
| 2-8 | Devour | The captive is devoured and removed from its owner's Crew Roster. Each non-Absent model in your crew may remove the penalty from one penalized statistic (as in Recuperate). |
| 9-10 | Feeding Frenzy | The captive is devoured. Choose one non-Absent model in your crew; you may upgrade it as in Crew Training without spending XP. |`,
    },
    {
        id: 'redeem-captive',
        title: 'Redeem Captive',
        category: 'Captive Story Action',
        faction: 'Survivors',
        rules: `This crew gives folks a second chance.

Choose a Captive model on your Story Sheet from another player's Crew Roster, then roll on the Redeem Table.
This Action cannot be made if the captive was taken in your last game.

| Score | Redeem Effect | Result |
| --- | --- | --- |
| 1 | Escape! | The captive escapes and returns to original crew. Owner clears Absent. |
| 2-5 | Theft | The captive escapes with supplies. Roll a die and remove that many Caps from your Crew Stash. The owner removes the model from their Crew Roster. |
| 6 | Rehabilitation | Your Leader makes a Recruit Test (4C). If you roll 4 Hits, resolve New Crew Member. |
| 7 | Rehabilitation | Your Leader makes a Recruit Test (4C). If you roll 3 Hits, resolve New Crew Member. |
| 8 | Rehabilitation | Your Leader makes a Recruit Test (4C). If you roll 2 Hits, resolve New Crew Member. |
| 9 | Rehabilitation | Your Leader makes a Recruit Test (4C). If you roll 1 Hit, resolve New Crew Member. |
| 10 | New Crew Member | Copy the model's statistics and Traits to your Crew Roster, then remove it from original owner's Roster. The model gains Outsider and loses Natural Leader (if it had it). |`,
    },
    {
        id: 'sell-captive',
        title: 'Sell Captive',
        category: 'Captive Story Action',
        faction: 'Wasteland Raiders',
        rules: `Prisoners rarely last long in captivity.

Choose a Captive model on your Story Sheet from another player's Crew Roster, then roll on the Sell Captive Table.
This Action cannot be made if the captive was taken in your last game.

| Score | Result | Effect |
| --- | --- | --- |
| 1-2 | Escape! | The captive escapes and returns to its original crew. Owner clears Absent. |
| 3-4 | Fight Pits | The captive is sold to fighting pits. Roll a die and add that many Caps to your Crew Stash. Remove captive from owner's Crew Roster. |
| 5-7 | Scrap Mines | The captive is sold to steelyards. Roll a die and add that many Parts to your Crew Stash. Remove captive from owner's Crew Roster. |
| 8-9 | Two Enter, One Leaves | The captive is removed from owner's Crew Roster and your crew gains 3 XP. |
| 10 | We Have... a Winner?! | Randomly choose one model in your crew. They are killed and removed. Copy captive's statistics and Traits to your Crew Roster, then remove captive from original owner. If your lost model had Natural Leader, this model gains it; otherwise gains Outsider. |`,
    },
    {
        id: 'taken-for-a-ride',
        title: 'Taken for a Ride',
        category: 'Captive Story Action',
        faction: 'Pack, Operators, Disciples',
        rules: `This crew uses captives as entertainment in the Gauntlet.

Choose a Captive model from another player's Crew Roster on your Story Sheet, then roll a d10 on the Gauntlet Table.
This Action cannot be made if the captive was taken in your last game.

| Score | Result | Effect |
| --- | --- | --- |
| 1 | "What?! This isn't meant to happen! The vic got away!" | The captive escapes and returns to original crew. Owner clears Absent. |
| 2-5 | "And... they're dead! Next!" | The captive dies in the Gauntlet and is removed from owner's Crew Roster. Each non-Absent model in your crew may remove the penalty from one penalized statistic (as in Recuperate). |
| 6-8 | "The vic made it to the boss and... well, that was grim." | The captive reaches the end of the Gauntlet but dies. Remove captive from owner's Crew Roster and gain 3 XP. |
| 9-10 | "Now there is something you don't see often..." | Randomly choose a Champion in your crew. They roll twice on the Serious Injury Table (re-rolling Dead). Copy captive's statistics and Traits to your Crew Roster, remove from original owner, and apply Outsider / remove Natural Leader. |`,
    },
    {
        id: 'detain-captive',
        title: 'Detain Captive',
        category: 'Captive Story Action',
        faction: 'Gunners',
        rules: `This crew had their eyes on this captive and there was a price on their head.

Choose a Captive model from another player's Crew Roster on your Story Sheet, then roll on the Detain Captives Table.
This Action cannot be made if the captive was taken in your last game.

| Score | Result | Effect |
| --- | --- | --- |
| 1 | Escape! | The captive breaks free and returns to original crew. Owner clears Absent. |
| 2 | You Don't Mess With the Gunners! | The captive escapes and owner clears Absent. You may take Set Bounty for free, but only for this model. |
| 3-6 | The Target, as Promised. | Discuss with other campaign players (excluding captive's owner) who takes the captive. Agree terms using Negotiate Release suggestions. Clear Captive box on your roster and another player records the captive. If nobody takes them, resolve Contract Fulfilled. |
| 7-10 | Contract Fulfilled | The captive is removed from owner's Crew Roster. Add Caps equal to half (rounded down) of that model's Rating to your Stash. |`,
    },
    {
        id: 'sacrifice-captive',
        title: 'Sacrifice Captive',
        category: 'Captive Story Action',
        faction: 'Followers of the Winged One',
        rules: `This crew offers captives as tribute to the Holy Mothman.

Choose a Captive model from another player's Crew Roster on your Story Sheet, then roll on the Sacrifice Captives Table.
This Action cannot be made if the captive was taken in your last game.

| Score | Result | Effect |
| --- | --- | --- |
| 1 | Escape! | The captive escapes and returns to original crew. Owner clears Absent. |
| 2-6 | Blessed | The captive is removed from owner's Crew Roster. Choose one: gain 3 XP, remove all penalized statistics from a friendly Holy Mothman, gain a Rare Chem of your choice, or gain 2 Scouting Points. |
| 7-10 | Bountiful Blessings | The captive is removed from owner's Crew Roster. Choose two options from Blessed, or add a Holy Mothman for free to your Crew Roster (respecting Champion limits). |`,
    },
    {
        id: 'abduct-captive',
        title: 'Abduct Captive',
        category: 'Captive Story Action',
        faction: 'Zetans',
        rules: `This crew abducts captives aboard their ship for experiments.

Choose a Captive model from another player's Crew Roster on your Story Sheet, then roll on the Abduct Captives Table.
This Action cannot be made if the captive was taken in your last game.

| Score | Result | Effect |
| --- | --- | --- |
| 1 | Escape! | The captive escapes and returns to original crew. Owner clears Absent. |
| 2-4 | Came Back Wrong | The captive returns to original crew. Your crew may benefit from one Facility on that crew's Home Turf while this model remains on their roster. Owner clears Absent. |
| 5-7 | Why Are You Beeping? | The captive returns. Choose one Perk or Upgrade gained during campaign on that model and add it to one model in your crew (respecting requisites and Rating changes). Innate Perks cannot be added this way. Owner clears Absent. |
| 8-10 | Donated to Science | The captive is removed from owner's Crew Roster. Choose a non-Absent model in your crew and upgrade it as in Crew Training without spending XP. |`,
    },
    {
        id: 'convert-captive',
        title: 'Convert Captive',
        category: 'Captive Story Action',
        faction: 'Children of the Atom',
        rules: `This crew tries to induct captives into Atom's flock.

Choose a Captive model from another player's Crew Roster on your Story Sheet, then roll on the Convert Table.
This Action cannot be made if the captive was taken in your last game.

| Score | Result | Effect |
| --- | --- | --- |
| 1 | Escape! | The captive escapes and returns to original crew. Owner clears Absent. |
| 2-5 | Profane | The captive fails to acclimatize and is removed from owner's Crew Roster. |
| 6-8 | Believer | The captive is removed from owner's Crew Roster and your crew gains 3 XP. |
| 9-10 | Devout | Copy captive's statistics and Traits to your Crew Roster, then remove from original owner. The model gains Outsider and loses Natural Leader (if they had it). |`,
    },
    {
        id: 'eat-captive',
        title: 'Eat Captive',
        category: 'Captive Story Action',
        faction: 'Trappers',
        rules: `This crew uses captives as quick snacks.

Choose a Captive model from another player's Crew Roster on your Story Sheet, then roll on the Dinner Table.
This Action cannot be made if the captive was taken in your last game.

| Score | Result | Effect |
| --- | --- | --- |
| 1 | Escape! | The captive escapes into the Fog and returns to original crew. Owner clears Absent. |
| 2-5 | A Little Stringy... | The captive is removed from owner's Crew Roster. Each non-Absent model in your crew may remove the penalty from one penalized statistic (as in Recuperate). |
| 6-10 | A Feast Fit for a King! | The captive is removed from owner's Crew Roster. Next time you take Recruit, you may roll on Nourishment Table, re-rolling Skin and Bones. If you already have a Food Store on Home Turf, resolve Potential automatically instead of rolling. |`,
    },
    {
        id: 'toil-for-the-mechanist',
        title: 'Toil for the Mechanist!',
        category: 'Captive Story Action',
        faction: 'Automatons',
        rules: `This crew sends captives into the Wasteland to scavenge for mechanical supremacy.

Choose a Captive model from another player's Crew Roster on your Story Sheet and check whether that model has the Machine Perk.
Roll a die and resolve the matching Toil Table.
This Action cannot be made if the captive was taken in your last game.

Toil Table (Machine Perk Models):

| Score | Result | Effect |
| --- | --- | --- |
| 1-2 | Escape! | The captive escapes and returns to original crew. Owner clears Absent. |
| 3-6 | Parts | Roll a die and add that many Parts to your Stash. The captive is removed from owner's Crew Roster. |
| 7-10 | New Friend | Copy captive's statistics and Traits to your Crew Roster, remove from original owner, apply Outsider, and remove Natural Leader (if they had it). |

Toil Table (Non-Machine Perk Models):

| Score | Result | Effect |
| --- | --- | --- |
| 1-2 | "You have escaped... for now." | The captive escapes and returns to original crew. Owner clears Absent. |
| 3-6 | "Yes! Yes! My forces grow stronger!" | Roll a die and add Parts equal to the result. The captive is removed from owner's Crew Roster. |
| 7-10 | "All shall tremble at the robotic rule of the Mechanist!" | Roll two dice and add Parts equal to the highest result. The captive is removed from owner's Crew Roster. |`,
    },
];

