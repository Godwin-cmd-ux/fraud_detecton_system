import type { Db } from '../db/client';
import type { MlClient } from '../modules/fraud/mlClient';
import type { AdminRow } from './repo';
import type { SmsClient } from '../modules/sms/client';
import type { UserRow } from '../modules/users/repo';

/**
 * The USSD screen machine.
 *
 * A "scene" is the screen currently waiting for input. Each scene consumes exactly one input
 * segment and returns the next screen's text plus the name of the scene that should consume the
 * following segment. Navigation and collected inputs live in `UssdState`, which is persisted per
 * session, so an HTTP request never has to remember anything between callbacks.
 */

export type ActorKind = 'user' | 'admin';

export interface Actor {
  kind: ActorKind;
  id: number;
  name: string;
}

export interface UssdState {
  scene: string;
  /** Previous scenes, used by the universal `0. Back`. */
  stack: string[];
  /** Inputs collected by the current workflow. */
  data: Record<string, string>;
}

export interface Ctx {
  db: Db;
  ml: MlClient;
  /** Absent in tests; wallet services then skip their SMS notices. */
  sms?: SmsClient;
  now: Date;
  sessionId: string;
  /** Canonical `+255XXXXXXXXX` number the gateway reported. */
  phone: string;
  /** The single input segment the customer just entered ('' when a screen is re-rendered). */
  input: string;
  state: UssdState;
  actor: Actor | null;
  /** Fresh rows resolved on every callback; never trusted from stored session state. */
  meUser: UserRow | null;
  meAdmin: AdminRow | null;
  ip: string;
  userAgent: string | null;
}

export interface Result {
  /** Screen body without the CON/END prefix. */
  text: string;
  /** Terminal screen: the gateway closes the session. */
  end?: boolean;
  /** Scene that should consume the next segment (defaults to the current one). */
  scene?: string;
  /** Inputs merged into the session state. */
  data?: Record<string, string>;
  /** Drop collected inputs (used when returning to a root menu). */
  clearData?: boolean;
}

export type Scene = (c: Ctx) => Promise<Result>;

export interface SceneDef {
  run: Scene;
  /** Required actor role. Enforced on every callback, never inferred from the menu shown. */
  scope?: ActorKind;
}

const registry = new Map<string, SceneDef>();

export function defineScene(name: string, run: Scene, scope?: ActorKind): void {
  registry.set(name, { run, ...(scope ? { scope } : {}) });
}

export function getScene(name: string): SceneDef | undefined {
  return registry.get(name);
}

export const sceneNames = (): string[] => [...registry.keys()];

/** Root screen for whoever the gateway just identified. */
export function homeScene(actor: Actor | null): string {
  if (!actor) return 'guest.main';
  return actor.kind === 'admin' ? 'admin.main' : 'user.main';
}

export const isRootScene = (name: string): boolean => name.endsWith('.main');

/** Small helpers shared by every scene. */
export const BACK = '0. Back';

export function backTo(_scene: string): string {
  return `\n${BACK}`;
}

export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseIndex(raw: string, max: number): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= max ? n : null;
}

/** Zero is a valid balance for an administrator-created account. */
export function parseAmountOrZero(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Renders one numbered menu and dispatches the selection. Returning `input === ''` re-renders the
 * screen, which is what the universal `0. Back` does when it re-enters a scene.
 */
export async function choose(
  c: Ctx,
  screen: () => string | Promise<string>,
  routes: Record<string, (c: Ctx) => Promise<Result>>,
): Promise<Result> {
  const handler = routes[c.input];
  if (handler) return handler(c);
  const text = await screen();
  return { text: c.input === '' ? text : `Invalid choice.\n${text}` };
}
