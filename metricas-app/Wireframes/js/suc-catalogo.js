(function () {
  'use strict';

  var D   = window.DATOS;
  var MIA = D.SUCURSAL_ACTUAL;

  var grid         = document.getElementById('catalog-grid');
  var gridInsumos  = document.getElementById('insumos-grid');
  var subtitulo    = document.getElementById('catalogo-subtitulo');
  var cartBody     = document.getElementById('cart-body');
  var cartTotal    = document.getElementById('cart-total');
  var btnEnviar    = document.getElementById('btn-enviar');
  var cartBarCnt   = document.getElementById('cart-bar-count');
  var btnEnviarBar = document.getElementById('btn-enviar-bar');

  var modal         = document.getElementById('modal-confirmar');
  var modalList     = document.getElementById('confirmar-list');
  var modalTotal    = document.getElementById('confirmar-total');
  var modalCerrar   = document.getElementById('confirmar-cerrar');
  var modalCancelar = document.getElementById('confirmar-cancelar');
  var modalEnviar   = document.getElementById('confirmar-enviar');

  var toast      = document.getElementById('toast');
  var toastText  = document.getElementById('toast-text');
  var toastUndo  = document.getElementById('toast-undo');
  var toastClose = document.getElementById('toast-close');

  if (!grid) return;

  var cart        = {};
  var cartInsumos = {};
  var toastTimer  = null;
  var ultimoEnvio = null;

  function render() {
    grid.innerHTML = D.SABORES.map(function (sabor) {
      var disp   = D.stockDe(sabor.id);
      var estado = D.estadoStock(disp);
      var qty    = cart[sabor.id] || 0;

      return '<article class="catalog-card' + (qty > 0 ? ' is-en-pedido' : '') + '" ' +
               'data-sabor="' + sabor.id + '" data-disp="' + disp + '">' +
               '<div class="catalog-card-head">' +
                 '<h3 class="catalog-card-title">' + sabor.name + '</h3>' +
                 '<span class="pill pill--' + estado.tipo + '">' + estado.txt + '</span>' +
               '</div>' +
               '<p class="catalog-card-meta">' +
                 (sabor.prom ? 'Peso promedio ' + D.fmtKg(sabor.prom) + ' por lata · ' : '') +
                 D.fmtPrecio(sabor.price_per_kilo) + ' el kilo' +
               '</p>' +
               (sabor.description
                 ? '<p class="catalog-card-meta">' + sabor.description + '</p>'
                 : '') +
               '<div class="catalog-card-action">' +
                 '<div class="qty-stepper">' +
                   '<button type="button" data-dec aria-label="Quitar una lata de ' +
                     sabor.name + '"' + (qty <= 0 ? ' disabled' : '') + '>' +
                     '<i class="ti ti-minus" aria-hidden="true"></i></button>' +
                   '<span class="qty-stepper-value" data-qty>' + qty + '</span>' +
                   '<button type="button" data-inc aria-label="Agregar una lata de ' +
                     sabor.name + '"' + (qty >= disp ? ' disabled' : '') + '>' +
                     '<i class="ti ti-plus" aria-hidden="true"></i></button>' +
                 '</div>' +
               '</div>' +
             '</article>';
    }).join('');

    renderInsumos();

    if (subtitulo) {
      var conStock = D.SABORES.filter(function (s) { return D.stockDe(s.id) > 0; }).length;
      subtitulo.textContent = conStock + ' de ' + D.SABORES.length +
                              ' sabores con stock en fábrica · actualizado recién';
    }
  }

  function pasoDe(ins) {
    return ins.bulto > 1 ? ins.bulto : 1;
  }

  function renderInsumos() {
    if (!gridInsumos) return;

    gridInsumos.innerHTML = D.INSUMOS.map(function (ins) {
      var disp   = ins.stock;
      var estado = D.estadoInsumo(disp, ins.minimo);
      var qty    = cartInsumos[ins.id] || 0;
      var paso   = pasoDe(ins);

      return '<article class="catalog-card' + (qty > 0 ? ' is-en-pedido' : '') + '" ' +
               'data-insumo="' + ins.id + '" data-estado="' + estado.tipo + '">' +
               '<div class="catalog-card-head">' +
                 '<h3 class="catalog-card-title">' + ins.name + '</h3>' +
                 '<span class="pill pill--' + estado.tipo + '">' + estado.txt + '</span>' +
               '</div>' +
               '<p class="catalog-card-meta">' +
                 ins.categoria + ' · ' + D.fmtPrecio(ins.price_per_unit) + ' cada ' + ins.unidad +
               '</p>' +
               '<p class="catalog-card-meta">' +
                 (ins.bulto > 1
                   ? 'Se pide por ' + ins.bulto_nombre + ' de ' + ins.bulto + ' ' + ins.plural
                   : 'Se pide por ' + ins.unidad) +
                 ' · hay ' + D.cantidadInsumo(disp, ins) +
               '</p>' +
               '<div class="catalog-card-action">' +
                 '<div class="qty-stepper">' +
                   '<button type="button" data-dec-insumo aria-label="Quitar ' +
                     (ins.bulto > 1 ? 'una ' + ins.bulto_nombre : 'un ' + ins.unidad) +
                     ' de ' + ins.name + '"' + (qty <= 0 ? ' disabled' : '') + '>' +
                     '<i class="ti ti-minus" aria-hidden="true"></i></button>' +
                   '<span class="qty-stepper-value" data-qty>' +
                     (ins.bulto > 1 ? Math.round(qty / paso) : qty) + '</span>' +
                   '<button type="button" data-inc-insumo aria-label="Agregar ' +
                     (ins.bulto > 1 ? 'una ' + ins.bulto_nombre : 'un ' + ins.unidad) +
                     ' de ' + ins.name + '"' + (qty + paso > disp ? ' disabled' : '') + '>' +
                     '<i class="ti ti-plus" aria-hidden="true"></i></button>' +
                 '</div>' +
                 (qty > 0
                   ? '<span class="catalog-card-meta" style="margin:0 0 0 var(--space-3);">' +
                     D.cantidadInsumo(qty, ins).replace(/ \(.*\)/, '') + '</span>'
                   : '') +
               '</div>' +
             '</article>';
    }).join('');
  }

  if (gridInsumos) {
    gridInsumos.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-inc-insumo], button[data-dec-insumo]');
      if (!btn || btn.disabled) return;

      var ins  = D.insumo(btn.closest('.catalog-card').dataset.insumo);
      var paso = pasoDe(ins);
      var actual = cartInsumos[ins.id] || 0;

      if (btn.hasAttribute('data-inc-insumo') && actual + paso <= ins.stock) {
        cartInsumos[ins.id] = actual + paso;
      } else if (btn.hasAttribute('data-dec-insumo') && actual > 0) {
        cartInsumos[ins.id] = Math.max(0, actual - paso);
        if (cartInsumos[ins.id] === 0) delete cartInsumos[ins.id];
      }

      renderInsumos();
      renderCart();
    });
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-inc], button[data-dec]');
    if (!btn || btn.disabled) return;

    var card     = btn.closest('.catalog-card');
    var flavorId = card.dataset.sabor;
    var disp     = parseInt(card.dataset.disp, 10);
    var actual   = cart[flavorId] || 0;

    if (btn.hasAttribute('data-inc') && actual < disp) {
      cart[flavorId] = actual + 1;
    } else if (btn.hasAttribute('data-dec') && actual > 0) {
      cart[flavorId] = actual - 1;
      if (cart[flavorId] === 0) delete cart[flavorId];
    }

    render();
    renderCart();
  });

  function itemsCarrito() {
    return Object.keys(cart).map(function (flavorId) {
      return { sabor: D.sabor(flavorId), qty: cart[flavorId] };
    });
  }

  function insumosCarrito() {
    return Object.keys(cartInsumos).map(function (supplyId) {
      return { insumo: D.insumo(supplyId), qty: cartInsumos[supplyId] };
    });
  }

  function totalLatas() {
    return Object.keys(cart).reduce(function (acc, k) { return acc + cart[k]; }, 0);
  }

  function hayAlgo() {
    return itemsCarrito().length > 0 || insumosCarrito().length > 0;
  }

  function precioEstimado() {
    var latas = itemsCarrito().reduce(function (acc, it) {
      return acc + it.qty * (it.sabor.prom || 0) * it.sabor.price_per_kilo;
    }, 0);

    var insumos = insumosCarrito().reduce(function (acc, it) {
      return acc + it.qty * it.insumo.price_per_unit;
    }, 0);

    return latas + insumos;
  }

  function plural(n) {
    return D.plural(n, 'lata', 'latas');
  }

  function filaCarrito(nombre, detalle, id) {
    return '<div class="cart-item">' +
             '<span class="cart-item-info">' +
               '<span class="cart-item-name">' + nombre + '</span>' +
               '<span class="cart-item-qty">' + detalle + '</span>' +
             '</span>' +
             '<button type="button" class="cart-item-remove" ' +
               'data-remove="' + id + '" ' +
               'aria-label="Quitar ' + nombre + ' del pedido">' +
               '<i class="ti ti-trash" aria-hidden="true"></i>' +
             '</button>' +
           '</div>';
  }

  function renderCart() {
    var items   = itemsCarrito();
    var insumos = insumosCarrito();
    var total   = totalLatas();

    if (!hayAlgo()) {
      cartBody.innerHTML =
        '<div class="cart-empty">' +
          '<i class="ti ti-shopping-cart" aria-hidden="true"></i>' +
          '<p class="cart-empty-text">Todavía no agregaste nada.<br>' +
          'Sumá latas o insumos desde el catálogo →</p>' +
        '</div>';
    } else {
      var html = '';

      if (items.length) {
        html += '<p class="cards-grupo" style="padding:var(--space-3) var(--space-5) 0;">Latas</p>';
        html += items.map(function (it) {
          return filaCarrito(it.sabor.name, plural(it.qty), it.sabor.id);
        }).join('');
      }

      if (insumos.length) {
        html += '<p class="cards-grupo" style="padding:var(--space-3) var(--space-5) 0;">Insumos</p>';
        html += insumos.map(function (it) {
          return filaCarrito(it.insumo.name, D.cantidadInsumo(it.qty, it.insumo), it.insumo.id);
        }).join('');
      }

      html += '<div class="cart-precio">' +
                '<span class="cart-precio-label">Precio estimado</span>' +
                '<span class="cart-precio-valor">' + D.fmtPrecio(precioEstimado()) + '</span>' +
              '</div>';

      cartBody.innerHTML = html;
    }

    var resumen = plural(total);
    if (insumos.length) {
      resumen += ' · ' + D.plural(insumos.length, 'insumo', 'insumos');
    }

    cartTotal.textContent  = resumen;
    cartBarCnt.textContent = resumen;
    btnEnviar.disabled     = !hayAlgo();
    btnEnviarBar.disabled  = !hayAlgo();
  }

  cartBody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remove]');
    if (!btn) return;

    delete cart[btn.dataset.remove];
    delete cartInsumos[btn.dataset.remove];

    render();
    renderCart();
  });

  function abrirConfirmar() {
    if (!hayAlgo()) return;

    var items   = itemsCarrito();
    var insumos = insumosCarrito();

    modalList.innerHTML =
      items.map(function (it) {
        return '<li><span>' + it.sabor.name + '</span>' +
               '<span class="confirm-qty">' + plural(it.qty) + '</span></li>';
      }).join('') +
      insumos.map(function (it) {
        return '<li><span>' + it.insumo.name + '</span>' +
               '<span class="confirm-qty">' +
                 D.cantidadInsumo(it.qty, it.insumo) + '</span></li>';
      }).join('');

    var partes = [];
    if (items.length)   partes.push(plural(totalLatas()));
    if (insumos.length) partes.push(D.plural(insumos.length, 'insumo', 'insumos'));
    partes.push('precio estimado ' + D.fmtPrecio(precioEstimado()));

    modalTotal.textContent = partes.join(' · ');
    modal.showModal();
  }

  function cerrarConfirmar() { modal.close(); }

  btnEnviar.addEventListener('click', abrirConfirmar);
  btnEnviarBar.addEventListener('click', abrirConfirmar);
  modalCerrar.addEventListener('click', cerrarConfirmar);
  modalCancelar.addEventListener('click', cerrarConfirmar);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) cerrarConfirmar();
  });

  modalEnviar.addEventListener('click', function () {
    var total   = totalLatas();
    var items   = itemsCarrito();
    var insumos = insumosCarrito();

    var pedido = {
      id: 'PED-' + Math.random().toString(16).substring(2, 6).toUpperCase(),
      branch_id: MIA,
      status: 'pendiente',
      created_at: 'recién',
      branchNotes: '',
      adminNotes: '',
      items: items.map(function (it) {
        return { flavor_id: it.sabor.id, quantity: it.qty };
      }),
      supplies: insumos.map(function (it) {
        return { supply_id: it.insumo.id, quantity: it.qty };
      })
    };

    D.PEDIDOS.unshift(pedido);
    ultimoEnvio = {
      cart: Object.assign({}, cart),
      cartInsumos: Object.assign({}, cartInsumos),
      pedido: pedido
    };

    cart = {};
    cartInsumos = {};
    render();
    renderCart();
    cerrarConfirmar();

    var resumen = [];
    if (total) resumen.push(plural(total));
    if (insumos.length) resumen.push(D.plural(insumos.length, 'insumo', 'insumos'));

    mostrarToast('Pedido ' + pedido.id + ' enviado a fábrica. ' +
                 resumen.join(' y ') + '. Ya lo pueden ver.');
  });

  function mostrarToast(mensaje) {
    clearTimeout(toastTimer);
    toastText.textContent = mensaje;
    toastUndo.hidden = false;
    toast.hidden = false;

    toastTimer = setTimeout(function () {
      toast.hidden = true;
      ultimoEnvio = null;
    }, 10000);
  }

  toastUndo.addEventListener('click', function () {
    clearTimeout(toastTimer);
    toast.hidden = true;
    if (!ultimoEnvio) return;

    var i = D.PEDIDOS.indexOf(ultimoEnvio.pedido);
    if (i !== -1) D.PEDIDOS.splice(i, 1);

    cart = ultimoEnvio.cart;
    cartInsumos = ultimoEnvio.cartInsumos;
    ultimoEnvio = null;
    render();
    renderCart();
  });

  toastClose.addEventListener('click', function () {
    clearTimeout(toastTimer);
    toast.hidden = true;
    ultimoEnvio = null;
  });

  window.Pestanas.activar(document.getElementById('tabs-catalogo'));

  render();
  renderCart();

}());
