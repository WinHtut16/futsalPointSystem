/**
 * Which audit actions are routine trade rather than a decision.
 *
 * Trade is now logged too - closing a billiards table, recording a game rental
 * - because an audit log where a whole shift is invisible is not much of an
 * audit log. But those rows will outnumber the corrections by a wide margin,
 * and the whole value of the page is spotting the one waived bill among two
 * hundred ordinary ones. Hence a filter rather than a choice between the two.
 *
 * Kept here, in one place, because TWO callers filter on it: the page and the
 * spreadsheet export. An export that does not match the screen it was taken
 * from is worse than no export - it exists to be handed to someone in an
 * argument, and it has to be the same log they were just looking at.
 */
export const ROUTINE_AUDIT_ACTIONS = ['session.closed', 'session.recorded'] as const

/** PostgREST's `not.in` wants the list parenthesised with each value quoted. */
export const ROUTINE_AUDIT_ACTIONS_LIST = `(${ROUTINE_AUDIT_ACTIONS.map((a) => `"${a}"`).join(',')})`

export type AuditKind = 'all' | 'decisions'

/**
 * Defaults to 'all'. The client went looking for his evening's trade and found
 * an empty log, so showing everything is the behaviour that matches what
 * someone opening this page expects.
 */
export function parseAuditKind(raw: string | null | undefined): AuditKind {
  return raw === 'decisions' ? 'decisions' : 'all'
}
