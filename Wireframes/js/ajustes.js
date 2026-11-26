(function () {
  'use strict';

  var D = window.DATOS;

  var toast      = document.getElementById('toast');
  var toastText  = document.getElementById('toast-text');
  var toastUndo  = document.getElementById('toast-undo');
  var toastClose = document.getElementById('toast-close');

  var toastTimer = null;
  var deshacer   = null;

  var formClave    = document.getElementById('form-clave');
  var claveNueva   = document.getElementById('clave-nueva');
  var claveRepetir = document.getElementById('clave-repetir');
  var claveError   = document.getElementById('clave-error');
  var claveErrorTx = document.getElementById('clave-error-text');

  if (formClave) {
    formClave.addEventListener('submit', function (e) {
      e.preventDefault();

      var nueva   = claveNueva.value;
      var repetir = claveRepetir.value;

      if (nueva.length < 6) {
        errorClave('La contraseña tiene que tener 6 caracteres o más.');
        claveNueva.focus();
        return;
      }

      if (nueva !== repetir) {
        errorClave('Las dos contraseñas no son iguales. Fijate de nuevo.');
        claveRepetir.focus();
        return;
      }

      claveError.hidden = true;
      formClave.reset();
      mostrarToast('Listo. La próxima vez que entres usá la contraseña nueva.');
    });
  }

  function errorClave(msg) {
    claveErrorTx.textContent = msg;
    claveError.hidden = false;
  }

  var formSucursal = document.getElementById('form-sucursal');
  var sucNombre    = document.getElementById('suc-nombre');
  var sucDireccion = document.getElementById('suc-direccion');
  var sucEmail     = document.getElementById('suc-email');
  var sucClave     = document.getElementById('suc-clave');
  var sucError     = document.getElementById('sucursal-error');
  var sucErrorTx   = document.getElementById('sucursal-error-text');
  var sucursalesBody = document.getElementById('sucursales-body');

  function renderSucursales() {
    if (!sucursalesBody) return;

    var sucursales = D.SUCURSALES.filter(function (s) { return !s.is_central; });

    sucursalesBody.innerHTML = sucursales.map(function (s) {
      return '<tr>' +
               '<td>' + s.name + '</td>' +
               '<td class="col-muted">' + (s.address || '—') + '</td>' +
             '</tr>';
    }).join('');

    window.Tarjetas.render(document.getElementById('sucursales-cards'),
      sucursales.map(function (s) {
        return {
          titulo: s.name,
          datos: [{ lbl: 'Dirección', val: s.address || '—' }]
        };
      }), 'Todavía no hay sucursales dadas de alta.');
  }

  if (formSucursal) {
    formSucursal.addEventListener('submit', function (e) {
      e.preventDefault();

      var nombre = sucNombre.value.trim();

      if (!nombre) {
        errorSucursal('Poné el nombre de la sucursal.');
        sucNombre.focus();
        return;
      }

      if (D.SUCURSALES.some(function (s) { return s.name === nombre; })) {
        errorSucursal('Ya existe una sucursal que se llama ' + nombre + '.');
        sucNombre.focus();
        return;
      }

      if (!sucEmail.value.trim()) {
        errorSucursal('Poné el mail con el que va a entrar la sucursal.');
        sucEmail.focus();
        return;
      }

      if (sucClave.value.length < 6) {
        errorSucursal('La contraseña tiene que tener 6 caracteres o más.');
        sucClave.focus();
        return;
      }

      var nueva = {
        id: 'b-' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: nombre,
        address: sucDireccion.value.trim(),
        is_central: false
      };

      D.SUCURSALES.push(nueva);
      sucError.hidden = true;
      formSucursal.reset();
      renderSucursales();

      mostrarToast(nombre + ' ya puede entrar y pedirte mercadería.', function () {
        var i = D.SUCURSALES.indexOf(nueva);
        if (i !== -1) D.SUCURSALES.splice(i, 1);
        renderSucursales();
      });
    });
  }

  function errorSucursal(msg) {
    sucErrorTx.textContent = msg;
    sucError.hidden = false;
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

  renderSucursales();

}());
