// ── Router ─────────────────────────────────────────────────────────────────────
// Minimal single-page router for the app pages.
// app.js registers a handler via initRouter(); other modules call goToPage()
// to navigate without creating circular dependencies.

let _handler = null;

export function initRouter(handler) {
  _handler = handler;
}

// Pages where the hamburger (and side nav) should be hidden
const FULL_SCREEN_PAGES = new Set(['session', 'edit-plan', 'plan-weights']);

export function goToPage(page, data = null) {
  // Active highlight in side nav
  document.querySelectorAll('.side-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Hide hamburger on immersive pages (session, edit, etc.)
  const hamburger = document.getElementById('hamburger-btn');
  if (hamburger) hamburger.hidden = FULL_SCREEN_PAGES.has(page);

  // Progress header: only shown on the planner
  const header = document.querySelector('.app-header');
  if (header) header.hidden = (page !== 'planner');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (_handler) _handler(page, data);
}
