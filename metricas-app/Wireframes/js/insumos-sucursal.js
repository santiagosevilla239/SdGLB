(function () {
  'use strict';

  var D = window.DATOS;

  var tbody = document.getElementById('insumos-body');
  var cards = document.getElementById('insumos-cards');
  if (!tbody) return;

  var subtitulo = document.getElementById('inventario-subtitulo');

  var toast      = document.getElementById('toast');
  var toastText  = document.getElementById('toast-text');
  var toastUndo  = document.getElementById('toast-undo');
  var toastClose = document.getElementById('toast-close');

  var toastTimer = null;
  var deshacer   = null;

  window.Pestanas.activar(document.getElementById('tabs-inventario'), function (cual) {
    if (cual !== 'insumos') return;

    var faltan = D.INSUMOS.filter(function (s) {
      return D.estadoInsumo(s.sucStock, s.minimoSuc).tipo !== 'disponible';
    }).length;

    subtitulo.textContent = D.plural(D.INSUMOS.length, 'insumo', 'insumos') +
                            ' · ' + faltan + ' para reponer';
  });

  function render() {
    tbody.innerHTML = D.INSUMOS.map(function (ins) {
      var estado = D.estadoInsumo(ins.sucStock, ins.minimoSuc);

      return '<tr data-insumo="' + ins.id + '">' +
               '<td>' + ins.name + '</td>' +
               '<td class="col-muted">' + ins.categoria + '</td>' +
               '<td class="col-number">' + D.cantidadInsumo(ins.sucStock, ins) + '</td>' +
               '<td><span class="pill pill--' + estado.tipo + '">' + estado.txt + '</span></td>' +
               '<td class="col-accion">' +
                 (ins.sucStock > 0
                   ? '<button type="button" class="btn btn--ghost btn--sm" data-descontar ' +
                     'data-insumo="' + ins.id + '" aria-haspopup="dialog">Descontar</button>'
                   : '<a href="06-suc-catalogo.html" class="btn btn--ghost btn--sm">Pedir</a>') +
               '</td>' +
             '</tr>';
    }).join('');

    renderCards();
  }

  function renderCards() {
    window.Tarjetas.render(cards, D.INSUMOS.map(function (ins) {
      var estado = D.estadoInsumo(ins.sucStock, ins.minimoSuc);

      return {
        atributos: 'data-insumo="' + ins.id + '"',
        titulo: ins.name,
        subtitulo: ins.categoria,
        pill: { cls: 'pill--' + estado.tipo, txt: estado.txt },
        datos: [{ lbl: 'Me quedan', val: D.cantidadInsumo(ins.sucStock, ins) }],
        acciones: ins.sucStock > 0
          ? '<button type="button" class="btn btn--ghost" data-descontar ' +
            'data-insumo="' + ins.id + '">Descontar lo que usé</button>' +
            '<a href="06-suc-catalogo.html" class="btn ' +
              (estado.tipo === 'disponible' ? 'btn--ghost' : 'btn--primary') +
              '">Pedir a fábrica</a>'
          : '<a href="06-suc-catalogo.html" class="btn btn--primary">Pedir a fábrica</a>'
      };
    }), 'Todavía no recibiste insumos.');
  }

  function alClickear(e) {
    var btn = e.target.closest('[data-descontar]');
    if (btn) abrirDescontar(btn.dataset.insumo);
  }

  tbody.addEventListener('click', alClickear);
  if (cards) cards.addEventListener('click', alClickear);

  var modal     = document.getElementById('modal-descontar');
  var form      = document.getElementById('form-descontar');
  var texto     = document.getElementById('descontar-texto');
  var quedan    = document.getElementById('descontar-quedan');
  var input     = document.getElementById('inp-descontar');
  var cerrar    = document.getElementById('descontar-cerrar');
  var cancelar  = document.getElementById('descontar-cancelar');
  var error     = document.getElementById('descontar-error');
  var errorTxt  = document.getElementById('descontar-error-text');

  var insumoActual = null;

  function abrirDescontar(supplyId) {
    insumoActual = D.insumo(supplyId);
    if (!insumoActual) return;

    form.reset();
    error.hidden = true;

    texto.textContent = '¿Cuántos ' + insumoActual.plural + ' de ' +
                        insumoActual.name + ' usaste?';
    quedan.textContent = 'Ahora tenés ' + D.cantidadInsumo(insumoActual.sucStock, insumoActual) + '.';

    modal.showModal();
    input.focus();
  }

  function cerrarDescontar() {
    modal.close();
    form.reset();
    error.hidden = true;
    insumoActual = null;
  }

  cerrar.addEventListener('click', cerrarDescontar);
  cancelar.addEventListener('click', cerrarDescontar);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) cerrarDescontar();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!insumoActual) return;

    var cant = parseInt(input.value, 10);

    if (!cant || cant <= 0) {
      mostrarError('Poné cuántos usaste. Tiene que ser más de cero.');
      input.focus();
      return;
    }

    if (cant > insumoActual.sucStock) {
      mostrarError('Solo tenés ' + D.cantidadInsumo(insumoActual.sucStock, insumoActual) +
                   '. Si te quedaste sin nada, poné ' + insumoActual.sucStock + '.');
      input.focus();
      return;
    }

    var ins = insumoActual;
    ins.sucStock -= cant;

    cerrarDescontar();
    render();

    mostrarToast('Descontaste ' + cant.toLocaleString('es-AR') + ' ' +
                 (cant === 1 ? ins.unidad : ins.plural) + ' de ' + ins.name + '.',
      function () {
        ins.sucStock += cant;
        render();
      });
  });

  function mostrarError(msg) {
    errorTxt.textContent = msg;
    error.hidden = false;
  }

  function mostrarToast(mensaje, alDeshacer) {
    clearTimeout(toastTimer);
    toastText.textContent = mensaje;
    deshacer = alDeshacer || null;
    toastUndo.hidden = !alDeshacer;
    toast.hidden = false;
    toastTimer = setTimeout(function () { toast.hidden = true; }, 10000);
  }

  toastClose.addEventListener('click', function () {
    clearTimeout(toastTimer);
    toast.hidden = true;
  });

  toastUndo.addEventListener('click', function () {
    clearTimeout(toastTimer);
    toast.hidden = true;
    if (deshacer) deshacer();
    deshacer = null;
  });

  render();

}());
