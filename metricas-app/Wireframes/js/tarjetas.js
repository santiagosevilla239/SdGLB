(function (global) {
  'use strict';

  function tarjeta(item) {
    var html = '<article class="data-card" ' + (item.atributos || '') + '>';

    html += '<div class="data-card-head">' +
              '<h3 class="data-card-titulo">' + item.titulo +
                (item.subtitulo
                  ? '<span class="data-card-sub">' + item.subtitulo + '</span>'
                  : '') +
              '</h3>' +
              (item.pill
                ? '<span class="pill ' + item.pill.cls + '">' + item.pill.txt + '</span>'
                : '') +
            '</div>';

    if (item.datos && item.datos.length) {
      html += '<div class="data-card-datos">' +
                item.datos.map(function (d) {
                  return '<div class="data-card-dato">' +
                           '<span class="data-card-lbl">' + d.lbl + '</span>' +
                           '<span class="data-card-val">' + d.val + '</span>' +
                         '</div>';
                }).join('') +
              '</div>';
    }

    if (item.acciones) {
      html += '<div class="data-card-acciones">' + item.acciones + '</div>';
    }

    return html + '</article>';
  }

  function render(contenedor, items, textoVacio) {
    if (!contenedor) return;

    if (!items || !items.length) {
      contenedor.innerHTML = '<p class="cards-vacio">' +
                             (textoVacio || 'Todavía no hay nada acá.') + '</p>';
      return;
    }

    contenedor.innerHTML = items.map(tarjeta).join('');
  }

  global.Tarjetas = { render: render, tarjeta: tarjeta };

}(window));
