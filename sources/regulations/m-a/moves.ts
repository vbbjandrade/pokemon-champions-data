// @ts-nocheck
/**
 * Auto-generated source snapshot from smogon/pokemon-showdown.
 * Do not edit directly; run 'bun run fetch-sd' to regenerate.
 *
 * Git Ref:    10f47c9de12a9eb15cc3db0fab9105a1d1f7149b
 * Raw Remote URL: https://raw.githubusercontent.com/smogon/pokemon-showdown/10f47c9de12a9eb15cc3db0fab9105a1d1f7149b/data/mods/championsregma/moves.ts
 * Fetched At: 2026-09-21T04:23:29.840Z
 * Commit Tree URL:	https://github.com/smogon/pokemon-showdown/tree/10f47c9de12a9eb15cc3db0fab9105a1d1f7149b
 */

export const Moves: import('../../../sim/dex-moves').ModdedMoveDataTable = {
	ceaselessedge: {
		inherit: true,
		onAfterHit(target, source, move) {
			if (!move.hasSheerForce && source.hp) {
				for (const side of source.side.foeSidesWithConditions()) {
					side.addSideCondition('spikes');
				}
			}
		},
	},
	direclaw: {
		inherit: true,
		secondary: {
			chance: 30,
			onHit(target, source) {
				const status = this.sample(['psn', 'par', 'slp']);
				if (target.status) {
					if (target.status === status) {
						this.add('-fail', target, status);
					} else {
						this.add('-fail', target);
					}
					return;
				}
				target.trySetStatus(status, source);
			},
		},
	},
	growth: {
		inherit: true,
		onModifyMove(move, pokemon) {
			if (pokemon.hasAbility('megasol') && !this.field.isWeather('sunnyday')) {
				delete move.boosts;
			} else if (['sunnyday', 'desolateland'].includes(pokemon.effectiveWeather())) {
				move.boosts = { atk: 2, spa: 2 };
			}
		},
	},
	stoneaxe: {
		inherit: true,
		onAfterHit(target, source, move) {
			if (!move.hasSheerForce && source.hp) {
				for (const side of source.side.foeSidesWithConditions()) {
					side.addSideCondition('stealthrock');
				}
			}
		},
	},
};
