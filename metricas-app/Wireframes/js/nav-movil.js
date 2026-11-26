(function () {
  'use strict';

  var sidebar = document.querySelector('.sidebar');
  var brand   = document.querySelector('.topbar-brand');
  if (!sidebar || !brand) return;

  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.id = 'nav-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'sidebar-nav');
  toggle.innerHTML = '<i class="ti ti-menu-2" aria-hidden="true"></i><span>Menú</span>';
  brand.insertBefore(toggle, brand.firstChild);

  sidebar.id = sidebar.id || 'sidebar-nav';

  var cabecera = document.createElement('div');
  cabecera.className = 'sidebar-cerrar';
  cabecera.innerHTML =
    '<span class="sidebar-cerrar-titulo">Menú</span>' +
    '<button type="button" class="btn btn--ghost" id="nav-cerrar" aria-label="Cerrar el menú" ' +
    'style="height:44px; width:44px; padding:0;">' +
      '<i class="ti ti-x" aria-hidden="true"></i>' +
    '</button>';
  sidebar.insertBefore(cabecera, sidebar.firstChild);

  var overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  document.body.appendChild(overlay);

  function abrir() {
    sidebar.classList.add('sidebar--abierto');
    overlay.classList.add('sidebar-overlay--visible');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';

    var primero = sidebar.querySelector('.sidebar-link');
    if (primero) primero.focus();
  }

  function cerrar(devolverFoco) {
    sidebar.classList.remove('sidebar--abierto');
    overlay.classList.remove('sidebar-overlay--visible');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';

    if (devolverFoco) toggle.focus();
  }

  toggle.addEventListener('click', function () {
    if (sidebar.classList.contains('sidebar--abierto')) cerrar(true);
    else abrir();
  });

  overlay.addEventListener('click', function () { cerrar(false); });

  document.getElementById('nav-cerrar').addEventListener('click', function () {
    cerrar(true);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sidebar.classList.contains('sidebar--abierto')) cerrar(true);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 768) cerrar(false);
  });

}());
