(function () {
  'use strict';

  var soportado = typeof window.HTMLDialogElement !== 'undefined' &&
                  typeof window.HTMLDialogElement.prototype.showModal === 'function';

  if (soportado) return;

  var fondo = null;

  function crearFondo() {
    if (fondo) return fondo;
    fondo = document.createElement('div');
    fondo.className = 'modal-fondo-respaldo';
    document.body.appendChild(fondo);
    return fondo;
  }

  function parchar(dialog) {
    if (dialog.showModal) return;

    dialog.showModal = function () {
      crearFondo().classList.add('modal-fondo-respaldo--visible');
      dialog.setAttribute('open', '');
      document.body.style.overflow = 'hidden';
    };

    dialog.show = dialog.showModal;

    dialog.close = function () {
      dialog.removeAttribute('open');
      if (fondo) fondo.classList.remove('modal-fondo-respaldo--visible');
      document.body.style.overflow = '';
      dialog.dispatchEvent(new Event('close'));
    };

    if (!('open' in dialog)) {
      Object.defineProperty(dialog, 'open', {
        get: function () { return dialog.hasAttribute('open'); }
      });
    }
  }

  document.querySelectorAll('dialog').forEach(parchar);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var abierto = document.querySelector('dialog[open]');
    if (abierto && abierto.close) abierto.close();
  });

}());
