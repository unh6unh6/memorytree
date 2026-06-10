let _searchTimeout = null;
let _initialized = false;

function init() {
  if (_initialized) return;
  _initialized = true;

  const input = document.getElementById('navbar-search');
  if (!input) return;

  input.addEventListener('input', (e) => {
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(() => {
      const query = e.target.value.trim();
      document.dispatchEvent(new CustomEvent('navbar:search', { detail: { query } }));
    }, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      input.blur();
      clearTimeout(_searchTimeout);
      document.dispatchEvent(new CustomEvent('navbar:search', { detail: { query: '' } }));
    }
  });
}

export { init };
