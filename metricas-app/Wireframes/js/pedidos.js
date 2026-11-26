(function () {
  'use strict';

  var D = window.DATOS;

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

  var GRUPOS = [
    { estados: ['pendiente'],    label: 'Pendientes de confirmar' },
    { estados: ['contraoferta'], label: 'Esperando respuesta de la sucursal' },
    { estados: ['confirmado'],   label: 'Confirmados, listos para despachar' },
    { estados: ['despachado', 'entregado'], label: 'En camino y entregados' },
    { estados: ['rechazado', 'cancelado'],  label: 'Rechazados y cancelados' }
  ];

  function render() {
    var html = '';

    GRUPOS.forEach(function (grupo) {
      var pedidos = D.PEDIDOS.filter(function (p) {
        return grupo.estados.indexOf(p.status) !== -1;
      });
      if (!pedidos.length) return;

      html += '<tr class="table-group-label" aria-hidden="true">' +
                '<td colspan="6">' + grupo.label + '</td>' +
              '</tr>';

      pedidos.forEach(function (pedido) { html += filaHTML(pedido); });
    });

    tbody.innerHTML = html;
    renderCards();

    var pendientes = D.PEDIDOS.filter(function (p) { return p.status === 'pendiente'; }).length;
    subtitulo.textContent = D.plural(pendientes, 'pedido pendiente de confirmar',
                                                 'pedidos pendientes de confirmar') +
                            ' · Lunes 27 de julio de 2026';
  }

  function filaHTML(pedido) {
    var estado = D.ESTADO_PEDIDO[pedido.status];
    var suc    = D.sucursal(pedido.branch_id);

    return '<tr data-pedido="' + pedido.id + '" data-estado="' + pedido.status + '">' +
             celdasHTML(pedido, suc, estado) +
           '</tr>';
  }

  function celdasHTML(pedido, suc, estado) {
    return '<td class="pedido-id">' + pedido.id + '</td>' +
           '<td>' + suc.name + '</td>' +
           '<td class="col-number">' + D.totalLatas(pedido) + '</td>' +
           '<td class="col-muted">' + pedido.created_at + '</td>' +
           '<td><span class="pill ' + estado.cls + '">' + estado.txt + '</span></td>' +
           '<td class="col-acciones">' + accionesHTML(pedido) + '</td>';
  }

  function accionesHTML(pedido) {
    var ver = '<button type="button" class="btn btn--ghost btn--sm" data-ver ' +
              'aria-label="Ver detalle del pedido ' + pedido.id + '">Ver detalle</button>';

    if (pedido.status === 'pendiente') {
      return ver +
        '<button type="button" class="btn btn--primary btn--sm" data-confirmar ' +
        'aria-label="Confirmar el pedido ' + pedido.id + '">Confirmar</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-contraoferta ' +
        'aria-label="Contraofertar el pedido ' + pedido.id + '">Contraofertar</button>' +
        '<button type="button" class="btn btn--destructive btn--sm" data-rechazar ' +
        'aria-label="Rechazar el pedido ' + pedido.id + '">Rechazar</button>';
    }

    if (pedido.status === 'confirmado') {
      return ver +
        '<button type="button" class="btn btn--primary btn--sm" data-despachar ' +
        'aria-label="Despachar el pedido ' + pedido.id + '">' +
        '<i class="ti ti-truck" aria-hidden="true"></i> Despachar</button>';
    }

    return ver;
  }

  function renderCards() {
    if (!cards) return;

    var html = '';

    GRUPOS.forEach(function (grupo) {
      var pedidos = D.PEDIDOS.filter(function (p) {
        return grupo.estados.indexOf(p.status) !== -1;
      });
      if (!pedidos.length) return;

      html += '<p class="cards-grupo">' + grupo.label + '</p>';

      html += pedidos.map(function (pedido) {
        var estado = D.ESTADO_PEDIDO[pedido.status];

        return window.Tarjetas.tarjeta({
          atributos: 'data-pedido="' + pedido.id + '"',
          titulo: pedido.id,
          subtitulo: D.sucursal(pedido.branch_id).name,
          pill: { cls: estado.cls, txt: estado.txt },
          datos: [
            { lbl: 'Latas', val: D.totalLatas(pedido) },
            { lbl: 'Recibido', val: pedido.created_at }
          ],
          acciones: accionesHTML(pedido)
        });
      }).join('');
    });

    cards.innerHTML = html ||
      '<p class="cards-vacio">Todavía no llegó ningún pedido.</p>';
  }

  function pedidoDe(el) {
    var fila = el.closest('tr[data-pedido], .data-card[data-pedido]');
    if (!fila) return null;
    var id = fila.dataset.pedido;
    return D.PEDIDOS.filter(function (p) { return p.id === id; })[0] || null;
  }

  function alClickear(e) {
    var btn = e.target.closest('button[data-ver], button[data-confirmar], ' +
                               'button[data-contraoferta], button[data-rechazar], ' +
                               'button[data-despachar]');
    if (!btn) return;

    var pedido = pedidoDe(btn);
    if (!pedido) return;

    if (btn.hasAttribute('data-ver'))          abrirDetalle(pedido);
    if (btn.hasAttribute('data-confirmar'))    abrirAsignacion(pedido, 'confirmar');
    if (btn.hasAttribute('data-contraoferta')) abrirContraoferta(pedido);
    if (btn.hasAttribute('data-rechazar'))     abrirRechazar(pedido);
    if (btn.hasAttribute('data-despachar'))    abrirAsignacion(pedido, 'despachar');
  }

  tbody.addEventListener('click', alClickear);
  if (cards) cards.addEventListener('click', alClickear);

  var modalDetalle    = document.getElementById('modal-detalle');
  var detalleTitulo   = document.getElementById('detalle-titulo');
  var detalleEstado   = document.getElementById('detalle-estado');
  var detalleBody     = document.getElementById('detalle-body');
  var detalleCerrar   = document.getElementById('detalle-cerrar');
  var detalleCancelar = document.getElementById('detalle-cancelar');

  function abrirDetalle(pedido) {
    var estado = D.ESTADO_PEDIDO[pedido.status];
    var suc    = D.sucursal(pedido.branch_id);
    var esOferta = pedido.status === 'contraoferta';
    var yaConfirmado = ['confirmado', 'despachado', 'entregado'].indexOf(pedido.status) !== -1;

    detalleTitulo.textContent = 'Pedido ' + pedido.id;
    detalleEstado.className   = 'pill ' + estado.cls;
    detalleEstado.textContent = estado.txt;

    var html = '<p class="confirm-note" style="margin-top:0;">' +
               suc.name + ' · Recibido: ' + pedido.created_at + '</p>';

    if (pedido.branchNotes) {
      html += '<div class="pedido-nota">' +
                '<span class="pedido-nota-quien">Nota de la sucursal</span>' +
                pedido.branchNotes +
              '</div>';
    }

    if (pedido.adminNotes) {
      html += '<div class="pedido-nota">' +
                '<span class="pedido-nota-quien">Tu nota (Fábrica)</span>' +
                pedido.adminNotes +
              '</div>';
    }

    html += '<table class="data-table" aria-label="Ítems del pedido">' +
              '<thead><tr>' +
                '<th scope="col">Sabor</th>' +
                '<th scope="col">' + (yaConfirmado ? 'Confirmadas' : 'Pedidas') + '</th>' +
                (esOferta ? '<th scope="col">Ofrecidas</th>' : '') +
              '</tr></thead><tbody>';

    pedido.items.forEach(function (item) {
      var sabor = D.sabor(item.flavor_id);
      html += '<tr>' +
                '<td>' + sabor.name + '</td>' +
                '<td class="col-number">' +
                  (yaConfirmado ? D.cantidadVigente(item) : item.quantity) +
                '</td>' +
                (esOferta ? '<td class="col-number">' + item.approvedQuantity + '</td>' : '') +
              '</tr>';

      if (item.assignedTubs && item.assignedTubs.length) {
        html += '<tr><td colspan="' + (esOferta ? 3 : 2) + '" class="latas-asignadas">' +
                  '<p class="latas-asignadas-titulo">Latas asignadas</p>';
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
    if (final > 0) {
      html += '<div class="pedido-precio">Precio final ' +
                '<strong class="pedido-precio-valor">' + D.fmtPrecio(final) + '</strong></div>';
    } else {
      html += '<div class="pedido-precio">Precio estimado ' +
                '<strong class="pedido-precio-valor">' +
                D.fmtPrecio(D.precioEstimado(pedido)) + '</strong></div>';
    }

    detalleBody.innerHTML = html;
    detalleBody.scrollTop = 0;
    modalDetalle.showModal();
  }

  cerrarCon(modalDetalle, [detalleCerrar, detalleCancelar]);

  var ASIG = {
    confirmar: {
      dialog:  document.getElementById('modal-confirmar'),
      body:    document.getElementById('confirmar-body'),
      status:  document.getElementById('confirmar-status'),
      aceptar: document.getElementById('confirmar-aceptar'),
      cerrar:  document.getElementById('confirmar-cerrar'),
      cancelar: document.getElementById('confirmar-cancelar'),
      permiteParcial: false
    },
    despachar: {
      dialog:  document.getElementById('modal-despachar'),
      body:    document.getElementById('despachar-body'),
      status:  document.getElementById('despachar-status'),
      aceptar: document.getElementById('despachar-confirmar'),
      cerrar:  document.getElementById('despachar-cerrar'),
      cancelar: document.getElementById('despachar-cancelar'),
      permiteParcial: true
    }
  };

  var sesion = null;

  function abrirAsignacion(pedido, modo) {
    var cfg = ASIG[modo];

    sesion = {
      pedido: pedido,
      modo: modo,
      asignadas: {},
      error: '',
      busqueda: ''
    };

    pedido.items.forEach(function (item) { sesion.asignadas[item.flavor_id] = []; });

    renderAsignacion();
    cfg.dialog.showModal();

    sesion.escaner = window.Escaner.activar(function (codigo) {
      asignarPorCodigo(codigo);
    });

    enfocarBuscador();
  }

  function enfocarBuscador() {
    if (!sesion) return;
    var input = ASIG[sesion.modo].body.querySelector('[data-buscar]');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function cerrarAsignacion() {
    if (!sesion) return;
    var cfg = ASIG[sesion.modo];
    if (sesion.escaner) sesion.escaner.desactivar();
    cfg.dialog.close();
    cfg.body.innerHTML = '';
    cfg.status.textContent = '';
    sesion = null;
  }

  function faltantes(item) {
    return Math.max(0, D.cantidadVigente(item) - sesion.asignadas[item.flavor_id].length);
  }

  function totalAsignadas() {
    return Object.keys(sesion.asignadas).reduce(function (acc, k) {
      return acc + sesion.asignadas[k].length;
    }, 0);
  }

  function pesoAsignado() {
    return Object.keys(sesion.asignadas).reduce(function (acc, k) {
      return acc + sesion.asignadas[k].reduce(function (sub, l) {
        return sub + l.net_weight;
      }, 0);
    }, 0);
  }

  function renderAsignacion() {
    var cfg    = ASIG[sesion.modo];
    var pedido = sesion.pedido;
    var suc    = D.sucursal(pedido.branch_id);
    var pedidas = D.totalLatas(pedido);
    var puestas = totalAsignadas();

    var html = '<p class="confirm-note" style="margin-top:0;">' +
               suc.name + ' · ' + D.plural(pedidas, 'lata pedida', 'latas pedidas') + '</p>';

    html += '<div class="scan-hint">' +
              '<i class="ti ti-barcode" aria-hidden="true"></i>' +
              '<div>' +
                '<p class="scan-hint-titulo">Escaneá cada lata con la pistola</p>' +
                '<p class="scan-hint-texto">Se asigna sola al sabor que corresponde. ' +
                'También podés buscarla por código o por sabor acá abajo.</p>' +
              '</div>' +
            '</div>';

    var idBuscar = 'asig-buscar-' + sesion.modo;
    var idLista  = 'asig-resultados-' + sesion.modo;

    html += '<div class="scan-search">' +
              '<div class="field-group">' +
                '<label class="field-label" for="' + idBuscar + '">Buscar lata</label>' +
                '<input class="field-input" type="text" id="' + idBuscar + '" ' +
                'data-buscar autocomplete="off" role="combobox" ' +
                'aria-expanded="' + (sesion.busqueda ? 'true' : 'false') + '" ' +
                'aria-controls="' + idLista + '" ' +
                'placeholder="Código o sabor. Ej: LB-CAR-001 o Carioca" ' +
                'value="' + escapar(sesion.busqueda) + '">' +
              '</div>' +
              '<button type="button" class="btn btn--ghost" data-asignar-primero>Asignar</button>' +
            '</div>';

    html += '<ul class="scan-results" id="' + idLista + '" data-resultados role="listbox" ' +
            'aria-label="Latas encontradas">' + resultadosHTML() + '</ul>';

    if (sesion.error) {
      html += '<div class="alert alert--error" role="alert">' +
                '<i class="ti ti-alert-circle" aria-hidden="true"></i>' +
                '<span>' + sesion.error + '</span>' +
              '</div>';
    }

    pedido.items.forEach(function (item) {
      var sabor  = D.sabor(item.flavor_id);
      var puesto = sesion.asignadas[item.flavor_id];
      var pide   = D.cantidadVigente(item);
      var listo  = puesto.length >= pide;

      html += '<div class="asig-grupo' + (listo ? ' asig-grupo--completo' : '') + '">' +
                '<div class="asig-head">' +
                  '<span class="asig-sabor">' + sabor.name + '</span>' +
                  '<span class="asig-count">' + puesto.length + ' de ' + pide + ' asignadas</span>' +
                '</div>';

      if (puesto.length) {
        html += '<div class="asig-chips">';
        puesto.forEach(function (lata) {
          html += '<span class="lata-chip">' +
                    '<span class="lata-chip-codigo">' + lata.internal_code + '</span>' +
                    '<span class="lata-chip-peso">' + D.fmtKg(lata.net_weight) + '</span>' +
                    '<button type="button" class="lata-chip-quitar" data-quitar="' +
                      lata.internal_code + '" aria-label="Quitar la lata ' +
                      lata.internal_code + ' del pedido">Quitar</button>' +
                  '</span>';
        });
        html += '</div>';
      }

      html += '</div>';
    });

    html += '<div class="despacho-total" aria-live="polite">' +
              '<span>Peso total asignado</span>' +
              '<strong class="despacho-total-valor">' + D.fmtKg(pesoAsignado()) + '</strong>' +
            '</div>';

    var insumos = D.insumosDe(pedido);
    if (insumos.length) {
      html += '<p class="cards-grupo" style="margin-top:var(--space-4);">' +
              'Insumos que van en el mismo envío</p>';

      insumos.forEach(function (item) {
        var ins = D.insumo(item.supply_id);
        if (!ins) return;

        html += '<div class="asig-grupo">' +
                  '<div class="asig-head">' +
                    '<span class="asig-sabor">' + ins.name + '</span>' +
                    '<span class="asig-count">' +
                      D.cantidadInsumo(D.cantidadVigente(item), ins) +
                    '</span>' +
                  '</div>' +
                '</div>';
      });
    }

    cfg.body.innerHTML = html;

    var completo = puestas >= pedidas;

    if (completo) {
      cfg.status.textContent = 'Listo para ' + (sesion.modo === 'confirmar' ? 'confirmar' : 'despachar');
      cfg.aceptar.disabled = false;
      cfg.aceptar.innerHTML = sesion.modo === 'confirmar'
        ? '<i class="ti ti-check" aria-hidden="true"></i> Sí, confirmar'
        : '<i class="ti ti-truck" aria-hidden="true"></i> Sí, despachar';

    } else if (cfg.permiteParcial && puestas > 0) {
      cfg.status.textContent = 'Vas a despachar ' + puestas + ' de ' + pedidas +
                               ' latas. La sucursal va a ver la diferencia.';
      cfg.aceptar.disabled = false;
      cfg.aceptar.innerHTML = '<i class="ti ti-truck" aria-hidden="true"></i> Despachar ' +
                              puestas + ' de ' + pedidas + ' igual';

    } else {
      cfg.status.textContent = 'Faltan ' + (pedidas - puestas) + ' latas por asignar.';
      cfg.aceptar.disabled = true;
      cfg.aceptar.innerHTML = sesion.modo === 'confirmar'
        ? '<i class="ti ti-check" aria-hidden="true"></i> Sí, confirmar'
        : '<i class="ti ti-truck" aria-hidden="true"></i> Sí, despachar';
    }
  }

  function resultadosHTML() {
    if (!sesion.busqueda) return '';

    var flavorIds = sesion.pedido.items.map(function (i) { return i.flavor_id; });
    var encontradas = D.buscarLatas(sesion.busqueda, flavorIds).filter(function (l) {
      return !estaAsignada(l.internal_code);
    });

    if (!encontradas.length) {
      return '<li class="scan-results-mas">No hay latas en stock que coincidan con ' +
             '“' + escapar(sesion.busqueda) + '”.</li>';
    }

    var visibles = encontradas.slice(0, 6);
    var html = visibles.map(function (lata) {
      return '<li role="option" aria-selected="false">' +
               '<button type="button" class="scan-result" data-asignar="' +
                 lata.internal_code + '">' +
                 '<span class="scan-result-codigo">' + lata.internal_code + '</span>' +
                 '<span class="scan-result-meta">' + lata.flavor_name + ' · ' +
                   D.fmtKg(lata.net_weight) + '</span>' +
               '</button>' +
             '</li>';
    }).join('');

    if (encontradas.length > visibles.length) {
      html += '<li class="scan-results-mas">y ' + (encontradas.length - visibles.length) +
              ' más. Seguí escribiendo.</li>';
    }

    return html;
  }

  function estaAsignada(codigo) {
    return Object.keys(sesion.asignadas).some(function (k) {
      return sesion.asignadas[k].some(function (l) { return l.internal_code === codigo; });
    });
  }

  function asignarPorCodigo(codigo) {
    if (!sesion) return;

    var lata = D.lataPorCodigo(codigo);

    if (!lata) {
      fallo('No encontramos ninguna lata con el código ' + codigo + '.');
      return;
    }

    if (lata.status !== 'in_stock') {
      fallo('La lata ' + lata.internal_code + ' ya salió en otro pedido.');
      return;
    }

    if (estaAsignada(lata.internal_code)) {
      fallo('La lata ' + lata.internal_code + ' ya está en la lista.');
      return;
    }

    var item = sesion.pedido.items.filter(function (i) {
      return i.flavor_id === lata.flavor_id;
    })[0];

    if (!item) {
      fallo('Esa lata es de ' + lata.flavor_name + ' y este pedido no lleva ' +
            lata.flavor_name + '.');
      return;
    }

    if (faltantes(item) === 0) {
      fallo('Ya asignaste las ' + D.cantidadVigente(item) + ' latas de ' +
            lata.flavor_name + ' que pide el pedido.');
      return;
    }

    sesion.asignadas[lata.flavor_id].push(lata);
    sesion.error = '';
    sesion.busqueda = '';
    renderAsignacion();
    enfocarBuscador();
  }

  function fallo(mensaje) {
    sesion.error = mensaje;
    renderAsignacion();
    enfocarBuscador();
  }

  ['confirmar', 'despachar'].forEach(function (modo) {
    var cfg = ASIG[modo];

    cfg.body.addEventListener('input', function (e) {
      if (!e.target.hasAttribute('data-buscar') || !sesion) return;
      sesion.busqueda = e.target.value;
      sesion.error = '';

      cfg.body.querySelector('[data-resultados]').innerHTML = resultadosHTML();
      e.target.setAttribute('aria-expanded', sesion.busqueda ? 'true' : 'false');
    });

    cfg.body.addEventListener('keydown', function (e) {
      if (!e.target.hasAttribute('data-buscar') || e.key !== 'Enter' || !sesion) return;
      e.preventDefault();
      asignarPrimerResultado();
    });

    cfg.body.addEventListener('click', function (e) {
      if (!sesion) return;

      var asignar = e.target.closest('[data-asignar]');
      if (asignar) { asignarPorCodigo(asignar.dataset.asignar); return; }

      var quitar = e.target.closest('[data-quitar]');
      if (quitar) { quitarLata(quitar.dataset.quitar); return; }

      if (e.target.closest('[data-asignar-primero]')) { asignarPrimerResultado(); }
    });

    cfg.cerrar.addEventListener('click', cerrarAsignacion);
    cfg.cancelar.addEventListener('click', cerrarAsignacion);
    cfg.dialog.addEventListener('click', function (e) {
      if (e.target === cfg.dialog) cerrarAsignacion();
    });

    cfg.aceptar.addEventListener('click', function () {
      if (modo === 'confirmar') confirmarPedido();
      else despacharPedido();
    });
  });

  function asignarPrimerResultado() {
    var flavorIds = sesion.pedido.items.map(function (i) { return i.flavor_id; });
    var encontradas = D.buscarLatas(sesion.busqueda, flavorIds).filter(function (l) {
      return !estaAsignada(l.internal_code);
    });

    if (!encontradas.length) {
      fallo('Escribí un código o un sabor para encontrar la lata.');
      return;
    }
    asignarPorCodigo(encontradas[0].internal_code);
  }

  function quitarLata(codigo) {
    Object.keys(sesion.asignadas).forEach(function (k) {
      sesion.asignadas[k] = sesion.asignadas[k].filter(function (l) {
        return l.internal_code !== codigo;
      });
    });
    sesion.error = '';
    renderAsignacion();
    enfocarBuscador();
  }

  function guardarAsignacion(pedido) {
    pedido.items.forEach(function (item) {
      var latas = sesion.asignadas[item.flavor_id] || [];
      item.assignedTubs = latas.map(function (l) { return l.internal_code; });
      latas.forEach(function (l) {
        l.status   = 'in_transit';
        l.order_id = pedido.id;
      });
    });
  }

  function confirmarPedido() {
    var pedido = sesion.pedido;
    guardarAsignacion(pedido);
    pedido.status = 'confirmado';
    cerrarAsignacion();
    render();
    mostrarToast('Pedido ' + pedido.id + ' confirmado con ' +
                 D.totalLatas(pedido) + ' latas. Listo para despachar.');
  }

  function despacharPedido() {
    var pedido = sesion.pedido;
    var puestas = totalAsignadas();
    var peso = pesoAsignado();

    guardarAsignacion(pedido);
    pedido.status = 'despachado';
    cerrarAsignacion();
    render();

    mostrarToast('Pedido ' + pedido.id + ' despachado con ' +
                 D.plural(puestas, 'lata', 'latas') + ' · ' + D.fmtKg(peso) +
                 '. La sucursal fue notificada.');
  }

  var modalOferta   = document.getElementById('modal-contraoferta');
  var ofertaItems   = document.getElementById('contraoferta-items');
  var ofertaNota    = document.getElementById('contraoferta-nota');
  var ofertaCerrar  = document.getElementById('contraoferta-cerrar');
  var ofertaCancelar = document.getElementById('contraoferta-cancelar');
  var ofertaEnviar  = document.getElementById('contraoferta-enviar');

  var pedidoOferta = null;

  function abrirContraoferta(pedido) {
    pedidoOferta = pedido;
    ofertaNota.value = '';

    ofertaItems.innerHTML = pedido.items.map(function (item) {
      var sabor = D.sabor(item.flavor_id);
      var stock = D.stockDe(item.flavor_id);
      var tope  = Math.min(item.quantity, stock);
      var falta = stock < item.quantity;

      return '<div class="oferta-fila">' +
               '<div>' +
                 '<p class="oferta-sabor">' + sabor.name + '</p>' +
                 '<p class="oferta-meta">Pidieron: ' + item.quantity + ' · ' +
                   '<span class="' + (falta ? 'oferta-meta--falta' : '') + '">En stock: ' +
                   stock + '</span></p>' +
               '</div>' +
               '<div class="field-group" style="margin-bottom:0;">' +
                 '<label class="field-label" for="oferta-' + item.flavor_id + '">Ofrecer</label>' +
                 '<input class="oferta-input" type="number" min="0" max="' + tope + '" ' +
                   'id="oferta-' + item.flavor_id + '" data-flavor="' + item.flavor_id + '" ' +
                   'value="' + tope + '">' +
               '</div>' +
             '</div>';
    }).join('');

    modalOferta.showModal();
  }

  ofertaEnviar.addEventListener('click', function () {
    if (!pedidoOferta) return;

    ofertaItems.querySelectorAll('[data-flavor]').forEach(function (input) {
      var item = pedidoOferta.items.filter(function (i) {
        return i.flavor_id === input.dataset.flavor;
      })[0];
      if (item) item.approvedQuantity = parseInt(input.value, 10) || 0;
    });

    pedidoOferta.adminNotes = ofertaNota.value.trim();
    pedidoOferta.status = 'contraoferta';

    var id = pedidoOferta.id;
    pedidoOferta = null;
    modalOferta.close();
    render();
    mostrarToast('Contraoferta enviada. ' + id + ' queda esperando que la sucursal responda.');
  });

  cerrarCon(modalOferta, [ofertaCerrar, ofertaCancelar], function () { pedidoOferta = null; });

  var modalRechazar     = document.getElementById('modal-rechazar');
  var rechazarTexto     = document.getElementById('rechazar-texto');
  var rechazarCerrar    = document.getElementById('rechazar-cerrar');
  var rechazarCancelar  = document.getElementById('rechazar-cancelar');
  var rechazarConfirmar = document.getElementById('rechazar-confirmar');

  var pedidoRechazo = null;

  function abrirRechazar(pedido) {
    pedidoRechazo = pedido;
    rechazarTexto.textContent =
      'Vas a rechazar el pedido ' + pedido.id + ' de ' +
      D.sucursal(pedido.branch_id).name + '. No se puede deshacer. ¿Confirmás?';
    modalRechazar.showModal();
  }

  rechazarConfirmar.addEventListener('click', function () {
    if (!pedidoRechazo) return;
    var id = pedidoRechazo.id;
    pedidoRechazo.status = 'rechazado';
    pedidoRechazo = null;
    modalRechazar.close();
    render();
    mostrarToast('Pedido ' + id + ' rechazado.');
  });

  cerrarCon(modalRechazar, [rechazarCerrar, rechazarCancelar], function () {
    pedidoRechazo = null;
  });

  function cerrarCon(dialog, botones, alCerrar) {
    function cerrar() {
      dialog.close();
      if (alCerrar) alCerrar();
    }
    botones.forEach(function (b) { b.addEventListener('click', cerrar); });
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) cerrar();
    });
  }

  function escapar(texto) {
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
