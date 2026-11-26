(function () {
  'use strict';

  var D = window.DATOS;

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
      var stock  = D.stockDe(sabor.id);
      var estado = D.estadoStock(stock);
      var latas  = D.latasDe(sabor.id, 'in_stock');
      var prom   = latas.length
        ? latas.reduce(function (a, l) { return a + l.net_weight; }, 0) / latas.length
        : 0;

      return '<tr data-sabor="' + sabor.id + '">' +
               '<td>' +
                 '<button type="button" class="cell-link" data-detalle ' +
                   'data-sabor="' + sabor.id + '" aria-haspopup="dialog">' +
                   sabor.name +
                 '</button>' +
                 (sabor.description
                   ? '<span class="cell-desc">' + sabor.description + '</span>'
                   : '') +
               '</td>' +
               '<td class="col-number">' + stock + '</td>' +
               '<td class="' + (prom ? 'col-number' : 'col-muted') + '">' +
                 (prom ? D.fmtKg(prom) : '—') +
               '</td>' +
               '<td class="col-number">' + D.fmtPrecio(sabor.price_per_kilo) + '</td>' +
               '<td><span class="pill pill--' + estado.tipo + '">' + estado.txt + '</span></td>' +
               '<td class="col-accion">' +
                 '<button type="button" class="btn btn--ghost btn--sm" data-cargar ' +
                   'data-sabor="' + sabor.id + '" aria-haspopup="dialog">Cargar</button>' +
               '</td>' +
             '</tr>';
    }).join('');

    renderCards();

    subtitulo.textContent = D.plural(D.SABORES.length, 'sabor', 'sabores') +
                            ' · actualizado hace 5 minutos';
  }

  function renderCards() {
    window.Tarjetas.render(cards, D.SABORES.map(function (sabor) {
      var stock  = D.stockDe(sabor.id);
      var estado = D.estadoStock(stock);
      var latas  = D.latasDe(sabor.id, 'in_stock');
      var prom   = latas.length
        ? latas.reduce(function (a, l) { return a + l.net_weight; }, 0) / latas.length
        : 0;

      return {
        atributos: 'data-sabor="' + sabor.id + '"',
        titulo: sabor.name,
        subtitulo: sabor.description || '',
        pill: { cls: 'pill--' + estado.tipo, txt: estado.txt },
        datos: [
          { lbl: 'Latas en stock', val: stock },
          { lbl: 'Promedio', val: prom ? D.fmtKg(prom) : '—' },
          { lbl: 'Precio por kilo', val: D.fmtPrecio(sabor.price_per_kilo) }
        ],

        acciones:
          '<button type="button" class="btn btn--ghost" data-detalle ' +
            'data-sabor="' + sabor.id + '">Ver latas</button>' +
          '<button type="button" class="btn btn--ghost" data-cargar ' +
            'data-sabor="' + sabor.id + '">Cargar lata</button>'
      };
    }), 'Todavía no hay sabores cargados.');
  }

  function alClickear(e) {
    var cargar = e.target.closest('[data-cargar]');
    if (cargar) { abrirModal(cargar.dataset.sabor); return; }

    var detalle = e.target.closest('[data-detalle], tr[data-sabor], .data-card');
    if (detalle) abrirDetalle(detalle.dataset.sabor);
  }

  tbody.addEventListener('click', alClickear);
  if (cards) cards.addEventListener('click', alClickear);

  var modal         = document.getElementById('modal-cargar');
  var btnCargar     = document.getElementById('btn-cargar');
  var btnCerrar     = document.getElementById('modal-cerrar');
  var btnCancelar   = document.getElementById('modal-cancelar');
  var formCargar    = document.getElementById('form-cargar');
  var selSabor      = document.getElementById('sel-sabor');
  var inpCodigo     = document.getElementById('inp-codigo');
  var inpPeso       = document.getElementById('inp-peso');
  var codigoAyuda   = document.getElementById('codigo-ayuda');
  var btnBalanza    = document.getElementById('btn-balanza');
  var modalError    = document.getElementById('modal-error');
  var modalErrorTxt = document.getElementById('modal-error-text');

  var escanerActivo = null;

  function poblarSabores() {
    selSabor.innerHTML = '<option value="">Elegí un sabor</option>' +
      D.SABORES.map(function (s) {
        return '<option value="' + s.id + '">' + s.name + '</option>';
      }).join('');
  }

  btnCargar.addEventListener('click', function () { abrirModal(null); });

  function abrirModal(flavorId) {
    formCargar.reset();
    poblarSabores();
    ocultarErrorModal();
    limpiarErrores();
    restaurarAyuda();

    modal.showModal();

    if (flavorId) {
      selSabor.value = flavorId;
      inpCodigo.focus();
    } else {
      selSabor.focus();
    }

    escanerActivo = window.Escaner.activar(function (codigo) {
      leerEtiqueta(codigo);
    });
  }

  function cerrarModal() {
    if (escanerActivo) { escanerActivo.desactivar(); escanerActivo = null; }
    modal.close();
    formCargar.reset();
    ocultarErrorModal();
    limpiarErrores();
    restaurarAyuda();
  }

  function leerEtiqueta(codigo) {
    inpCodigo.value = codigo;
    inpCodigo.classList.remove('field-input--error');
    ocultarErrorModal();

    codigoAyuda.innerHTML = '<span class="scan-lectura">' +
                              '<i class="ti ti-check" aria-hidden="true"></i>' +
                              'Etiqueta ' + codigo + ' leída' +
                            '</span>';

    inpPeso.focus();
  }

  function restaurarAyuda() {
    codigoAyuda.textContent = 'La balanza imprime códigos largos de números. ' +
                              'Si lo dejás vacío, el sistema le pone uno.';
  }

  btnCerrar.addEventListener('click', cerrarModal);
  btnCancelar.addEventListener('click', cerrarModal);

  modal.addEventListener('click', function (e) {
    if (e.target === modal) cerrarModal();
  });

  btnBalanza.addEventListener('click', function () {
    if (!navigator.serial) {
      mostrarErrorModal('Este navegador no puede conectarse a la balanza. ' +
                        'Escribí el peso a mano.');
      inpPeso.focus();
      return;
    }

    btnBalanza.disabled = true;
    btnBalanza.innerHTML = '<i class="ti ti-loader spin" aria-hidden="true"></i> Conectando...';

    setTimeout(function () {
      inpPeso.value = '4.2';
      btnBalanza.disabled = false;
      btnBalanza.innerHTML = '<i class="ti ti-usb" aria-hidden="true"></i> Balanza conectada';
    }, 900);
  });

  formCargar.addEventListener('submit', function (e) {
    e.preventDefault();

    var flavorId = selSabor.value;
    var codigo   = inpCodigo.value.trim();
    var pesoStr  = inpPeso.value.trim();
    var peso     = parseFloat(pesoStr);

    if (!flavorId) {
      mostrarErrorModal('Elegí un sabor antes de guardar.');
      selSabor.classList.add('field-input--error');
      selSabor.focus();
      return;
    }

    if (codigo && D.lataPorCodigo(codigo)) {
      var repetida = D.lataPorCodigo(codigo);
      mostrarErrorModal('Esa etiqueta ya fue usada en una lata de ' +
                        repetida.flavor_name + '. Cambiá el código o dejalo vacío.');
      inpCodigo.classList.add('field-input--error');
      inpCodigo.focus();
      return;
    }

    if (!pesoStr || isNaN(peso) || peso <= 0) {
      mostrarErrorModal('Ingresá el peso de la lata. Tiene que ser mayor a cero.');
      inpPeso.classList.add('field-input--error');
      inpPeso.focus();
      return;
    }

    var sabor = D.sabor(flavorId);
    var neto  = Math.round((peso - D.TARA_LATA) * 10) / 10;
    if (neto <= 0) neto = peso;

    var lata = {
      id: 't-nueva-' + Date.now(),
      flavor_id: sabor.id,
      flavor_name: sabor.name,
      branch_id: null,
      internal_code: codigo || ('LB-' + sabor.prefijo + '-' + (900 + D.LATAS.length)),
      gross_weight: peso,
      net_weight: neto,
      total_price: Math.round(neto * sabor.price_per_kilo),
      status: 'in_stock',
      order_id: null,
      created_at: 'recién'
    };

    D.LATAS.push(lata);
    cerrarModal();
    render();

    mostrarToast('Listo. Lata ' + lata.internal_code + ' de ' + sabor.name +
                 ' cargada y guardada.', function () {
      var i = D.LATAS.indexOf(lata);
      if (i !== -1) D.LATAS.splice(i, 1);
      render();
    });
  });

  [selSabor, inpCodigo, inpPeso].forEach(function (campo) {
    campo.addEventListener('input', function () {
      campo.classList.remove('field-input--error');
      if (!selSabor.classList.contains('field-input--error') &&
          !inpCodigo.classList.contains('field-input--error') &&
          !inpPeso.classList.contains('field-input--error')) {
        ocultarErrorModal();
      }
    });
  });

  function mostrarErrorModal(msg) {
    modalErrorTxt.textContent = msg;
    modalError.hidden = false;
  }

  function ocultarErrorModal() {
    modalError.hidden = true;
    modalErrorTxt.textContent = '';
  }

  function limpiarErrores() {
    selSabor.classList.remove('field-input--error');
    inpCodigo.classList.remove('field-input--error');
    inpPeso.classList.remove('field-input--error');
  }

  var modalSabor     = document.getElementById('modal-sabor');
  var btnSabor       = document.getElementById('btn-sabor');
  var formSabor      = document.getElementById('form-sabor');
  var saborCerrar    = document.getElementById('sabor-cerrar');
  var saborCancelar  = document.getElementById('sabor-cancelar');
  var saborNombre    = document.getElementById('inp-sabor-nombre');
  var saborPrecio    = document.getElementById('inp-sabor-precio');
  var saborDesc      = document.getElementById('inp-sabor-desc');
  var saborError     = document.getElementById('sabor-error');
  var saborErrorTxt  = document.getElementById('sabor-error-text');

  btnSabor.addEventListener('click', function () {
    formSabor.reset();
    saborError.hidden = true;
    modalSabor.showModal();
    saborNombre.focus();
  });

  function cerrarSabor() {
    modalSabor.close();
    formSabor.reset();
    saborError.hidden = true;
  }

  saborCerrar.addEventListener('click', cerrarSabor);
  saborCancelar.addEventListener('click', cerrarSabor);
  modalSabor.addEventListener('click', function (e) {
    if (e.target === modalSabor) cerrarSabor();
  });

  formSabor.addEventListener('submit', function (e) {
    e.preventDefault();

    var nombre = saborNombre.value.trim();
    var precio = parseFloat(saborPrecio.value);

    if (!nombre) {
      errorSabor('Poné el nombre del sabor.');
      saborNombre.focus();
      return;
    }

    if (D.saborPorNombre(nombre)) {
      errorSabor('Ya existe un sabor que se llama ' + nombre + '.');
      saborNombre.focus();
      return;
    }

    if (!precio || precio <= 0) {
      errorSabor('Poné el precio por kilo. Tiene que ser mayor a cero.');
      saborPrecio.focus();
      return;
    }

    var nuevo = {
      id: 'f-' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: nombre,
      price_per_kilo: precio,
      description: saborDesc.value.trim(),
      is_active: true,
      prefijo: nombre.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, ''),
      stock: 0,
      prom: 0
    };

    D.SABORES.push(nuevo);
    cerrarSabor();
    render();

    mostrarToast('Listo. ' + nombre + ' ya está en el catálogo. ' +
                 'Cargá la primera lata cuando quieras.', function () {
      var i = D.SABORES.indexOf(nuevo);
      if (i !== -1) D.SABORES.splice(i, 1);
      render();
    });
  });

  function errorSabor(msg) {
    saborErrorTxt.textContent = msg;
    saborError.hidden = false;
  }

  var modalDetalle   = document.getElementById('modal-detalle');
  var detalleTitulo  = document.getElementById('detalle-titulo');
  var detalleEstado  = document.getElementById('detalle-estado');
  var detalleBody    = document.getElementById('detalle-body');
  var detalleCerrar  = document.getElementById('detalle-cerrar');
  var detalleCerrarP = document.getElementById('detalle-cerrar-pie');
  var detalleCargar  = document.getElementById('detalle-cargar');

  var saborActual = null;

  function abrirDetalle(flavorId) {
    var sabor = D.sabor(flavorId);
    if (!sabor) return;

    saborActual = flavorId;

    var latas  = D.latasDe(flavorId);
    var stock  = D.stockDe(flavorId);
    var estado = D.estadoStock(stock);

    detalleTitulo.textContent = sabor.name;
    detalleEstado.className   = 'pill pill--' + estado.tipo;
    detalleEstado.textContent = estado.txt;

    if (!latas.length) {
      detalleBody.innerHTML =
        '<div class="detalle-vacio">' +
          '<i class="ti ti-package-off" aria-hidden="true"></i>' +
          '<p class="detalle-vacio-titulo">Todavía no hay latas de este sabor.</p>' +
          '<p class="detalle-vacio-texto">Cuando cargues la primera, va a aparecer ' +
          'acá con su peso y su etiqueta.</p>' +
        '</div>';
      modalDetalle.showModal();
      return;
    }

    var enStock  = latas.filter(function (l) { return l.status === 'in_stock'; });
    var netoTotal = enStock.reduce(function (a, l) { return a + l.net_weight; }, 0);
    var prom      = enStock.length ? netoTotal / enStock.length : 0;

    var html =
      '<div class="detalle-resumen">' +
        '<div class="resumen-item">' +
          '<span class="resumen-num">' + enStock.length + '</span>' +
          '<span class="resumen-lbl">latas en stock</span>' +
        '</div>' +
        '<div class="resumen-item">' +
          '<span class="resumen-num">' + D.fmtKg(netoTotal) + '</span>' +
          '<span class="resumen-lbl">peso neto total</span>' +
        '</div>' +
        '<div class="resumen-item">' +
          '<span class="resumen-num">' + D.fmtKg(prom) + '</span>' +
          '<span class="resumen-lbl">promedio por lata</span>' +
        '</div>' +
        '<div class="resumen-item">' +
          '<span class="resumen-num">' + D.fmtPrecio(sabor.price_per_kilo) + '</span>' +
          '<span class="resumen-lbl">precio por kilo</span>' +
        '</div>' +
      '</div>';

    html += '<ul class="lata-list">';
    latas.forEach(function (l) {
      var est = D.ESTADO_LATA[l.status];
      html +=
        '<li class="lata-item">' +
          '<div class="lata-id">' +
            '<span class="lata-etiqueta">' + l.internal_code + '</span>' +
            '<span class="lata-detalle">Bruto ' + D.fmtKg(l.gross_weight) +
              ' · cargada ' + l.created_at + '</span>' +
          '</div>' +
          '<div class="lata-pesos">' +
            '<span class="lata-neto">' + D.fmtKg(l.net_weight) + '</span>' +
            '<span class="lata-precio">' + D.fmtPrecio(l.total_price) + '</span>' +
          '</div>' +
          '<div class="lata-meta">' +
            '<span class="pill ' + est.cls + '">' + est.txt + '</span>' +
          '</div>' +
        '</li>';
    });
    html += '</ul>';

    detalleBody.innerHTML = html;
    detalleBody.scrollTop = 0;
    modalDetalle.showModal();
  }

  function cerrarDetalle() { modalDetalle.close(); }

  detalleCerrar.addEventListener('click', cerrarDetalle);
  detalleCerrarP.addEventListener('click', cerrarDetalle);
  modalDetalle.addEventListener('click', function (e) {
    if (e.target === modalDetalle) cerrarDetalle();
  });

  detalleCargar.addEventListener('click', function () {
    var flavorId = saborActual;
    cerrarDetalle();
    abrirModal(flavorId);
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
