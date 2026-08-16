/**
 * Asset nesting (§14) – strukturální containment věcí. Ochrana proti cyklům:
 * věc nelze vložit do sebe ani do svého potomka (jinak by vznikl kruh).
 * Čistá logika – bez DB, testovatelná.
 */

/**
 * Vytvořilo by vložení `childId` do `containerId` cyklus? `parentOf` mapuje
 * asset → jeho aktuální rodič. Projde řetězec rodičů od kontejneru nahoru;
 * narazí-li na `childId`, byl by to cyklus.
 */
export function wouldCreateCycle(
  childId: string,
  containerId: string,
  parentOf: ReadonlyMap<string, string | null>,
): boolean {
  if (childId === containerId) return true;
  let cursor: string | null | undefined = containerId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === childId) return true;
    if (seen.has(cursor)) break; // ochrana proti zacyklení dat
    seen.add(cursor);
    cursor = parentOf.get(cursor) ?? null;
  }
  return false;
}
