// Loads config/universe.json (the single source of truth — no hardcoded symbols).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const UNIVERSE_PATH = join(here, "..", "config", "universe.json");

export interface Pair {
  ticker: string;
  rtoken_spot: string;
  perp: string;
  perp_max_lever: number;
  ondo_spot: string | null;
}
export interface SpotOnly {
  ticker: string;
  rtoken_spot: string;
  ondo_spot?: string;
}
export interface PerpOnly {
  ticker: string;
  perp: string;
  perp_max_lever: number;
  note?: string;
}
interface UniverseFile {
  generated: string;
  source: string;
  pairs: Pair[];
  spot_only_rtokens: SpotOnly[];
  perp_only: PerpOnly[];
}

const raw = JSON.parse(readFileSync(UNIVERSE_PATH, "utf8")) as UniverseFile;

export const universe = raw;
export const basisPairs: Pair[] = raw.pairs;
export const tripleListed: Pair[] = raw.pairs.filter((p) => !!p.ondo_spot); // rToken + Ondo + perp (9)
export const spotOnly: SpotOnly[] = raw.spot_only_rtokens;
export const perpOnly: PerpOnly[] = raw.perp_only;
