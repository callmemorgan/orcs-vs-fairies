import type { ConquestRegionDefinition, ConquestWorldDefinition } from '../core/conquest-types';
import type { FactionId } from '../core/types';

export const CONQUEST_REGION_IDS = ['hearth', 'grove', 'quarry', 'crossroads', 'crypt', 'coast', 'keep'] as const;
export type ConquestRegionId = typeof CONQUEST_REGION_IDS[number];
type AuthoredRegion = ConquestRegionDefinition & { id: ConquestRegionId; neighbors: ConquestRegionId[] };

const regions: AuthoredRegion[] = [
  {
    id: 'hearth', name: 'Hearth Valley', owner: 'orcs', neighbors: ['grove', 'quarry'], terrain: 'grass', garrison: 3,
    supply: { wood: 120, ore: 40, crystal: 6 }, objective: 'hold',
    briefing: 'The valley workshops feed the western settlements. Their militia protects the grain road rather than the old treaty: a neighbor who threatens the road loses the valley\'s trust. Hold its open approaches and keep a supplied route to the grove or quarry.',
  },
  {
    id: 'grove', name: 'Ashwing Grove', owner: 'fairies', neighbors: ['hearth', 'crossroads'], terrain: 'forest', garrison: 3,
    supply: { wood: 190, ore: 20, crystal: 18 }, objective: 'hold',
    briefing: 'The Court guards the last unburned timber between Hearth and the eastern roads. Its wardens prefer an agreement that keeps armies out of the grove, but will fight anyone cutting a new military road. Hold the wooded clearing and protect the defenders from attacks along both trade paths.',
  },
  {
    id: 'quarry', name: 'Deep Gate Quarry', owner: 'dwarves', neighbors: ['hearth', 'crossroads', 'crypt'], terrain: 'rock', garrison: 4,
    supply: { wood: 35, ore: 170, crystal: 12 }, objective: 'siege',
    briefing: 'Deep Gate supplies ore to every realm but refuses the Keep\'s toll on finished metal. The engineers will bargain for a safe export road; threats make them prepare the firing shelves. Break the quarry fortress through its narrow approaches while keeping the siege weapons behind a screen.',
  },
  {
    id: 'crossroads', name: 'Brass Crossroads', owner: 'automata', neighbors: ['grove', 'quarry', 'coast', 'keep'], terrain: 'road', garrison: 4,
    supply: { wood: 80, ore: 80, crystal: 24 }, objective: 'crossing',
    briefing: 'The crossing council keeps four routes open and records every unpaid crossing. It wants reliable tribute more than another ruined convoy, while the Keep demands exclusive passage. Secure the central crossing to connect the western supply roads to the coast and the eastern fortress.',
  },
  {
    id: 'crypt', name: 'Ashen Crypt', owner: 'undead', neighbors: ['quarry', 'keep'], terrain: 'mud', garrison: 3,
    supply: { wood: 45, ore: 45, crystal: 60 }, objective: 'hold',
    briefing: 'The burial road joins the quarry to the Keep through a marsh. Its wardens guard the ledgers of workers lost building that road and will consider a truce that respects the graves. Hold the raised clearing, keep fragile casters behind the line, and watch for attacks through the wet flanks.',
  },
  {
    id: 'coast', name: 'Returning Coast', owner: 'tideborn', neighbors: ['crossroads', 'keep'], terrain: 'shallows', garrison: 4,
    supply: { wood: 70, ore: 40, crystal: 42 }, objective: 'crossing',
    briefing: 'The harbor villages depend on a tide the Keep can divert. Their captains want the regulator opened and the coastal route free of toll troops. Secure the wet crossing between the piers; Tideborn move freely through the shallows, while dry-land troops need time to bring their formation across.',
  },
  {
    id: 'keep', name: 'The Regent\'s Keep', owner: 'automata', neighbors: ['crossroads', 'crypt', 'coast'], terrain: 'snow', garrison: 6,
    supply: { wood: 90, ore: 160, crystal: 54 }, objective: 'siege',
    briefing: 'The Regent controls the eastern road gates and the harbor regulator from a winter fortress. Its fortified approaches protect the strongest garrison in the realms, and its council rejects weak demands while the tolls still fund its army. Cut a supplied approach through the crossroads, crypt or coast, then breach the fortress with a protected siege line.',
  },
];

export const CONQUEST_WORLD: ConquestWorldDefinition = {
  id: 'shattered-realms', title: 'The Shattered Realms',
  introduction: 'The old road treaty ended when the Regent took control of the eastern crossings. Every realm now guards a route it needs for food or trade. Begin in Hearth Valley, secure adjacent land to supply the army, and decide which neighbors can gain more from an agreement than another battle.',
  regions,
};

const factions: readonly FactionId[] = ['orcs', 'fairies', 'dwarves', 'undead', 'tideborn', 'automata'];

/** The chosen army owns Hearth; its other settlements belong to a different faction in this campaign. */
export function conquestWorldFor(faction: FactionId): ConquestWorldDefinition {
  const index = factions.indexOf(faction);
  if (index < 0) throw new Error('Choose a known faction for world conquest.');
  const replacement = factions[(index + 1) % factions.length];
  return {
    ...CONQUEST_WORLD,
    regions: regions.map(region => ({
      ...region,
      owner: region.id === 'hearth' ? faction : region.owner === faction ? replacement : region.owner,
      neighbors: [...region.neighbors],
      supply: { ...region.supply },
    })),
  };
}
