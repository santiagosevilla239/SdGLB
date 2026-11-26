(function (global) {
  'use strict';

  function activar(contenedor, alCambiar) {
    if (!contenedor) return;

    var botones = contenedor.querySelectorAll('[data-tab]');

    function mostrar(nombre) {
      botones.forEach(function (btn) {
        var activa = btn.dataset.tab === nombre;
        btn.classList.toggle('tab--activa', activa);
        btn.setAttribute('aria-selected', activa ? 'true' : 'false');

        var panel = document.getElementById('panel-' + btn.dataset.tab);
        if (panel) panel.hidden = !activa;
      });

      if (alCambiar) alCambiar(nombre);
    }

    contenedor.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tab]');
      if (btn) mostrar(btn.dataset.tab);
    });

    contenedor.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;

      var lista = Array.prototype.slice.call(botones);
      var i = lista.indexOf(document.activeElement);
      if (i === -1) return;

      var siguiente = e.key === 'ArrowRight'
        ? lista[(i + 1) % lista.length]
        : lista[(i - 1 + lista.length) % lista.length];

      siguiente.focus();
      mostrar(siguiente.dataset.tab);
      e.preventDefault();
    });

    var inicial = contenedor.querySelector('.tab--activa') || botones[0];
    if (inicial) mostrar(inicial.dataset.tab);

    return { mostrar: mostrar };
  }

  global.Pestanas = { activar: activar };

}(window));
