(function () {
  'use strict';

  var form       = document.getElementById('login-form');
  var inputUsr   = document.getElementById('usr');
  var inputPwd   = document.getElementById('pwd');
  var btnSubmit  = document.getElementById('btn-submit');
  var btnToggle  = document.getElementById('pwd-toggle');
  var errorBox   = document.getElementById('login-error');
  var errorText  = document.getElementById('login-error-text');

  if (!form) return;

  btnToggle.addEventListener('click', function () {
    var isPassword = inputPwd.type === 'password';

    inputPwd.type           = isPassword ? 'text' : 'password';
    btnToggle.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');

    var icon = btnToggle.querySelector('i');
    icon.classList.toggle('ti-eye',     !isPassword);
    icon.classList.toggle('ti-eye-off',  isPassword);
  });

  [inputUsr, inputPwd].forEach(function (input) {
    input.addEventListener('input', function () {
      if (input.classList.contains('field-input--error')) {
        input.classList.remove('field-input--error');

        if (!inputUsr.classList.contains('field-input--error') &&
            !inputPwd.classList.contains('field-input--error')) {
          ocultarError();
        }
      }
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var usr = inputUsr.value.trim();
    var pwd = inputPwd.value.trim();

    if (!usr && !pwd) {
      mostrarError('Faltan datos. Completá usuario y contraseña para entrar.');
      marcarError(inputUsr);
      marcarError(inputPwd);
      inputUsr.focus();
      return;
    }

    if (!usr) {
      mostrarError('Falta el usuario.');
      marcarError(inputUsr);
      inputUsr.focus();
      return;
    }

    if (!pwd) {
      mostrarError('Te falta la contraseña.');
      marcarError(inputPwd);
      inputPwd.focus();
      return;
    }

    ocultarError();
    setLoading(true);

    setTimeout(function () {
      window.location.href = '01-dashboard.html';
    }, 800);
  });

  function mostrarError(mensaje) {
    errorText.textContent = mensaje;
    errorBox.hidden = false;
  }

  function ocultarError() {
    errorBox.hidden = true;
    errorText.textContent = '';
  }

  function marcarError(input) {
    input.classList.add('field-input--error');
  }

  function setLoading(activo) {
    btnSubmit.disabled = activo;

    if (activo) {
      btnSubmit.innerHTML =
        '<i class="ti ti-loader-2 spin" aria-hidden="true"></i> Entrando...';
    } else {
      btnSubmit.innerHTML =
        '<i class="ti ti-login-2" aria-hidden="true"></i> Entrar al sistema';
    }
  }

}());
