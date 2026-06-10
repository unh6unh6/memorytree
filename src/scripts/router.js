/**
 * Hash-based SPA Router
 * Routes: #explorer (default), #list, #test
 *
 * Usage:
 *   router.navigate('#list', { nodeId: 'abc' });
 *   router.onRoute('list', (params) => { ... });
 */

const ROUTES = ['explorer', 'list', 'test'];
const DEFAULT_ROUTE = 'explorer';

const _handlers = {};
let _currentRoute = null;
let _currentParams = {};

function parseHash() {
  const raw = window.location.hash.slice(1); // remove '#'
  const [route, queryString] = raw.split('?');
  const params = {};
  if (queryString) {
    queryString.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    });
  }
  return { route: route || DEFAULT_ROUTE, params };
}

function applyRoute(route, params) {
  if (!ROUTES.includes(route)) {
    route = DEFAULT_ROUTE;
  }

  // Toggle view visibility
  document.querySelectorAll('.view').forEach(el => {
    el.classList.toggle('active', el.dataset.view === route);
  });

  _currentRoute = route;
  _currentParams = params;

  const handlers = _handlers[route] || [];
  handlers.forEach(fn => fn(params));
}

function handleHashChange() {
  const { route, params } = parseHash();
  applyRoute(route, params);
}

const router = {
  /** Register a handler for a specific route */
  onRoute(route, handler) {
    if (!_handlers[route]) _handlers[route] = [];
    _handlers[route].push(handler);
  },

  /** Navigate to a route with optional params */
  navigate(route, params = {}) {
    const query = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    window.location.hash = query ? `${route}?${query}` : route;
  },

  /** Return current route name */
  get current() { return _currentRoute; },

  /** Return current route params */
  get params() { return { ..._currentParams }; },

  /** Bootstrap: attach listener and resolve initial route */
  init() {
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
  },
};

export default router;
