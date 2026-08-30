/**
 * AUTO-GENERATED — DO NOT EDIT MANUALLY
 * Synced from: https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/dex-moves.ts
 * Synced at:   Sun, 30 Aug 2026 05:32:37 UTC
 * Branch:      master
 *
 * Runtime-only Showdown types (Battle, Pokemon, Side, etc.) and all import
 * statements have been removed. Stub types are provided where needed to keep
 * the interfaces we care about self-contained and importable without the full Showdown codebase.
 *
 * Use `bash scripts/sync_showdown_types.sh` to re-sync.
 */

// ---------------------------------------------------------------------------
// Stub types — replace complex Showdown runtime types with 'any' so the
// interfaces below remain importable without the rest of the codebase.
// ---------------------------------------------------------------------------
type SparseBoostsTable = Partial<Record<string, number>>;
type IDEntry = string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ID = string;
type StatIDExceptHP = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
// EffectData must be compatible with MoveEventMethods (both allow any values)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EffectData = Record<string, any>;
type ConditionData = Record<string, unknown>;
type ModdedConditionData = Record<string, unknown>;
type ModdedEffectText = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BasicEffect = Record<string, any>;
type Ability = {
  flags?: Record<string, 1 | undefined>;
  suppressWeather?: boolean;
};
type Item = {
  fling?: { basePower: number; status?: string; volatileStatus?: string };
  isBerry?: boolean;
  isChoice?: boolean;
  isGem?: boolean;
  isPokeball?: boolean;
  isPrimalOrb?: boolean;
  ignoreKlutz?: boolean;
  megaStone?: Record<string, string>;
  onDrive?: string;
  onMemory?: string;
  onPlate?: string;
  zMove?: true | string;
  zMoveType?: string;
  zMoveFrom?: string;
  itemUser?: string[];
  forcedForme?: string;
  naturalGift?: { basePower: number; type: string };
  boosts?: SparseBoostsTable;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
type MoveEventMethods = Record<string, AnyFn | undefined>;
type AbilityEventMethods = Record<string, unknown>;
type PokemonEventMethods = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Battle = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pokemon = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Side = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Field = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommonHandlers = Record<string, any>;

/**
 * Describes the acceptable target(s) of a move.
 * adjacentAlly - Only relevant to Doubles or Triples, the move only targets an ally of the user.
 * adjacentAllyOrSelf - The move can target the user or its ally.
 * adjacentFoe - The move can target a foe, but not (in Triples) a distant foe.
 * all - The move targets the field or all Pokémon at once.
 * allAdjacent - The move is a spread move that also hits the user's ally.
 * allAdjacentFoes - The move is a spread move.
 * allies - The move affects all active Pokémon on the user's team.
 * allySide - The move adds a side condition on the user's side.
 * allyTeam - The move affects all unfainted Pokémon on the user's team.
 * any - The move can hit any other active Pokémon, not just those adjacent.
 * foeSide - The move adds a side condition on the foe's side.
 * normal - The move can hit one adjacent Pokémon of your choice.
 * randomNormal - The move targets an adjacent foe at random.
 * scripted - The move targets the foe that damaged the user.
 * self - The move affects the user of the move.
 */
export type MoveTarget =
	'adjacentAlly' | 'adjacentAllyOrSelf' | 'adjacentFoe' | 'all' | 'allAdjacent' | 'allAdjacentFoes' |
	'allies' | 'allySide' | 'allyTeam' | 'any' | 'foeSide' | 'normal' | 'randomNormal' | 'scripted' | 'self';

/** Possible move flags. */
export interface MoveFlags {
	allyanim?: 1; // The move plays its animation when used on an ally.
	bypasssub?: 1; // Ignores a target's substitute.
	bite?: 1; // Power is multiplied by 1.5 when used by a Pokemon with the Ability Strong Jaw.
	bullet?: 1; // Has no effect on Pokemon with the Ability Bulletproof.
	cantusetwice?: 1; // The user cannot select this move after a previous successful use.
	charge?: 1; // The user is unable to make a move between turns.
	contact?: 1; // Makes contact.
	dance?: 1; // When used by a Pokemon, other Pokemon with the Ability Dancer can attempt to execute the same move.
	defrost?: 1; // Thaws the user if executed successfully while the user is frozen.
	distance?: 1; // Can target a Pokemon positioned anywhere in a Triple Battle.
	failcopycat?: 1; // Cannot be selected by Copycat.
	failencore?: 1; // Encore fails if target used this move.
	failinstruct?: 1; // Cannot be repeated by Instruct.
	failmefirst?: 1; // Cannot be selected by Me First.
	failmimic?: 1; // Cannot be copied by Mimic.
	futuremove?: 1; // Targets a slot, and in 2 turns damages that slot.
	gravity?: 1; // Prevented from being executed or selected during Gravity's effect.
	heal?: 1; // Prevented from being executed or selected during Heal Block's effect.
	metronome?: 1; // Can be selected by Metronome.
	minimize?: 1; // Deals double damage if the user is minimized.
	mirror?: 1; // Can be copied by Mirror Move.
	mustpressure?: 1; // Additional PP is deducted due to Pressure when it ordinarily would not.
	noassist?: 1; // Cannot be selected by Assist.
	nonsky?: 1; // Prevented from being executed or selected in a Sky Battle.
	noparentalbond?: 1; // Cannot be made to hit twice via Parental Bond.
	nosketch?: 1; // Cannot be copied by Sketch.
	nosleeptalk?: 1; // Cannot be selected by Sleep Talk.
	pledgecombo?: 1; // Gems will not activate. Cannot be redirected by Storm Drain / Lightning Rod.
	powder?: 1; // Has no effect on Pokemon which are Grass-type, have the Ability Overcoat, or hold Safety Goggles.
	protect?: 1; // Blocked by Detect, Protect, Spiky Shield, and if not a Status move, King's Shield.
	pulse?: 1; // Power is multiplied by 1.5 when used by a Pokemon with the Ability Mega Launcher.
	punch?: 1; // Power is multiplied by 1.2 when used by a Pokemon with the Ability Iron Fist.
	recharge?: 1; // If this move is successful, the user must recharge on the following turn and cannot make a move.
	reflectable?: 1; // Bounced back to the original user by Magic Coat or the Ability Magic Bounce.
	slicing?: 1; // Power is multiplied by 1.5 when used by a Pokemon with the Ability Sharpness.
	snatch?: 1; // Can be stolen from the original user and instead used by another Pokemon using Snatch.
	sound?: 1; // Has no effect on Pokemon with the Ability Soundproof.
	wind?: 1; // Activates the Wind Power and Wind Rider Abilities.
}

export interface HitEffect {
	onHit?: MoveEventMethods['onHit'];

	// set pokemon conditions
	boosts?: SparseBoostsTable;
	status?: string;
	volatileStatus?: string;

	// set side/slot conditions
	sideCondition?: string;
	slotCondition?: string;

	// set field conditions
	pseudoWeather?: string;
	terrain?: string;
	weather?: string;
}

export interface SecondaryEffect extends HitEffect {
	chance?: number;
	/** Used to flag a secondary effect as added by Poison Touch */
	ability?: Ability;
	/**
	 * Gen 2 specific mechanics: Bypasses Substitute only on Twineedle,
	 * and allows it to flinch sleeping/frozen targets
	 */
	kingsrock?: boolean;
	self?: HitEffect;
}

export interface MoveData extends EffectData, MoveEventMethods, HitEffect {
	name: string;
	/** move index number, used for Metronome rolls */
	num?: number;
	condition?: ConditionData;
	basePower: number;
	accuracy: true | number;
	pp: number;
	category: 'Physical' | 'Special' | 'Status';
	type: string;
	priority: number;
	target: MoveTarget;
	flags: MoveFlags;

	damage?: number | 'level' | false | null;
	contestType?: string;
	noPPBoosts?: boolean;

	// Z-move data
	// -----------
	/**
	 * ID of the Z-Crystal that calls the move.
	 * `true` for Z-Powered status moves like Z-Encore.
	 */
	isZ?: boolean | IDEntry;
	zMove?: {
		basePower?: number,
		effect?: IDEntry,
		boost?: SparseBoostsTable,
	};

	// Max move data
	// -------------
	/**
	 * `true` for Max moves like Max Airstream. If its a G-Max moves, this is
	 * the species name of the Gigantamax Pokemon that can use this G-Max move.
	 */
	isMax?: boolean | string;
	maxMove?: {
		basePower: number,
	};

	// Hit effects
	// -----------
	ohko?: boolean | 'Ice';
	thawsTarget?: boolean;
	heal?: number[];
	forceSwitch?: boolean;
	selfSwitch?: 'copyvolatile' | 'shedtail' | boolean;
	selfBoost?: { boosts?: SparseBoostsTable };
	selfdestruct?: 'always' | 'ifHit' | boolean;
	breaksProtect?: boolean;
	/**
	 * Note that this is only "true" recoil. Other self-damage, like Struggle,
	 * crash (High Jump Kick), Mind Blown, Life Orb, and even Substitute and
	 * Healing Wish, are sometimes called "recoil" by the community, but don't
	 * count as "real" recoil.
	 */
	recoil?: [number, number];
	drain?: [number, number];
	mindBlownRecoil?: boolean;
	chloroblastRecoil?: boolean;
	stealsBoosts?: boolean;
	struggleRecoil?: boolean;
	secondary?: SecondaryEffect;
	secondaries?: SecondaryEffect[];
	self?: SecondaryEffect;
	/**
	 * Boosted by Sheer Force without suppressing secondary effects.
	 */
	hasSheerForceBoost?: boolean;

	// Hit effect modifiers
	// --------------------
	alwaysHit?: boolean; // currently unused
	baseMoveType?: string;
	basePowerModifier?: number;
	critModifier?: number;
	critRatio?: number;
	/**
	 * Pokemon for the attack stat. Ability and Item damage modifiers still come from the real attacker.
	 */
	overrideOffensivePokemon?: 'target' | 'source';
	/**
	 * Physical moves use attack stat modifiers, special moves use special attack stat modifiers.
	 */
	overrideOffensiveStat?: StatIDExceptHP;
	/**
	 * Pokemon for the defense stat. Ability and Item damage modifiers still come from the real defender.
	 */
	overrideDefensivePokemon?: 'target' | 'source';
	/**
	 * uses modifiers that match the new stat
	 */
	overrideDefensiveStat?: StatIDExceptHP;
	forceSTAB?: boolean;
	ignoreAbility?: boolean;
	ignoreAccuracy?: boolean;
	ignoreDefensive?: boolean;
	ignoreEvasion?: boolean;
	ignoreImmunity?: boolean | { [typeName: string]: boolean };
	ignoreNegativeOffensive?: boolean;
	ignoreOffensive?: boolean;
	ignorePositiveDefensive?: boolean;
	ignorePositiveEvasion?: boolean;
	multiaccuracy?: boolean;
	multihit?: number | number[];
	multihitType?: 'parentalbond';
	noDamageVariance?: boolean;
	nonGhostTarget?: MoveTarget;
	spreadModifier?: number;
	sleepUsable?: boolean;
	/**
	 * Will change target if current target is unavailable. (Dragon Darts)
	 */
	smartTarget?: boolean;
	/**
	 * Tracks the original target through Ally Switch and other switch-out-and-back-in
	 * situations, rather than just targeting a slot. (Stalwart, Snipe Shot)
	 */
	tracksTarget?: boolean;
	willCrit?: boolean;
	callsMove?: boolean;

	// Mechanics flags
	// ---------------
	hasCrashDamage?: boolean;
	isConfusionSelfHit?: boolean;
	stallingMove?: boolean;
	baseMove?: ID;
}

export type ModdedMoveData = (MoveData | Partial<Omit<MoveData, 'name'>> & {
	inherit: true,
	igniteBoosted?: boolean,
	settleBoosted?: boolean,
	bodyofwaterBoosted?: boolean,
	longWhipBoost?: boolean,
	gen?: number,
	condition?: ModdedConditionData,
}) & ModdedEffectText;

export interface MoveDataTable { [moveid: IDEntry]: MoveData }
export interface ModdedMoveDataTable { [moveid: IDEntry]: ModdedMoveData }

export interface Move extends Readonly<BasicEffect & MoveData> {
	readonly effectType: 'Move';
}

type MoveCategory = 'Physical' | 'Special' | 'Status';
