(function () {
  'use strict';

  var D   = window.DATOS;
  var MIA = D.SUCURSAL_ACTUAL;

  var tbody     = document.getElementById('pedidos-body');
  var cards     = document.getElementById('pedidos-cards');
  var subtitulo = document.getElementById('pedidos-subtitulo');
  if (!tbody) return;

  var toast      = document.getElementById('toast');
  var toastText  = document.getElementById('toast-text');
  var toastUndo  = document.getElementById('toast-undo');
  var toastClose = document.getElementById('toast-close');

  var toastTimer = null;
  var deshacer   = null;

  function misPedidos() {
    return D.PEDIDOS.filter(function (p) { return p.branch_id === MIA; });
  }

  var GRUPOS = [
    { estados: ['despachado'],   label: 'En camino · para recibir' },
    { estados: ['contraoferta'], label: 'La fábrica te hizo una oferta' },
    { estados: ['pendiente'],    label: 'Esperando confirmación' },
    { estados: ['confirmado'],   label: 'Confirmados por la fábrica' },
    { estados: ['entregado'],    label: 'Recibidos' },
    { estados: ['rechazado', 'cancelado'], label: 'Rechazados y cancelados' }
  ];

  function render() {
    var html = '';

    GRUPOS.forEach(function (grupo) {
      var pedidos = misPedidos().filter(function (p) {
        return grupo.estados.indexOf(p.status) !== -1;
      });
      if (!pedidos.length) return;

      html += '<tr class="table-group-label" aria-hidden="true">' +
                '<td colspan="5">' + grupo.label + '</td>' +
              '</tr>';

      pedidos.forEach(function (pedido) {
        var estado = D.ESTADO_PEDIDO[pedido.status];

        html += '<tr data-pedido="' + pedido.id + '" data-estado="' + pedido.status + '">' +
                  '<td class="pedido-id">' + pedido.id + '</td>' +
                  '<td class="col-number">' + D.totalLatas(pedido) + '</td>' +
                  '<td class="col-muted">' + pedido.created_at + '</td>' +
                  '<td><span class="pill ' + estado.cls + '">' +
                    etiquetaSucursal(pedido) + '</span></td>' +
                  '<td class="col-acciones">' + accionesHTML(pedido) + '</td>' +
                '</tr>';
      });
    });

    tbody.innerHTML = html;
    renderCards();

    var camino = misPedidos().filter(function (p) { return p.status === 'despachado'; }).length;
    var espera = misPedidos().filter(function (p) { return p.status === 'pendiente'; }).length;

    subtitulo.textContent = D.plural(camino, 'pedido en camino', 'pedidos en camino') +
                            ' · ' + espera + ' esperando confirmación';
  }

  function etiquetaSucursal(pedido) {
    if (pedido.status === 'despachado')   return 'En camino';
    if (pedido.status === 'contraoferta') return 'Te ofrecen menos';
    if (pedido.status === 'entregado')    return 'Recibido';
    return D.ESTADO_PEDIDO[pedido.status].txt;
  }

  function accionesHTML(pedido) {
    var ver = '<button type="button" class="btn btn--ghost btn--sm" data-ver ' +
              'aria-label="Ver detalle del pedido ' + pedido.id + '">Ver detalle</button>';

    if (pedido.status === 'despachado') {
      return ver +
        '<button type="button" class="btn btn--primary btn--sm" data-recibir ' +
        'aria-label="Confirmar recepción del pedido ' + pedido.id + '">' +
        '<i class="ti ti-package-import" aria-hidden="true"></i> Confirmar recepción</button>';
    }

    if (pedido.status === 'contraoferta') {
      return ver +
        '<button type="button" class="btn btn--primary btn--sm" data-ver ' +
        'aria-label="Responder la oferta del pedido ' + pedido.id + '">Responder oferta</button>';
    }

    if (pedido.status === 'pendiente') {
      return ver +
        '<button type="button" class="btn btn--ghost btn--sm" data-cancelar ' +
        'aria-label="Cancelar el pedido ' + pedido.id + '">Cancelar</button>';
    }

    return ver;
  }

  function renderCards() {
    if (!cards) return;

    var html = '';

    GRUPOS.forEach(function (grupo) {
      var pedidos = misPedidos().filter(function (p) {
        return grupo.estados.indexOf(p.status) !== -1;
      });
      if (!pedidos.length) return;

      html += '<p class="cards-grupo">' + grupo.label + '</p>';

      html += pedidos.map(function (pedido) {
        var estado = D.ESTADO_PEDIDO[pedido.status];

        return window.Tarjetas.tarjeta({
          atributos: 'data-pedido="' + pedido.id + '"',
          titulo: pedido.id,
          pill: { cls: estado.cls, txt: etiquetaSucursal(pedido) },
          datos: [
            { lbl: 'Latas', val: D.totalLatas(pedido) },
            { lbl: 'Enviado', val: pedido.created_at }
          ],
          acciones: accionesHTML(pedido)
        });
      }).join('');
    });

    cards.innerHTML = html ||
      '<p class="cards-vacio">Todavía no hiciste ningún pedido.</p>';
  }

  function pedidoDe(el) {
    var fila = el.closest('tr[data-pedido], .data-card[data-pedido]');
    if (!fila) return null;
    var id = fila.dataset.pedido;
    return D.PEDIDOS.filter(function (p) { return p.id === id; })[0] || null;
  }

  function alClickear(e) {
    var btn = e.target.closest('button[data-ver], button[data-recibir], button[data-cancelar]');
    if (!btn) return;

    var pedido = pedidoDe(btn);
    if (!pedido) return;

    if (btn.hasAttribute('data-ver'))      abrirDetalle(pedido);
    if (btn.hasAttribute('data-recibir'))  abrirRecibir(pedido);
    if (btn.hasAttribute('data-cancelar')) abrirCancelar(pedido);
  }

  tbody.addEventListener('click', alClickear);
  if (cards) cards.addEventListener('click', alClickear);

  var modalDetalle  = document.getElementById('modal-detalle');
  var detalleTitulo = document.getElementById('detalle-titulo');
  var detalleEstado = document.getElementById('detalle-estado');
  var detalleBody   = document.getElementById('detalle-body');
  var detalleFooter = document.getElementById('detalle-footer');
  var detalleCerrar = document.getElementById('detalle-cerrar');

  var pedidoDetalle = null;

  function abrirDetalle(pedido) {
    pedidoDetalle = pedido;

    var estado     = D.ESTADO_PEDIDO[pedido.status];
    var esOferta   = pedido.status === 'contraoferta';
    var confirmado = ['confirmado', 'despachado', 'entregado'].indexOf(pedido.status) !== -1;

    detalleTitulo.textContent = 'Pedido ' + pedido.id;
    detalleEstado.className   = 'pill ' + estado.cls;
    detalleEstado.textContent = etiquetaSucursal(pedido);

    var html = '<p class="confirm-note" style="margin-top:0;">Enviado: ' +
               pedido.created_at + '</p>';

    if (pedido.adminNotes) {
      html += '<div class="pedido-nota">' +
                '<span class="pedido-nota-quien">Nota de la fábrica</span>' +
                pedido.adminNotes +
              '</div>';
    }

    if (pedido.branchNotes) {
      html += '<div class="pedido-nota">' +
                '<span class="pedido-nota-quien">Tu nota</span>' +
                pedido.branchNotes +
              '</div>';
    }

    html += '<table class="data-table" aria-label="Ítems del pedido">' +
              '<thead><tr>' +
                '<th scope="col">Sabor</th>' +
                '<th scope="col">' + (confirmado ? 'Confirmadas' : 'Pedidas') + '</th>' +
                (esOferta ? '<th scope="col">Te ofrecen</th>' : '') +
              '</tr></thead><tbody>';

    pedido.items.forEach(function (item) {
      var sabor = D.sabor(item.flavor_id);

      html += '<tr>' +
                '<td>' + sabor.name + '</td>' +
                '<td class="col-number">' +
                  (confirmado ? D.cantidadVigente(item) : item.quantity) +
                '</td>' +
                (esOferta ? '<td class="col-number">' + item.approvedQuantity + '</td>' : '') +
              '</tr>';

      if (item.assignedTubs && item.assignedTubs.length) {
        html += '<tr><td colspan="' + (esOferta ? 3 : 2) + '" class="latas-asignadas">' +
                  '<p class="latas-asignadas-titulo">Latas que te mandaron</p>';
        item.assignedTubs.forEach(function (codigo) {
          var lata = D.lataPorCodigo(codigo);
          html += '<div class="latas-asignadas-fila">' +
                    '<span class="latas-asignadas-codigo">' + codigo + '</span>' +
                    '<span class="latas-asignadas-peso">' +
                      (lata ? D.fmtKg(lata.net_weight) + ' · ' + D.fmtPrecio(lata.total_price) : '—') +
                    '</span>' +
                  '</div>';
        });
        html += '</td></tr>';
      }
    });

    html += '</tbody></table>';

    var insumos = D.insumosDe(pedido);
    if (insumos.length) {
      html += '<p class="cards-grupo" style="margin-top:var(--space-4);">Insumos</p>';
      html += '<table class="data-table" aria-label="Insumos del pedido">' +
                '<thead><tr>' +
                  '<th scope="col">Insumo</th>' +
                  '<th scope="col">Cantidad</th>' +
                '</tr></thead><tbody>';

      insumos.forEach(function (item) {
        var ins = D.insumo(item.supply_id);
        if (!ins) return;
        html += '<tr>' +
                  '<td>' + ins.name + '</td>' +
                  '<td class="col-number">' +
                    D.cantidadInsumo(D.cantidadVigente(item), ins) +
                  '</td>' +
                '</tr>';
      });

      html += '</tbody></table>';
    }

    var final = D.precioFinal(pedido);
    html += final > 0
      ? '<div class="pedido-precio">Precio final <strong class="pedido-precio-valor">' +
          D.fmtPrecio(final) + '</strong></div>'
      : '<div class="pedido-precio">Precio estimado <strong class="pedido-precio-valor">' +
          D.fmtPrecio(D.precioEstimado(pedido)) + '</strong></div>';

    detalleBody.innerHTML = html;
    detalleBody.scrollTop = 0;

    detalleFooter.innerHTML = esOferta
      ? '<button type="button" class="btn btn--destructive" id="detalle-rechazar-oferta">' +
          'Rechazar la oferta</button>' +
        '<button type="button" class="btn btn--primary btn--lg" id="detalle-aceptar-oferta">' +
          '<i class="ti ti-check" aria-hidden="true"></i> Aceptar la oferta</button>'
      : '<button type="button" class="btn btn--ghost" id="detalle-cancelar">Cerrar</button>';

    modalDetalle.showModal();
  }

  detalleFooter.addEventListener('click', function (e) {
    if (e.target.closest('#detalle-cancelar'))        { cerrarDetalle(); return; }
    if (e.target.closest('#detalle-aceptar-oferta'))  { aceptarOferta(); return; }
    if (e.target.closest('#detalle-rechazar-oferta')) { abrirRechazarOferta(); }
  });

  function cerrarDetalle() {
    modalDetalle.close();
    pedidoDetalle = null;
  }

  detalleCerrar.addEventListener('click', cerrarDetalle);
  modalDetalle.addEventListener('click', function (e) {
    if (e.target === modalDetalle) cerrarDetalle();
  });

  function aceptarOferta() {
    var pedido = pedidoDetalle;
    if (!pedido) return;

    pedido.status = 'confirmado';
    cerrarDetalle();
    render();
    mostrarToast('Aceptaste la oferta. El pedido ' + pedido.id +
                 ' queda confirmado con ' + D.totalLatas(pedido) + ' latas.');
  }

  var modalOferta    = document.getElementById('modal-rechazar-oferta');
  var ofertaNota     = document.getElementById('oferta-nota');
  var ofertaCerrar   = document.getElementById('oferta-cerrar');
  var ofertaVolver   = document.getElementById('oferta-volver');
  var ofertaRechazar = document.getElementById('oferta-rechazar');

  var pedidoOferta = null;

  function abrirRechazarOferta() {
    pedidoOferta = pedidoDetalle;
    ofertaNota.value = '';
    modalDetalle.close();
    modalOferta.showModal();
  }

  ofertaRechazar.addEventListener('click', function () {
    if (!pedidoOferta) return;

    var pedido = pedidoOferta;
    pedido.status = 'pendiente';
    if (ofertaNota.value.trim()) pedido.branchNotes = ofertaNota.value.trim();
    pedido.items.forEach(function (item) { delete item.approvedQuantity; });

    pedidoOferta = null;
    modalOferta.close();
    render();
    mostrarToast('Rechazaste la oferta. El pedido ' + pedido.id +
                 ' vuelve a quedar pendiente con lo que habías pedido.');
  });

  ofertaVolver.addEventListener('click', function () {
    var pedido = pedidoOferta;
    pedidoOferta = null;
    modalOferta.close();
    if (pedido) abrirDetalle(pedido);
  });

  ofertaCerrar.addEventListener('click', function () {
    pedidoOferta = null;
    modalOferta.close();
  });

  var modalRecibir     = document.getElementById('modal-recibir');
  var recibirTexto     = document.getElementById('recibir-texto');
  var recibirDif       = document.getElementById('recibir-dif');
  var recibirCerrar    = document.getElementById('recibir-cerrar');
  var recibirCancelar  = document.getElementById('recibir-cancelar');
  var recibirConfirmar = document.getElementById('recibir-confirmar');

  var pedidoRecibir = null;

  function abrirRecibir(pedido) {
    pedidoRecibir = pedido;
    recibirDif.value = '';
    recibirTexto.textContent = '¿Llegó todo bien del pedido ' + pedido.id + '?';
    modalRecibir.showModal();
  }

  recibirConfirmar.addEventListener('click', function () {
    if (!pedidoRecibir) return;

    var pedido = pedidoRecibir;
    var dif    = recibirDif.value.trim();

    pedido.status = 'entregado';
    if (dif) pedido.branchNotes = dif;

    pedido.items.forEach(function (item) {
      (item.assignedTubs || []).forEach(function (codigo) {
        var lata = D.lataPorCodigo(codigo);
        if (lata) {
          lata.branch_id = MIA;
          lata.status    = 'in_stock';
        }
      });
    });

    D.insumosDe(pedido).forEach(function (item) {
      var ins = D.insumo(item.supply_id);
      if (ins) ins.sucStock += D.cantidadVigente(item);
    });

    pedidoRecibir = null;
    modalRecibir.close();
    render();

    mostrarToast(dif
      ? 'Recepción confirmada con una diferencia anotada. La fábrica la va a ver.'
      : 'Listo. Recibiste el pedido ' + pedido.id + ' y ya está en tu inventario.');
  });

  function cerrarRecibir() {
    modalRecibir.close();
    pedidoRecibir = null;
  }

  recibirCerrar.addEventListener('click', cerrarRecibir);
  recibirCancelar.addEventListener('click', cerrarRecibir);
  modalRecibir.addEventListener('click', function (e) {
    if (e.target === modalRecibir) cerrarRecibir();
  });

  var modalCancelar     = document.getElementById('modal-cancelar');
  var cancelarTexto     = document.getElementById('cancelar-texto');
  var cancelarCerrar    = document.getElementById('cancelar-cerrar');
  var cancelarVolver    = document.getElementById('cancelar-volver');
  var cancelarConfirmar = document.getElementById('cancelar-confirmar');

  var pedidoCancelar = null;

  function abrirCancelar(pedido) {
    pedidoCancelar = pedido;
    cancelarTexto.textContent = 'Vas a cancelar el pedido ' + pedido.id +
                                '. La fábrica ya no lo va a preparar. ¿Confirmás?';
    modalCancelar.showModal();
  }

  cancelarConfirmar.addEventListener('click', function () {
    if (!pedidoCancelar) return;
    var id = pedidoCancelar.id;
    pedidoCancelar.status = 'cancelado';
    pedidoCancelar = null;
    modalCancelar.close();
    render();
    mostrarToast('Pedido ' + id + ' cancelado.');
  });

  function cerrarCancelar() {
    modalCancelar.close();
    pedidoCancelar = null;
  }

  cancelarCerrar.addEventListener('click', cerrarCancelar);
  cancelarVolver.addEventListener('click', cerrarCancelar);
  modalCancelar.addEventListener('click', function (e) {
    if (e.target === modalCancelar) cerrarCancelar();
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
