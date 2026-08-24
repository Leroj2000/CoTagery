/**
 * Stavový automat Asset/Movement (EPIC – Asset custody, Fáze A).
 *
 * Princip (dle analýzy Hilti ON!Track): asset má JEDNO aktuální přiřazení
 * (`holder` = osoba / místo / jiný asset). **Stav se odvozuje z typu posledního
 * pohybu**, nenastavuje se ručně. `home_location` (kam patří) je oddělené od
 * `holder` (kde věc je / kdo ji má). Historie se nepřepisuje – každý pohyb je
 * nová událost.
 */

export type AssetStatus =
  | 'available'
  | 'assigned'
  | 'loaned'
  | 'in_transfer'
  | 'reserved'
  | 'service'
  | 'damaged'
  | 'lost'
  | 'retired';

export type MovementType =
  | 'assign'
  | 'loan'
  | 'move'
  | 'return'
  | 'handover'
  | 'service_out'
  | 'service_return'
  | 'dispose';

export type HolderType = 'location' | 'person' | 'asset';

/** Efektivní stav assetu (co se odvozuje z pohybů). */
export interface AssetState {
  status: AssetStatus;
  holderType: HolderType | null;
  holderId: string | null;
  responsiblePersonId: string | null;
  dueAt: Date | null;
}

/** Vstup pohybu. `homeLocationId` slouží jako výchozí cíl vrácení. */
export interface MovementInput {
  type: MovementType;
  toType?: HolderType | null;
  toId?: string | null;
  dueAt?: Date | null;
  homeLocationId?: string | null;
}

export class MovementError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Výchozí stav nově založeného assetu: dostupný, v domovské lokaci. */
export function initialState(homeLocationId: string | null): AssetState {
  return {
    status: 'available',
    holderType: homeLocationId ? 'location' : null,
    holderId: homeLocationId,
    responsiblePersonId: null,
    dueAt: null,
  };
}

function require_(cond: boolean, code: string, msg: string): void {
  if (!cond) throw new MovementError(code, msg);
}

function person(state: AssetState, toId: string | null | undefined): AssetState {
  require_(!!toId, 'to_required', 'Chybí cíl pohybu (osoba)');
  return { ...state, holderType: 'person', holderId: toId!, responsiblePersonId: toId! };
}

function location(state: AssetState, toId: string | null | undefined, fallback?: string | null): AssetState {
  const target = toId ?? fallback ?? null;
  require_(!!target, 'to_required', 'Chybí cílová lokace (ani home location)');
  return { ...state, holderType: 'location', holderId: target, responsiblePersonId: null, dueAt: null };
}

/**
 * Aplikuje pohyb na aktuální stav a vrátí nový stav. Vyhodí `MovementError`,
 * pokud pohyb není z daného stavu povolený. Historie (ledger) se řeší zvlášť.
 */
export function applyMovement(state: AssetState, mv: MovementInput): AssetState {
  const s = state.status;
  require_(s !== 'retired', 'retired', 'Vyřazený asset už nelze přesouvat');

  switch (mv.type) {
    case 'loan':
      require_(
        ['available', 'assigned', 'reserved'].includes(s),
        'not_loanable',
        `Položku ve stavu '${s}' nelze půjčit`,
      );
      return { ...person(state, mv.toId), status: 'loaned', dueAt: mv.dueAt ?? null };

    case 'assign':
      require_(
        !['service', 'in_transfer'].includes(s),
        'not_assignable',
        `Položku ve stavu '${s}' nelze přidělit`,
      );
      return mv.toType === 'location'
        ? { ...location(state, mv.toId), status: 'assigned' }
        : { ...person(state, mv.toId), status: 'assigned', dueAt: mv.dueAt ?? null };

    case 'move':
      return { ...location(state, mv.toId), status: 'available' };

    case 'handover':
      require_(
        ['loaned', 'assigned'].includes(s),
        'not_handoverable',
        `Položku ve stavu '${s}' nelze předat dál`,
      );
      return { ...person(state, mv.toId), status: 'loaned', dueAt: mv.dueAt ?? state.dueAt };

    case 'return':
      require_(
        ['loaned', 'assigned', 'in_transfer', 'reserved'].includes(s),
        'not_returnable',
        `Položku ve stavu '${s}' nelze vrátit`,
      );
      return { ...location(state, mv.toId, mv.homeLocationId), status: 'available' };

    case 'service_out':
      return { ...(mv.toType === 'person' ? person(state, mv.toId) : location(state, mv.toId, mv.homeLocationId)), status: 'service', responsiblePersonId: null, dueAt: null };

    case 'service_return':
      require_(s === 'service', 'not_in_service', 'Položka není v servisu');
      return { ...location(state, mv.toId, mv.homeLocationId), status: 'available' };

    case 'dispose':
      return {
        status: 'retired',
        holderType: null,
        holderId: null,
        responsiblePersonId: null,
        dueAt: null,
      };

    default:
      throw new MovementError('unknown_type', `Neznámý typ pohybu`);
  }
}

/** Akce nabídnuté po skenu podle aktuálního stavu (mobil: věc → co s ní). */
export function availableActions(status: AssetStatus): MovementType[] {
  switch (status) {
    case 'available':
      return ['loan', 'assign', 'move', 'service_out', 'dispose'];
    case 'assigned':
      return ['loan', 'handover', 'return', 'move', 'service_out'];
    case 'loaned':
      return ['return', 'handover', 'service_out'];
    case 'reserved':
      return ['loan', 'assign', 'return'];
    case 'service':
      return ['service_return'];
    case 'retired':
      return [];
    default:
      return ['move', 'return'];
  }
}
