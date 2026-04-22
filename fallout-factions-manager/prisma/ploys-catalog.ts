export type PloyDefinitionSeed = {
    name: string;
    description: string;
    sortOrder: number;
};

export type SubfactionPloyRuleSeed = {
    subfactionName: string;
    allow: string[];
    deny: string[];
};

export const PLOY_DEFINITIONS: PloyDefinitionSeed[] = [
    {
        name: 'Teamwork',
        sortOrder: 10,
        description:
            'You may Enact this Ploy at the end of your Turn.\n\nTake another Turn. When choosing an Active Model, you cannot choose the Active model from the prior Turn.',
    },
    {
        name: 'Second Wind',
        sortOrder: 20,
        description:
            'You may enact this Ploy at the start of your Turn.\n\nWhen choosing your Active model, you may choose an Exhausted model. If you do, it Recovers 1 Fatigue.',
    },
    {
        name: 'Lucky Break',
        sortOrder: 30,
        description:
            'You may enact this Ploy while making a S.P.E.C.I.A.L. Test for a model, after Roll the Pool and Remove Duds, but before the Fortune Smiles Step.\n\nYou may Re-roll all Duds in the Pool.',
    },
    {
        name: 'The Chain That Binds',
        sortOrder: 40,
        description:
            'You may enact this Ploy at the start of the game, before the start of the first Turn.\n\nEach Grunt model within the Control Area of a Friendly Champion may take a single Action, taking Fatigue as normal.',
    },
    {
        name: 'Vertibird Drop',
        sortOrder: 50,
        description:
            'You may enact this Ploy before Deploying models onto the Battlefield.\n\nChoose one of your models. That model is not deployed following the Starting Positions rules of this game. Instead, when you become the Active player on Turn 2, place the model in Base contact of a Battlefield edge of your choice.',
    },
    {
        name: 'No Place Like Home',
        sortOrder: 60,
        description:
            'You may enact this Ploy when a Friendly model is Incapacitated.\n\nAdd 1 Bonus Dice to the Dice Pool of all Confusion Tests made as a result of the Friendly model being Incapacitated.',
    },
    {
        name: 'Some Rain Must Fall',
        sortOrder: 70,
        description:
            'You may enact this Ploy when a Friendly model is Incapacitated by an Enemy model, after any Confusion Tests are made.\n\nEach Friendly model may make an Open Fire or Brawl Action (without taking Fatigue) against the Enemy model whose Action Incapacitated the Friendly model. These Actions follow the normal rules for targeting a model.',
    },
    {
        name: 'In Moderation',
        sortOrder: 80,
        description:
            'You may enact this Ploy when a Friendly model chooses Find a Chem while making a Rummage Action.\n\nIn addition to the result of the rolls for this Action, add a single dose of any Rare Chem to your Crew Roster.',
    },
    {
        name: 'Oh Yeah!',
        sortOrder: 90,
        description:
            'You may enact this Ploy at the start of any of your Turns. To enact this Ploy, remove a dose of any Common or Rare Chem from your Crew Roster.\n\nChoose a Friendly, Exhausted Grunt and Recover all Fatigue from it. Until the end of this Round, whenever this model makes an Attack Action, it adds 3 Bonus Dice to its Dice Pool. When this model next becomes Exhausted, it cannot Recover Fatigue, or have Fatigue removed from it. At the end of this Round, this model is Incapacitated.',
    },
    {
        name: 'Surging Advance',
        sortOrder: 100,
        description:
            'You may enact this Ploy at the start of any Round except the first.\n\nEach Unengaged model in your crew may be moved up to 4". During this move, no model can move into the Proximity of an Enemy model.',
    },
    {
        name: 'The Next Stage',
        sortOrder: 110,
        description:
            'You may enact this Ploy at the start of any of your Turns.\n\nYou may Recover 1 Harm on each of your models. Until the start of the next Round, increase each of your models Endurance by 1.',
    },
    {
        name: 'Brutality',
        sortOrder: 120,
        description:
            'You may enact this Ploy when a Friendly model Incapacitates an Enemy model with an Attack Action.\n\nYour opponent must make Confusion Tests for any of their models within 5", rather than 3". For each of these Tests, they count as Failing if they score fewer than two Hits.',
    },
    {
        name: 'Pack Hunters',
        sortOrder: 130,
        description:
            "You may enact this Ploy when a Friendly Champion makes a Get Moving Action.\n\nYou can give Movement Orders to any models in your crew, even if they are outside of the Champion's Control Area. All other restrictions apply as normal.",
    },
    {
        name: "That's Real Professional",
        sortOrder: 140,
        description:
            "You may enact this Ploy when selecting a model with either a Combat Rifle or a Handmade Rifle as the Active model.\n\nA Combat Rifle or Handmade Rifle held by the Active model gains the Fast Trait until the end of the Turn (if the weapon didn't already have that Trait). Until the end of the Turn, when creating a Dice Pool for an Open Fire Action using this weapon, the Active model gains 1 Bonus Die.",
    },
    {
        name: 'Prepared For Anything',
        sortOrder: 150,
        description:
            'You may enact this Ploy at the start of any of your Turns.\n\nYou immediately add Commons Chems to your Stash with a combined cost of up to 18 Caps.',
    },
    {
        name: 'Thrill Kill!',
        sortOrder: 160,
        description:
            'You may enact this Ploy when a Friendly model Incapacitates an Enemy model, but before removing it from play.\n\nEach of your models within 4" of the Enemy model Recovers 1 Fatigue.',
    },
    {
        name: 'Thin the Herd',
        sortOrder: 170,
        description:
            'You may enact this Ploy when a Friendly model is Incapacitated.\n\nUntil the end of the Round, any Tests made by Friendly Champions gain 3 Bonus Dice.',
    },
    {
        name: 'I Die for the Mothman!',
        sortOrder: 180,
        description:
            'You may enact this Ploy at the start of a Round.\n\nUntil the end of the Round, you may Recover Fatigue from a Friendly Holy Mothman each time that a Friendly model with the Offerings Innate Perk is Incapacitated.',
    },
    {
        name: 'Expel Them from Our Lands!',
        sortOrder: 190,
        description:
            'You may enact this Ploy when a Search Token is about to be removed by the opposing player.\n\nPlace a Friendly Holy Mothman or Mothman Hatchling from anywhere on the Battlefield to within 1" of the Search Token.',
    },
    {
        name: 'Invaders from Beyond',
        sortOrder: 200,
        description:
            'You may enact this Ploy when one of your models makes a Get Moving Action.\n\nDuring this Get Moving Action, Friendly models that Hurry do not Take Fatigue (in addition to any already taken for the movement), and ignore the Proximity of Enemy models.',
    },
    {
        name: 'Tractor Beam',
        sortOrder: 210,
        description:
            'You may enact this Ploy at the start of any of your Turns.\n\nMove an Enemy non-Leader model up to 4".',
    },
    {
        name: 'Revelations',
        sortOrder: 220,
        description:
            'You may enact this Ploy at the start of any Round after the first.\n\nFor this Round, all effects that would be triggered by a model being within 3" of a Radiation Token instead apply to any model within 6" of a Radiation Token.',
    },
    {
        name: 'Be Not Afraid',
        sortOrder: 230,
        description:
            'You may enact this Ploy at the start of any of your Turns.\n\nSelect an Enemy model with the Machine, Rad Resistant, or Power Armor Perk. The following effect from these Perks is ignored for that model for the rest of the game: "This model is unaffected by Radiation Tokens".',
    },
    {
        name: 'The Fog Thickens',
        sortOrder: 240,
        description:
            'You may enact this Ploy at the start of any Round.\n\nUntil the end of the Round, all Open Fire Actions are Unlucky.',
    },
    {
        name: 'Hook, Line, and...',
        sortOrder: 250,
        description:
            'You may enact this Ploy when an Enemy model finishes a move within 3" of a Search Token.\n\nMake an Evade Test (5A) for every Enemy model within 3" of the Search Token. Each Enemy model suffers 5 Damage, minus 1 for each Hit scored. If the move was caused by the crew that Enacted this Ploy, the Enemy model that moved must Re-roll any Hits in the Evade Test.',
    },
    {
        name: 'You Will Rue the Day!',
        sortOrder: 260,
        description:
            'You may enact this Ploy at the start of any Round.\n\nUntil the end of the Round, when a Friendly model with the Machine Perk would be Incapacitated, a Friendly Leader model Recovers 1 Fatigue.',
    },
    {
        name: 'The Flesh is Weak but Steel is Strong!',
        sortOrder: 270,
        description:
            'You may enact this Ploy if a Friendly model with the Machine Perk would be Incapacitated.\n\nThe Friendly model Recovers all Harm and an Injury.',
    },
    {
        name: 'Steel Dawn',
        sortOrder: 280,
        description:
            'You may enact this Ploy when a Friendly model with the Power Armor Perk creates a Dice Pool for an Attack Action.\n\nAdd an additional Bonus Die to the Attack Action\'s Dice Pool for every Friendly model without the Power Armor Perk inside the Active model\'s Control Area.',
    },
    {
        name: '...or Even Better, Some Ammo',
        sortOrder: 290,
        description:
            'You may enact this Ploy at the start of the game, before the start of the first Turn.\n\nChoose a Friendly model that has a weapon with the Slow Trait. Ignore the Slow Trait on this weapon during Round 2.',
    },
    {
        name: 'Retake the Old World',
        sortOrder: 300,
        description:
            'You may enact this Ploy at the start of the game, before the start of the first Turn.\n\nSelect half of the Search Tokens on the Battlefield, rounding down. Move these Tokens up to 3".',
    },
    {
        name: 'Going Underground',
        sortOrder: 310,
        description:
            'You may enact this Ploy when you select a Friendly Floater model as the Active model.\n\nPlace this model and up to one other Friendly Floater model anywhere on the Battlefield outside of the Control Area of an Enemy model. Any models that have been placed in this way must Take 1 Fatigue.',
    },
    {
        name: 'Quick Snack',
        sortOrder: 320,
        description:
            'You may enact this Ploy when you select a Friendly model with the Rad Resistant Perk as the Active model, and that model has a Friendly Puny Human model within 3".\n\nRemove a Friendly Puny Human model within 3" of the Active model from the Battlefield. The Active model Recovers all Harm and Health. All other Friendly Puny Humans Take 2 Fatigue.',
    },
    {
        name: 'Home Run',
        sortOrder: 330,
        description:
            'You may enact this Ploy when a Friendly model inflicts Damage during an Attack Action where a Baseball Bat or Baseball Grenade was chosen.\n\nThe Enemy model Suffers 1 Fatigue, and is moved up to 4" directly away from the Active model or Target point. If the Enemy model finishes this move in Base contact with any Enemy models, those models each roll a die. Each model that had a die score higher than their Agility Suffers 1 Fatigue.',
    },
    {
        name: "Lookin' Pale, Smoothskin",
        sortOrder: 340,
        description:
            'You may enact this Ploy at the start of any Round except the first.\n\nPlace a Radiation Token on the Battlefield.',
    },
    {
        name: 'The Way of Cool',
        sortOrder: 350,
        description:
            'You may enact this Ploy when you select either a Cool Cat or an Atom Cat as the Active model for the Turn.\n\nUntil the end of the Round, any Enemy model that Targets this model with an Action makes a Cool Test (2C). If Passed, the Action continues as normal. If Failed, the Enemy model Takes 1 Fatigue but does not make the Action.',
    },
    {
        name: 'Shrug It Off',
        sortOrder: 360,
        description:
            "You may enact this Ploy at the start of any Round.\n\nFriendly models within your Leader's Control Area gain the Odd Anatomy Perk until the end of the Round.",
    },
];

