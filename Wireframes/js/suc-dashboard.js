(function () {
  'use strict';

  var D   = window.DATOS;
  var MIA = D.SUCURSAL_ACTUAL;

  var kpiReponer   = document.getElementById('kpi-reponer');
  var kpiCamino    = document.getElementById('kpi-camino');
  var kpiEsperando = document.getElementById('kpi-esperando');
  var kpiGondola   = document.getElementById('kpi-gondola');
  var tablaReponer = document.getElementById('tabla-reponer');
  var tablaPedidos = document.getElementById('tabla-pedidos');
  var subtitulo    = document.getElementById('dash-subtitulo');

  if (!tablaReponer) return;

  function misPedidos(estado) {
    return D.PEDIDOS.filter(function (p) {
      return p.branch_id === MIA && (!estado || p.status === estado);
    });
  }

  var porSabor = D.SABORES.map(function (sabor) {
    var stock = D.stockSucursal(MIA, sabor.id);
    return { sabor: sabor, stock: stock, estado: D.estadoStockSucursal(stock) };
  });

  var reponer = porSabor.filter(function (f) { return f.estado.tipo !== 'disponible'; })
                        .sort(function (a, b) { return a.stock - b.stock; });

  kpiReponer.textContent   = reponer.length;
  kpiCamino.textContent    = misPedidos('despachado').length;
  kpiEsperando.textContent = misPedidos('pendiente').length + misPedidos('contraoferta').length;
  kpiGondola.textContent   = porSabor.filter(function (f) { return f.stock > 0; }).length;

  subtitulo.textContent = 'Lunes 27 de julio de 2026 · Suc. Caballito';

  tablaReponer.innerHTML = reponer.length
    ? reponer.map(function (fila) {
        return '<tr>' +
                 '<td>' + fila.sabor.name + '</td>' +
                 '<td class="col-number">' + fila.stock + '</td>' +
                 '<td><span class="pill pill--' + fila.estado.tipo + '">' +
                   fila.estado.txt + '</span></td>' +
               '</tr>';
      }).join('')
    : '<tr><td colspan="3" class="col-muted">Tenés stock de todos los sabores.</td></tr>';

  function etiqueta(pedido) {
    if (pedido.status === 'despachado')   return 'En camino';
    if (pedido.status === 'contraoferta') return 'Te ofrecen menos';
    if (pedido.status === 'entregado')    return 'Recibido';
    return D.ESTADO_PEDIDO[pedido.status].txt;
  }

  var ultimos = misPedidos().slice(0, 5);

  tablaPedidos.innerHTML = ultimos.map(function (pedido) {
    var estado = D.ESTADO_PEDIDO[pedido.status];

    return '<tr>' +
             '<td class="col-number">' + pedido.id + '</td>' +
             '<td class="col-number">' + D.totalLatas(pedido) + '</td>' +
             '<td class="col-muted">' + pedido.created_at + '</td>' +
             '<td><span class="pill ' + estado.cls + '">' + etiqueta(pedido) + '</span></td>' +
           '</tr>';
  }).join('');

  window.Tarjetas.render(document.getElementById('reponer-cards'),
    reponer.map(function (fila) {
      return {
        titulo: fila.sabor.name,
        pill: { cls: 'pill--' + fila.estado.tipo, txt: fila.estado.txt },
        datos: [{ lbl: 'En góndola', val: fila.stock }]
      };
    }), 'Tenés stock de todos los sabores.');

  window.Tarjetas.render(document.getElementById('pedidos-cards'),
    ultimos.map(function (pedido) {
      var estado = D.ESTADO_PEDIDO[pedido.status];
      return {
        titulo: pedido.id,
        pill: { cls: estado.cls, txt: etiqueta(pedido) },
        datos: [
          { lbl: 'Latas', val: D.totalLatas(pedido) },
          { lbl: 'Enviado', val: pedido.created_at }
        ]
      };
    }), 'Todavía no hiciste ningún pedido.');

}());
