(function (global) {
  'use strict';

  var PAUSA_MAX   = 60;
  var CIERRE      = 100;
  var LARGO_MINIMO = 6;

  function activar(alLeer) {
    var buffer = '';
    var ultimaTecla = 0;
    var timer = null;
    var fueRafaga = false;

    function onKeyDown(e) {

      if (e.key === 'Enter' && fueRafaga) {
        e.preventDefault();
        cerrar();
        return;
      }

      if (!e.key || e.key.length > 1) return;

      var ahora = Date.now();
      var desdeUltima = ahora - ultimaTecla;

      if (desdeUltima > PAUSA_MAX) {
        buffer = '';
        fueRafaga = false;
      }

      buffer += e.key;
      ultimaTecla = ahora;

      var enCampo = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (desdeUltima <= PAUSA_MAX) {
        fueRafaga = true;
        if (enCampo) e.preventDefault();
      }

      clearTimeout(timer);
      timer = setTimeout(cerrar, CIERRE);
    }

    function cerrar() {
      clearTimeout(timer);
      var codigo = buffer.trim();
      buffer = '';
      fueRafaga = false;

      if (codigo.length >= LARGO_MINIMO) alLeer(codigo);
    }

    var destino = global.document;
    destino.addEventListener('keydown', onKeyDown);

    return {
      desactivar: function () {
        clearTimeout(timer);
        buffer = '';
        fueRafaga = false;
        destino.removeEventListener('keydown', onKeyDown);
      }
    };
  }

  global.Escaner = { activar: activar };

}(window));