export const STANDARD_PLOY_NAMES = ['Teamwork', 'Second Wind', 'Lucky Break'] as const;

export const FACTION_PLOY_NAMES: Record<string, string[]> = {
    'Brotherhood of Steel': ['The Chain That Binds', 'Vertibird Drop'],
    Survivors: ['No Place Like Home', 'Some Rain Must Fall'],
    'Wasteland Raiders': ['In Moderation', 'Oh Yeah!'],
    'Super Mutants': ['Surging Advance', 'The Next Stage'],
    'The Pack': ['Brutality', 'Pack Hunters'],
    'The Operators': ["That's Real Professional", 'Prepared For Anything'],
    'The Disciples': ['Thrill Kill!', 'Thin the Herd'],
    'Followers of the Winged One': ['I Die for the Mothman!', 'Expel Them from Our Lands!'],
    Zetans: ['Invaders from Beyond', 'Tractor Beam'],
    'Children of Atom': ['Revelations', 'Be Not Afraid'],
    Trappers: ['The Fog Thickens', 'Hook, Line, and...'],
    Automatrons: ['You Will Rue the Day!', 'The Flesh is Weak but Steel is Strong!'],
};

export const SUBFACTION_PLOY_RULES: SubfactionPloyRuleSeed[] = [
    {
        subfactionName: 'Brotherhood First Expeditionary Force',
        allow: ['Steel Dawn'],
        deny: ['Vertibird Drop'],
    },
    {
        subfactionName: "Lyon's Brotherhood",
        allow: ['...or Even Better, Some Ammo'],
        deny: ['The Chain That Binds'],
    },
    {
        subfactionName: 'Brotherhood Recon Squad',
        allow: ['Retake the Old World'],
        deny: ['The Chain That Binds'],
    },
    {
        subfactionName: 'Appalachian Super Mutants',
        allow: ['Going Underground'],
        deny: ['The Next Stage'],
    },
    {
        subfactionName: 'Capital Wasteland Super Mutants',
        allow: ['Quick Snack'],
        deny: ['Surging Advance'],
    },
    {
        subfactionName: 'Diamond City Security',
        allow: ['Home Run'],
        deny: ['No Place Like Home'],
    },
    {
        subfactionName: 'Ghouls',
        allow: ["Lookin' Pale, Smoothskin"],
        deny: ['Some Rain Must Fall'],
    },
    {
        subfactionName: 'Atom Cats',
        allow: ['The Way of Cool'],
        deny: ['No Place Like Home'],
    },
    {
        subfactionName: 'The Khans',
        allow: ['Shrug It Off'],
        deny: ['Oh Yeah!'],
    },
];
