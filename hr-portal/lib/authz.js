// Centralized authorization rules so every route checks access the same way.
//
// Roles (three tiers, see README for the full permissions table):
//  - 'admin'   President plus the HR Directorate. Full access to
//              everything, including Logins, Dashboard, and generating
//              QR check in codes.
//  - 'manager' HR Executives. Same data access as admin for Roster,
//              Recruitment, and manual attendance marking across every
//              portfolio, but cannot manage Logins, cannot view the
//              Dashboard or Data Quality pages, and cannot generate QR
//              check in codes.
//  - 'member'  Everyone else, at every level, in every other portfolio.
//              Scoped to their own portfolio, and cannot manually mark
//              attendance for anyone, including themselves. The only way
//              a member's attendance gets marked is by a manager or
//              admin, or by scanning a meeting's QR check in code to
//              self check in.

import { normalizePortfolio } from './portfolio';

export function isAdmin(session) {
  return session?.role === 'admin';
}

export function isManager(session) {
  return session?.role === 'manager';
}

// True for the two roles that share full cross portfolio data access
// (Roster, Recruitment, manual attendance marking), everything except
// Logins, Dashboard, and QR generation, which stay admin only.
export function isManagerOrAdmin(session) {
  return isAdmin(session) || isManager(session);
}

export function canAccessPortfolio(session, portfolio) {
  if (!session) return false;
  if (isManagerOrAdmin(session)) return true;
  if (!portfolio || !session.portfolio) return false;
  return normalizePortfolio(session.portfolio) === normalizePortfolio(portfolio);
}

// Manual attendance marking, single or bulk, is manager and admin only.
// A member's attendance is only ever set by someone else marking them, or
// by the member self checking in via a QR code (a separate, narrower
// action, see canSelfCheckIn).
export function canManuallyMarkAttendance(session) {
  return isManagerOrAdmin(session);
}

// Every signed in role can scan a meeting's QR code to check themselves
// in, including managers and admins, since anyone might legitimately be
// the one attending.
export function canSelfCheckIn(session) {
  return !!session;
}

// Generating a check in QR code is admin only, deliberately narrower than
// manual marking, see the README permissions table for why (this is the
// "verification hand" staying with President plus HR Directorate).
export function canGenerateCheckinCode(session) {
  return isAdmin(session);
}

export function canManageLogins(session) {
  return isAdmin(session);
}

export function canViewDashboard(session) {
  return isAdmin(session);
}

// Bulk CSV import, same tier as Roster add and edit.
export function canBulkImportRoster(session) {
  return isManagerOrAdmin(session);
}

export function forbidden(message = 'You do not have access to this portfolio.') {
  return { error: message, status: 403 };
}
