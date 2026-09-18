// @ts-nocheck
/**
 * Auto-generated source snapshot from smogon/pokemon-showdown.
 * Do not edit directly; run 'bun run fetch-sd' to regenerate.
 *
 * Remote URL: https://raw.githubusercontent.com/smogon/pokemon-showdown/10f47c9de12a9eb15cc3db0fab9105a1d1f7149b/data/mods/championsregma/abilities.ts
 * Git Ref:    10f47c9de12a9eb15cc3db0fab9105a1d1f7149b
 * Fetched At: 2026-09-18T03:20:06.807Z
 */

export const Abilities: import('../../../sim/dex-abilities').ModdedAbilityDataTable = {
	disguise: {
		inherit: true,
		onEffectiveness(typeMod, target, type, move) {
			if (!target || move.category === 'Status') return;

			if (move.hit === 1) delete this.effectState.neutral;
			if (this.effectState.neutral) return 0;

			if (!['mimikyu', 'mimikyutotem'].includes(target.species.id)) {
				return;
			}

			const hitSub = target.volatiles['substitute'] && !move.flags['bypasssub'] && !(move.infiltrates && this.gen >= 6);
			if (hitSub) return;

			if (!target.runImmunity(move)) return;
			this.effectState.neutral = true;
			return 0;
		},
	},
	spicyspray: {
		inherit: true,
		onDamagingHit(damage, target, source, move) {
			if (!source.trySetStatus('brn', target) && !source.status && source.hasType('Fire')) {
				this.add('-immune', source);
			}
		},
	},
};
