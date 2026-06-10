const DEFAULT_DURATION = 3000;
let _container = null;

function init() {
  _container = document.getElementById('toast-container');
}

/**
 * @param {{ message: string, type?: 'success'|'error'|'info', duration?: number }} opts
 */
function show({ message, type = 'info', duration = DEFAULT_DURATION }) {
  if (!_container) return;

  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${icons[type] ?? icons.info}</span>
    <span class="toast__message">${_escapeHtml(message)}</span>
    <button class="toast__close" aria-label="알림 닫기">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  toast.querySelector('.toast__close').addEventListener('click', () => _dismiss(toast));
  _container.appendChild(toast);

  // 애니메이션 진입
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
  });

  const timer = setTimeout(() => _dismiss(toast), duration);
  toast._dismissTimer = timer;
}

function _dismiss(toast) {
  if (!toast.isConnected) return;
  clearTimeout(toast._dismissTimer);
  toast.classList.remove('toast--visible');
  toast.classList.add('toast--hiding');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const success = (message, duration) => show({ message, type: 'success', duration });
const error   = (message, duration) => show({ message, type: 'error',   duration });
const info    = (message, duration) => show({ message, type: 'info',    duration });

export { init, show, success, error, info };
