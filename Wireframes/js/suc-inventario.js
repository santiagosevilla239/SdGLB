(function () {
  'use strict';

  var D   = window.DATOS;
  var MIA = D.SUCURSAL_ACTUAL;

  var tbody     = document.getElementById('inventario-body');
  var cards     = document.getElementById('inventario-cards');
  var subtitulo = document.getElementById('inventario-subtitulo');
  if (!tbody) return;

  var toast      = document.getElementById('toast');
  var toastText  = document.getElementById('toast-text');
  var toastUndo  = document.getElementById('toast-undo');
  var toastClose = document.getElementById('toast-close');

  var toastTimer = null;
  var deshacer   = null;

  function render() {
    tbody.innerHTML = D.SABORES.map(function (sabor) {
      var latas  = D.latasSucursal(MIA, sabor.id, 'in_stock');
      var estado = D.estadoStockSucursal(latas.length);
      var peso   = latas.reduce(function (a, l) { return a + l.net_weight; }, 0);

      return '<tr data-sabor="' + sabor.id + '">' +
               '<td>' +
                 '<button type="button" class="cell-link" data-detalle ' +
                   'data-sabor="' + sabor.id + '" aria-haspopup="dialog">' +
                   sabor.name +
                 '</button>' +
               '</td>' +
               '<td class="col-number">' + latas.length + '</td>' +
               '<td class="' + (peso ? 'col-number' : 'col-muted') + '">' +
                 (peso ? D.fmtKg(peso) : '—') +
               '</td>' +
               '<td><span class="pill pill--' + estado.tipo + '">' + estado.txt + '</span></td>' +
               '<td class="col-accion">' +
                 '<a href="06-suc-catalogo.html" class="btn btn--ghost btn--sm" data-stop>Pedir</a>' +
               '</td>' +
             '</tr>';
    }).join('');

    renderCards();

    var reponer = D.SABORES.filter(function (s) {
      return D.stockSucursal(MIA, s.id) < 4;
    }).length;

    subtitulo.textContent = D.plural(D.SABORES.length, 'sabor', 'sabores') +
                            ' · ' + reponer + ' para reponer · actualizado recién';
  }

  function renderCards() {
    window.Tarjetas.render(cards, D.SABORES.map(function (sabor) {
      var latas  = D.latasSucursal(MIA, sabor.id, 'in_stock');
      var estado = D.estadoStockSucursal(latas.length);
      var peso   = latas.reduce(function (a, l) { return a + l.net_weight; }, 0);

      return {
        atributos: 'data-sabor="' + sabor.id + '"',
        titulo: sabor.name,
        pill: { cls: 'pill--' + estado.tipo, txt: estado.txt },
        datos: [
          { lbl: 'En góndola', val: latas.length },
          { lbl: 'Peso disponible', val: peso ? D.fmtKg(peso) : '—' }
        ],

        acciones:
          '<button type="button" class="btn btn--ghost" data-detalle ' +
            'data-sabor="' + sabor.id + '">Ver latas</button>' +
          '<a href="06-suc-catalogo.html" data-stop class="btn ' +
            (estado.tipo === 'disponible' ? 'btn--ghost' : 'btn--primary') +
            '">Pedir a fábrica</a>'
      };
    }), 'Todavía no recibiste mercadería.');
  }

  function alClickear(e) {
    if (e.target.closest('[data-stop]')) return;

    var fila = e.target.closest('tr[data-sabor], .data-card[data-sabor]');
    if (fila) abrirDetalle(fila.dataset.sabor);
  }

  tbody.addEventListener('click', alClickear);
  if (cards) cards.addEventListener('click', alClickear);

  var modalDetalle   = document.getElementById('modal-detalle');
  var detalleTitulo  = document.getElementById('detalle-titulo');
  var detalleEstado  = document.getElementById('detalle-estado');
  var detalleBody    = document.getElementById('detalle-body');
  var detalleCerrar  = document.getElementById('detalle-cerrar');
  var detalleCerrarP = document.getElementById('detalle-cerrar-pie');

  var saborActual = null;

  function abrirDetalle(flavorId) {
    saborActual = flavorId;
    renderDetalle();
    modalDetalle.showModal();
  }

  function renderDetalle() {
    var sabor = D.sabor(saborActual);
    if (!sabor) return;

    var latas  = D.latasSucursal(MIA, sabor.id);
    var enGondola = latas.filter(function (l) { return l.status === 'in_stock'; });
    var estado = D.estadoStockSucursal(enGondola.length);

    detalleTitulo.textContent = sabor.name;
    detalleEstado.className   = 'pill pill--' + estado.tipo;
    detalleEstado.textContent = estado.txt;

    if (!latas.length) {
      detalleBody.innerHTML =
        '<div class="detalle-vacio">' +
          '<i class="ti ti-package-off" aria-hidden="true"></i>' +
          '<p class="detalle-vacio-titulo">No te queda stock de este sabor.</p>' +
          '<p class="detalle-vacio-texto">Pedí más a la fábrica y, cuando llegue, ' +
          'las latas van a aparecer acá con su peso.</p>' +
        '</div>';
      return;
    }

    var peso = enGondola.reduce(function (a, l) { return a + l.net_weight; }, 0);

    var html =
      '<div class="detalle-resumen">' +
        '<div class="resumen-item">' +
          '<span class="resumen-num">' + enGondola.length + '</span>' +
          '<span class="resumen-lbl">latas en góndola</span>' +
        '</div>' +
        '<div class="resumen-item">' +
          '<span class="resumen-num">' + D.fmtKg(peso) + '</span>' +
          '<span class="resumen-lbl">peso disponible</span>' +
        '</div>' +
        '<div class="resumen-item">' +
          '<span class="resumen-num">' + D.fmtPrecio(sabor.price_per_kilo) + '</span>' +
          '<span class="resumen-lbl">precio por kilo</span>' +
        '</div>' +
      '</div>';

    html += '<ul class="lata-list">';
    latas.forEach(function (l) {
      var est = D.ESTADO_LATA[l.status];
      var consumida = l.status === 'consumed';

      html +=
        '<li class="lata-item">' +
          '<div class="lata-id">' +
            '<span class="lata-etiqueta">' + l.internal_code + '</span>' +
            '<span class="lata-detalle">' +
              (l.order_id ? 'Recibida en ' + l.order_id : 'En tu sucursal') +
            '</span>' +
          '</div>' +
          '<div class="lata-pesos">' +
            '<span class="lata-neto">' + D.fmtKg(l.net_weight) + '</span>' +
            '<span class="lata-precio">' + D.fmtPrecio(l.total_price) + '</span>' +
          '</div>' +
          '<div class="lata-meta">' +
            (consumida
              ? '<span class="pill ' + est.cls + '">' + est.txt + '</span>'
              : '<button type="button" class="btn btn--ghost btn--sm" data-consumir="' +
                l.internal_code + '" aria-label="Marcar la lata ' + l.internal_code +
                ' como consumida">Consumir</button>') +
          '</div>' +
        '</li>';
    });
    html += '</ul>';

    detalleBody.innerHTML = html;
  }

  detalleBody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-consumir]');
    if (!btn) return;

    var lata = D.lataPorCodigo(btn.dataset.consumir);
    if (!lata) return;

    lata.status = 'consumed';
    renderDetalle();
    render();

    mostrarToast('Lata ' + lata.internal_code + ' marcada como consumida.', function () {
      lata.status = 'in_stock';
      renderDetalle();
      render();
    });
  });

  function cerrarDetalle() { modalDetalle.close(); }

  detalleCerrar.addEventListener('click', cerrarDetalle);
  detalleCerrarP.addEventListener('click', cerrarDetalle);
  modalDetalle.addEventListener('click', function (e) {
    if (e.target === modalDetalle) cerrarDetalle();
  });

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
