const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#mobile-navigation');
function closeMenu() {
  navigation.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open navigation');
}
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  navigation.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !navigation.hidden) {
    closeMenu();
    toggle.focus();
  }
});
navigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
window.matchMedia('(min-width: 901px)').addEventListener('change', closeMenu);
