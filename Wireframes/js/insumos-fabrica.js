(function () {
  'use strict';

  var D = window.DATOS;

  var tbody = document.getElementById('insumos-body');
  var cards = document.getElementById('insumos-cards');
  if (!tbody) return;

  var accionesSabores = document.getElementById('acciones-sabores');
  var accionesInsumos = document.getElementById('acciones-insumos');
  var subtitulo       = document.getElementById('inventario-subtitulo');

  var toast      = document.getElementById('toast');
  var toastText  = document.getElementById('toast-text');
  var toastUndo  = document.getElementById('toast-undo');
  var toastClose = document.getElementById('toast-close');

  var toastTimer = null;
  var deshacer   = null;

  window.Pestanas.activar(document.getElementById('tabs-inventario'), function (cual) {
    accionesSabores.hidden = cual !== 'sabores';
    accionesInsumos.hidden = cual !== 'insumos';

    if (cual === 'insumos') {
      var faltan = D.INSUMOS.filter(function (s) {
        return D.estadoInsumo(s.stock, s.minimo).tipo !== 'disponible';
      }).length;

      subtitulo.textContent = D.plural(D.INSUMOS.length, 'insumo', 'insumos') +
                              ' · ' + faltan + ' para reponer';
    } else {
      subtitulo.textContent = D.plural(D.SABORES.length, 'sabor', 'sabores') +
                              ' · actualizado hace 5 minutos';
    }
  });

  function render() {
    tbody.innerHTML = D.INSUMOS.map(function (ins) {
      var estado = D.estadoInsumo(ins.stock, ins.minimo);

      return '<tr data-insumo="' + ins.id + '">' +
               '<td>' + ins.name +
                 (ins.bulto > 1
                   ? '<span class="cell-desc">' + ins.bulto_nombre + ' de ' +
                     ins.bulto + ' ' + ins.plural + '</span>'
                   : '') +
               '</td>' +
               '<td class="col-muted">' + ins.categoria + '</td>' +
               '<td class="col-number">' + D.cantidadInsumo(ins.stock, ins) + '</td>' +
               '<td class="col-number">' + D.fmtPrecio(ins.price_per_unit) + '</td>' +
               '<td><span class="pill pill--' + estado.tipo + '">' + estado.txt + '</span></td>' +
               '<td class="col-accion">' +
                 '<button type="button" class="btn btn--ghost btn--sm" data-cargar-insumo ' +
                   'data-insumo="' + ins.id + '" aria-haspopup="dialog">Cargar</button>' +
               '</td>' +
             '</tr>';
    }).join('');

    renderCards();
  }

  function renderCards() {
    window.Tarjetas.render(cards, D.INSUMOS.map(function (ins) {
      var estado = D.estadoInsumo(ins.stock, ins.minimo);

      return {
        atributos: 'data-insumo="' + ins.id + '"',
        titulo: ins.name,
        subtitulo: ins.categoria,
        pill: { cls: 'pill--' + estado.tipo, txt: estado.txt },
        datos: [
          { lbl: 'En stock', val: D.cantidadInsumo(ins.stock, ins) },
          { lbl: 'Por unidad', val: D.fmtPrecio(ins.price_per_unit) }
        ],
        acciones:
          '<button type="button" class="btn btn--ghost" data-cargar-insumo ' +
            'data-insumo="' + ins.id + '">Cargar stock</button>'
      };
    }), 'Todavía no hay insumos cargados.');
  }

  function alClickear(e) {
    var btn = e.target.closest('[data-cargar-insumo]');
    if (btn) abrirModal(btn.dataset.insumo);
  }

  tbody.addEventListener('click', alClickear);
  if (cards) cards.addEventListener('click', alClickear);

  var modal        = document.getElementById('modal-insumo');
  var btnInsumo    = document.getElementById('btn-insumo');
  var form         = document.getElementById('form-insumo');
  var selInsumo    = document.getElementById('sel-insumo');
  var selMedida    = document.getElementById('sel-medida');
  var inpCantidad  = document.getElementById('inp-cantidad');
  var ayuda        = document.getElementById('insumo-ayuda');
  var equivale     = document.getElementById('insumo-equivale');
  var cerrar       = document.getElementById('insumo-cerrar');
  var cancelar     = document.getElementById('insumo-cancelar');
  var error        = document.getElementById('insumo-error');
  var errorTxt     = document.getElementById('insumo-error-text');

  var escanerActivo = null;

  function poblarInsumos() {
    selInsumo.innerHTML = '<option value="">Elegí un insumo</option>' +
      D.CATEGORIAS_INSUMO.map(function (cat) {
        var deLaCat = D.INSUMOS.filter(function (s) { return s.categoria === cat; });
        if (!deLaCat.length) return '';

        return '<optgroup label="' + cat + '">' +
          deLaCat.map(function (s) {
            return '<option value="' + s.id + '">' + s.name + '</option>';
          }).join('') +
        '</optgroup>';
      }).join('');
  }

  btnInsumo.addEventListener('click', function () { abrirModal(null); });

  function abrirModal(supplyId) {
    form.reset();
    poblarInsumos();
    error.hidden = true;
    ayuda.textContent = 'Escaneá la caja o elegilo de la lista.';

    modal.showModal();

    if (supplyId) {
      selInsumo.value = supplyId;
      inpCantidad.focus();
    } else {
      selInsumo.focus();
    }

    actualizarMedida();

    escanerActivo = window.Escaner.activar(function (codigo) {
      leerCodigo(codigo);
    });
  }

  function cerrarModal() {
    if (escanerActivo) { escanerActivo.desactivar(); escanerActivo = null; }
    modal.close();
    form.reset();
    error.hidden = true;
  }

  cerrar.addEventListener('click', cerrarModal);
  cancelar.addEventListener('click', cerrarModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) cerrarModal();
  });

  function leerCodigo(codigo) {
    var ins = D.insumoPorCodigo(codigo);

    if (!ins) {
      mostrarError('No hay ningún insumo con el código ' + codigo +
                   '. Elegilo de la lista o cargalo como insumo nuevo.');
      return;
    }

    selInsumo.value = ins.id;
    error.hidden = true;
    ayuda.innerHTML = '<span class="scan-lectura">' +
                        '<i class="ti ti-check" aria-hidden="true"></i>' +
                        ins.name + ' leído de la caja' +
                      '</span>';

    actualizarMedida();
    inpCantidad.focus();
  }

  function actualizarMedida() {
    var ins = D.insumo(selInsumo.value);
    var opcionBulto = selMedida.querySelector('option[value="bulto"]');

    if (!ins) {
      equivale.textContent = 'Elegí un insumo para ver cuántas unidades entran.';
      opcionBulto.disabled = false;
      return;
    }

    if (ins.bulto > 1) {
      opcionBulto.disabled = false;
      opcionBulto.textContent = ins.bulto_nombre.charAt(0).toUpperCase() +
                                ins.bulto_nombre.slice(1) + 's cerradas de ' +
                                ins.bulto + ' ' + ins.plural;
    } else {
      opcionBulto.disabled = true;
      selMedida.value = 'unidad';
      opcionBulto.textContent = 'Este insumo no viene en bultos';
    }

    mostrarEquivalencia();
  }

  function mostrarEquivalencia() {
    var ins = D.insumo(selInsumo.value);
    var cant = parseInt(inpCantidad.value, 10);

    if (!ins || !cant || cant <= 0) {
      equivale.textContent = ins && ins.bulto > 1
        ? 'Cada ' + ins.bulto_nombre + ' trae ' + ins.bulto + ' ' + ins.plural + '.'
        : 'Cargá cuántas unidades entraron.';
      return;
    }

    var unidades = selMedida.value === 'bulto' && ins.bulto > 1
      ? cant * ins.bulto
      : cant;

    equivale.textContent = 'Entran ' + unidades.toLocaleString('es-AR') + ' ' +
                           (unidades === 1 ? ins.unidad : ins.plural) + '.';
  }

  selInsumo.addEventListener('change', actualizarMedida);
  selMedida.addEventListener('change', mostrarEquivalencia);
  inpCantidad.addEventListener('input', mostrarEquivalencia);

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var ins  = D.insumo(selInsumo.value);
    var cant = parseInt(inpCantidad.value, 10);

    if (!ins) {
      mostrarError('Elegí un insumo antes de guardar.');
      selInsumo.focus();
      return;
    }

    if (!cant || cant <= 0) {
      mostrarError('Poné cuántos entraron. Tiene que ser más de cero.');
      inpCantidad.focus();
      return;
    }

    var unidades = selMedida.value === 'bulto' && ins.bulto > 1 ? cant * ins.bulto : cant;

    ins.stock += unidades;
    cerrarModal();
    render();

    mostrarToast('Listo. Sumaste ' + unidades.toLocaleString('es-AR') + ' ' +
                 (unidades === 1 ? ins.unidad : ins.plural) + ' de ' + ins.name + '.',
      function () {
        ins.stock -= unidades;
        render();
      });
  });

  function mostrarError(msg) {
    errorTxt.textContent = msg;
    error.hidden = false;
  }

  var modalNuevo    = document.getElementById('modal-insumo-nuevo');
  var btnNuevo      = document.getElementById('btn-insumo-nuevo');
  var formNuevo     = document.getElementById('form-insumo-nuevo');
  var nuevoNombre   = document.getElementById('inp-insumo-nombre');
  var nuevoCategoria = document.getElementById('sel-insumo-categoria');
  var nuevoUnidad   = document.getElementById('inp-insumo-unidad');
  var nuevoBulto    = document.getElementById('inp-insumo-bulto');
  var nuevoPrecio   = document.getElementById('inp-insumo-precio');
  var nuevoMinimo   = document.getElementById('inp-insumo-minimo');
  var nuevoCerrar   = document.getElementById('insumo-nuevo-cerrar');
  var nuevoCancelar = document.getElementById('insumo-nuevo-cancelar');
  var nuevoError    = document.getElementById('insumo-nuevo-error');
  var nuevoErrorTxt = document.getElementById('insumo-nuevo-error-text');

  nuevoCategoria.innerHTML = D.CATEGORIAS_INSUMO.map(function (c) {
    return '<option value="' + c + '">' + c + '</option>';
  }).join('');

  btnNuevo.addEventListener('click', function () {
    formNuevo.reset();
    nuevoError.hidden = true;
    modalNuevo.showModal();
    nuevoNombre.focus();
  });

  function cerrarNuevo() {
    modalNuevo.close();
    formNuevo.reset();
    nuevoError.hidden = true;
  }

  nuevoCerrar.addEventListener('click', cerrarNuevo);
  nuevoCancelar.addEventListener('click', cerrarNuevo);
  modalNuevo.addEventListener('click', function (e) {
    if (e.target === modalNuevo) cerrarNuevo();
  });

  formNuevo.addEventListener('submit', function (e) {
    e.preventDefault();

    var nombre = nuevoNombre.value.trim();
    var unidad = nuevoUnidad.value.trim().toLowerCase();
    var precio = parseFloat(nuevoPrecio.value);
    var minimo = parseInt(nuevoMinimo.value, 10);
    var bulto  = parseInt(nuevoBulto.value, 10) || 0;

    if (!nombre) {
      errorNuevo('Poné el nombre del insumo.');
      nuevoNombre.focus();
      return;
    }

    if (D.INSUMOS.some(function (s) { return s.name.toLowerCase() === nombre.toLowerCase(); })) {
      errorNuevo('Ya existe un insumo que se llama ' + nombre + '.');
      nuevoNombre.focus();
      return;
    }

    if (!unidad) {
      errorNuevo('Poné cómo se cuenta: cucurucho, pote, botella, bolsa.');
      nuevoUnidad.focus();
      return;
    }

    if (!precio || precio <= 0) {
      errorNuevo('Poné el precio por unidad. Tiene que ser mayor a cero.');
      nuevoPrecio.focus();
      return;
    }

    if (!minimo || minimo <= 0) {
      errorNuevo('Poné debajo de qué cantidad querés que te avise.');
      nuevoMinimo.focus();
      return;
    }

    var nuevo = {
      id: 's-' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: nombre,
      categoria: nuevoCategoria.value,
      unidad: unidad,
      plural: unidad + 's',
      bulto: bulto,
      bulto_nombre: bulto > 1 ? 'caja' : '',
      price_per_unit: precio,
      codigo: '',
      minimo: minimo,
      minimoSuc: Math.max(1, Math.round(minimo / 2)),
      stock: 0,
      sucStock: 0
    };

    D.INSUMOS.push(nuevo);
    cerrarNuevo();
    render();

    mostrarToast(nombre + ' ya está en la lista. Cargale stock cuando llegue.',
      function () {
        var i = D.INSUMOS.indexOf(nuevo);
        if (i !== -1) D.INSUMOS.splice(i, 1);
        render();
      });
  });

  function errorNuevo(msg) {
    nuevoErrorTxt.textContent = msg;
    nuevoError.hidden = false;
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
