(function () {
  'use strict';

  var D = window.DATOS;

  var kpiPendientes = document.getElementById('kpi-pendientes');
  var kpiCargadas   = document.getElementById('kpi-cargadas');
  var kpiDespachos  = document.getElementById('kpi-despachos');
  var kpiAlertas    = document.getElementById('kpi-alertas');
  var tablaAlertas  = document.getElementById('tabla-alertas');
  var tablaPedidos  = document.getElementById('tabla-pedidos');
  var subtitulo     = document.getElementById('dash-subtitulo');

  if (!tablaAlertas) return;

  function contarPedidos(estado) {
    return D.PEDIDOS.filter(function (p) { return p.status === estado; }).length;
  }

  function alertasDeStock() {
    return D.SABORES.map(function (sabor) {
      var stock = D.stockDe(sabor.id);
      return { sabor: sabor, stock: stock, estado: D.estadoStock(stock) };
    }).filter(function (fila) {
      return fila.estado.tipo !== 'disponible';
    }).sort(function (a, b) {
      return a.stock - b.stock;
    });
  }

  var alertas = alertasDeStock();

  kpiPendientes.textContent = contarPedidos('pendiente');
  kpiDespachos.textContent  = contarPedidos('despachado');
  kpiAlertas.textContent    = alertas.length;

  kpiCargadas.textContent = D.LATAS.filter(function (l) {
    return l.branch_id === null && String(l.created_at).indexOf('hoy') === 0;
  }).length;

  subtitulo.textContent = 'Lunes 27 de julio de 2026 · Turno mañana';

  tablaAlertas.innerHTML = alertas.length
    ? alertas.map(function (fila) {
        return '<tr>' +
                 '<td>' + fila.sabor.name + '</td>' +
                 '<td class="col-number">' + fila.stock + '</td>' +
                 '<td><span class="pill pill--' + fila.estado.tipo + '">' +
                   fila.estado.txt + '</span></td>' +
               '</tr>';
      }).join('')
    : '<tr><td colspan="3" class="col-muted">Todos los sabores tienen stock de sobra.</td></tr>';

  var ultimos = D.PEDIDOS.slice(0, 5);

  tablaPedidos.innerHTML = ultimos.map(function (pedido) {
    var estado = D.ESTADO_PEDIDO[pedido.status];
    return '<tr>' +
             '<td class="col-number">' + pedido.id + '</td>' +
             '<td>' + D.sucursal(pedido.branch_id).name + '</td>' +
             '<td class="col-number">' + D.totalLatas(pedido) + '</td>' +
             '<td class="col-muted">' + pedido.created_at + '</td>' +
             '<td><span class="pill ' + estado.cls + '">' + estado.txt + '</span></td>' +
           '</tr>';
  }).join('');

  window.Tarjetas.render(document.getElementById('alertas-cards'),
    alertas.map(function (fila) {
      return {
        titulo: fila.sabor.name,
        pill: { cls: 'pill--' + fila.estado.tipo, txt: fila.estado.txt },
        datos: [{ lbl: 'Latas en stock', val: fila.stock }]
      };
    }), 'Todos los sabores tienen stock de sobra.');

  window.Tarjetas.render(document.getElementById('pedidos-cards'),
    ultimos.map(function (pedido) {
      var estado = D.ESTADO_PEDIDO[pedido.status];
      return {
        titulo: pedido.id,
        subtitulo: D.sucursal(pedido.branch_id).name,
        pill: { cls: estado.cls, txt: estado.txt },
        datos: [
          { lbl: 'Latas', val: D.totalLatas(pedido) },
          { lbl: 'Recibido', val: pedido.created_at }
        ]
      };
    }), 'Todavía no llegó ningún pedido.');

}());
