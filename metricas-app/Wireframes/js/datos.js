(function (global) {
  'use strict';

  var TARA_LATA = 0.42;

  var SABORES = [
    { id: 'f-carioca',  name: 'Carioca',                price_per_kilo: 1000,
      description: 'Crema sabor banana con dulce de leche repostero y salsa de chocolate',
      is_active: true, prefijo: 'CAR',  stock: 5, prom: 4.3, sucStock: 3 },
    { id: 'f-chocfrut', name: 'Chocolate con frutilla', price_per_kilo: 1000,
      description: '',
      is_active: true, prefijo: 'CHFR', stock: 8, prom: 4.2, sucStock: 0 },
    { id: 'f-rocklet',  name: 'Crema Rocklet',          price_per_kilo: 1000,
      description: 'Crema Americana con Rocklets',
      is_active: true, prefijo: 'ROCK', stock: 5, prom: 4.0, sucStock: 2 },
    { id: 'f-superdul', name: 'Super Dul',              price_per_kilo: 1000,
      description: 'Dulce de leche clásico con dulce de leche repostero y galletitas de chocolate',
      is_active: true, prefijo: 'SDUL', stock: 7, prom: 4.2, sucStock: 4 },

    { id: 'f-chocolate', name: 'Chocolate',      price_per_kilo: 1000,
      description: 'Chocolate semiamargo',
      is_active: true, prefijo: 'CHOC', stock: 6, prom: 4.1, sucStock: 1 },
    { id: 'f-ddl',       name: 'Dulce de leche', price_per_kilo: 1000,
      description: 'Dulce de leche clásico',
      is_active: true, prefijo: 'DDL',  stock: 3, prom: 3.9, sucStock: 5 },
    { id: 'f-frutilla',  name: 'Frutilla',       price_per_kilo: 1000,
      description: 'Frutilla a la crema',
      is_active: true, prefijo: 'FRUT', stock: 2, prom: 4.0, sucStock: 2 },
    { id: 'f-limon',     name: 'Limón',          price_per_kilo: 1000,
      description: 'Limón al agua',
      is_active: true, prefijo: 'LIMO', stock: 1, prom: 3.8, sucStock: 0 },
    { id: 'f-sambayon',  name: 'Sambayón',       price_per_kilo: 1000,
      description: 'Sambayón con marsala',
      is_active: true, prefijo: 'SAMB', stock: 2, prom: 4.1, sucStock: 6 },
    { id: 'f-tramontana', name: 'Tramontana',    price_per_kilo: 1000,
      description: 'Crema americana con trozos de chocolate',
      is_active: true, prefijo: 'TRAM', stock: 0, prom: 0,   sucStock: 1 }
  ];

  var SUCURSALES = [
    { id: 'b-central',  name: 'Fábrica Central', address: 'La calle 123', is_central: true },
    { id: 'b-nico',     name: 'Suc. Nico',       address: 'nico 123',     is_central: false },
    { id: 'b-caballito', name: 'Suc. Caballito', address: 'Rivadavia 4800', is_central: false },
    { id: 'b-palermo',  name: 'Suc. Palermo',    address: 'Santa Fe 3200',  is_central: false },
    { id: 'b-belgrano', name: 'Suc. Belgrano',   address: 'Cabildo 2100',   is_central: false },
    { id: 'b-flores',   name: 'Suc. Flores',     address: 'Rivadavia 6900', is_central: false }
  ];

  var OFFSETS = [0, -0.1, 0.1, -0.2, 0.2, -0.1, 0.1, 0];
  var FECHAS  = ['hoy 09:14', 'hoy 08:40', 'hoy 08:05', 'ayer 18:20',
                 'ayer 17:05', 'ayer 11:30', 'anteayer 16:10', 'anteayer 09:50'];

  var eanBase = 2000003005100;

  function construirLatas() {
    var latas = [];
    var n = 0;

    function nueva(sabor, i, branchId) {
      var prom  = sabor.prom || 4.0;
      var neto  = redondear(prom + OFFSETS[i % OFFSETS.length]);
      var bruto = redondear(neto + TARA_LATA);
      n++;

      return {
        id: 't-' + sabor.prefijo.toLowerCase() + '-' + n,
        flavor_id: sabor.id,
        flavor_name: sabor.name,
        branch_id: branchId,
        internal_code: (n % 3 === 0)
          ? String(eanBase + n)
          : 'LB-' + sabor.prefijo + '-' + pad(n),
        gross_weight: bruto,
        net_weight: neto,
        total_price: Math.round(neto * sabor.price_per_kilo),
        status: 'in_stock',
        order_id: null,
        created_at: FECHAS[i % FECHAS.length]
      };
    }

    SABORES.forEach(function (sabor) {
      var i;
      for (i = 0; i < sabor.stock; i++) latas.push(nueva(sabor, i, null));
      for (i = 0; i < (sabor.sucStock || 0); i++) latas.push(nueva(sabor, i, 'b-caballito'));
    });

    return latas;
  }

  function pad(n) {
    return (n < 10 ? '00' : n < 100 ? '0' : '') + n;
  }

  function redondear(n) {
    return Math.round(n * 10) / 10;
  }

  var LATAS = construirLatas();

  var INSUMOS = [
    { id: 's-cucu-clasico', name: 'Cucurucho clásico', categoria: 'Cucuruchos',
      unidad: 'cucurucho', plural: 'cucuruchos', bulto: 100, bulto_nombre: 'caja',
      price_per_unit: 120, codigo: '7791111000018', minimo: 300, minimoSuc: 150,
      stock: 1240, sucStock: 380 },

    { id: 's-cucu-banado', name: 'Cucurucho bañado', categoria: 'Cucuruchos',
      unidad: 'cucurucho', plural: 'cucuruchos', bulto: 50, bulto_nombre: 'caja',
      price_per_unit: 210, codigo: '7791111000025', minimo: 150, minimoSuc: 60,
      stock: 90, sucStock: 45 },

    { id: 's-pote-cuarto', name: 'Pote 1/4 kg', categoria: 'Potes',
      unidad: 'pote', plural: 'potes', bulto: 50, bulto_nombre: 'paquete',
      price_per_unit: 95, codigo: '7791111000032', minimo: 200, minimoSuc: 100,
      stock: 600, sucStock: 150 },

    { id: 's-pote-medio', name: 'Pote 1/2 kg', categoria: 'Potes',
      unidad: 'pote', plural: 'potes', bulto: 50, bulto_nombre: 'paquete',
      price_per_unit: 130, codigo: '7791111000049', minimo: 200, minimoSuc: 80,
      stock: 250, sucStock: 60 },

    { id: 's-pote-kilo', name: 'Pote 1 kg', categoria: 'Potes',
      unidad: 'pote', plural: 'potes', bulto: 50, bulto_nombre: 'paquete',
      price_per_unit: 180, codigo: '7791111000056', minimo: 150, minimoSuc: 60,
      stock: 0, sucStock: 20 },

    { id: 's-salsa-choco', name: 'Salsa de chocolate', categoria: 'Salsas',
      unidad: 'botella', plural: 'botellas', bulto: 6, bulto_nombre: 'caja',
      price_per_unit: 3400, codigo: '7791111000063', minimo: 12, minimoSuc: 4,
      stock: 36, sucStock: 8 },

    { id: 's-salsa-ddl', name: 'Salsa de dulce de leche', categoria: 'Salsas',
      unidad: 'botella', plural: 'botellas', bulto: 6, bulto_nombre: 'caja',
      price_per_unit: 3200, codigo: '7791111000070', minimo: 12, minimoSuc: 4,
      stock: 8, sucStock: 3 },

    { id: 's-hielo', name: 'Hielo en escamas', categoria: 'Hielo',
      unidad: 'bolsa de 10 kg', plural: 'bolsas de 10 kg', bulto: 0, bulto_nombre: '',
      price_per_unit: 2800, codigo: '7791111000087', minimo: 10, minimoSuc: 4,
      stock: 24, sucStock: 6 },

    { id: 's-bombon', name: 'Bombón escocés', categoria: 'Postres',
      unidad: 'postre', plural: 'postres', bulto: 12, bulto_nombre: 'caja',
      price_per_unit: 1500, codigo: '7791111000094', minimo: 24, minimoSuc: 12,
      stock: 96, sucStock: 18 },

    { id: 's-almendrado', name: 'Almendrado', categoria: 'Postres',
      unidad: 'postre', plural: 'postres', bulto: 12, bulto_nombre: 'caja',
      price_per_unit: 1700, codigo: '7791111000100', minimo: 24, minimoSuc: 12,
      stock: 48, sucStock: 0 }
  ];

  var CATEGORIAS_INSUMO = ['Cucuruchos', 'Potes', 'Salsas', 'Hielo', 'Postres'];

  var PEDIDOS = [
    {
      id: 'PED-8EA4', branch_id: 'b-caballito', status: 'pendiente',
      created_at: 'Hoy 10:20', branchNotes: 'Si no llegan las 3 de Carioca, mandá lo que haya.',
      adminNotes: '',
      items: [
        { flavor_id: 'f-carioca',   quantity: 3 },
        { flavor_id: 'f-superdul',  quantity: 2 },
        { flavor_id: 'f-frutilla',  quantity: 1 }
      ],
      supplies: [
        { supply_id: 's-cucu-clasico', quantity: 300 },
        { supply_id: 's-pote-cuarto',  quantity: 100 }
      ]
    },
    {
      id: 'PED-7FE5', branch_id: 'b-palermo', status: 'pendiente',
      created_at: 'Hoy 09:05', branchNotes: '', adminNotes: '',
      items: [
        { flavor_id: 'f-tramontana', quantity: 2 },
        { flavor_id: 'f-rocklet',    quantity: 1 },
        { flavor_id: 'f-limon',      quantity: 2 }
      ]
    },
    {
      id: 'PED-9A64', branch_id: 'b-nico', status: 'contraoferta',
      created_at: 'Ayer 16:40', branchNotes: '',
      adminNotes: 'Solo me quedan 2 latas de Limón. Te mando el resto completo.',
      items: [
        { flavor_id: 'f-chocfrut', quantity: 4, approvedQuantity: 4 },
        { flavor_id: 'f-limon',    quantity: 4, approvedQuantity: 2 }
      ]
    },
    {
      id: 'PED-FD63', branch_id: 'b-belgrano', status: 'confirmado',
      created_at: 'Hoy 08:15', branchNotes: '', adminNotes: '',
      items: [
        { flavor_id: 'f-chocolate', quantity: 2 },
        { flavor_id: 'f-superdul',  quantity: 2 }
      ]
    },
    {
      id: 'PED-4AE3', branch_id: 'b-flores', status: 'confirmado',
      created_at: 'Ayer 18:30', branchNotes: '', adminNotes: '',
      items: [
        { flavor_id: 'f-carioca',  quantity: 1 },
        { flavor_id: 'f-sambayon', quantity: 2 }
      ]
    },
    {
      id: 'PED-2C11', branch_id: 'b-caballito', status: 'despachado',
      created_at: 'Ayer 17:30', branchNotes: '', adminNotes: '',
      items: [
        { flavor_id: 'f-rocklet',  quantity: 2 },
        { flavor_id: 'f-superdul', quantity: 1 }
      ]
    },
    {
      id: 'PED-B0A9', branch_id: 'b-belgrano', status: 'entregado',
      created_at: 'Anteayer 14:20', branchNotes: 'Llegó todo bien.', adminNotes: '',
      items: [
        { flavor_id: 'f-chocfrut', quantity: 2 }
      ]
    },
    {
      id: 'PED-C4D1', branch_id: 'b-caballito', status: 'contraoferta',
      created_at: 'Hoy 08:50', branchNotes: '',
      adminNotes: 'De Frutilla me queda 1 sola lata. El resto va completo.',
      items: [
        { flavor_id: 'f-chocolate', quantity: 2, approvedQuantity: 2 },
        { flavor_id: 'f-frutilla',  quantity: 3, approvedQuantity: 1 }
      ]
    },
    {
      id: 'PED-A712', branch_id: 'b-caballito', status: 'confirmado',
      created_at: 'Hoy 07:40', branchNotes: '', adminNotes: '',
      items: [
        { flavor_id: 'f-sambayon', quantity: 1 },
        { flavor_id: 'f-rocklet',  quantity: 2 }
      ],
      supplies: [
        { supply_id: 's-salsa-choco', quantity: 6 },
        { supply_id: 's-bombon',      quantity: 24 }
      ]
    },
    {
      id: 'PED-E930', branch_id: 'b-caballito', status: 'entregado',
      created_at: 'Anteayer 10:15', branchNotes: 'Llegó todo bien.', adminNotes: '',
      items: [
        { flavor_id: 'f-carioca',   quantity: 2 },
        { flavor_id: 'f-superdul',  quantity: 2 },
        { flavor_id: 'f-chocfrut',  quantity: 1 }
      ],
      supplies: [
        { supply_id: 's-cucu-clasico', quantity: 200 },
        { supply_id: 's-hielo',        quantity: 4 }
      ]
    },
    {
      id: 'PED-11F0', branch_id: 'b-caballito', status: 'cancelado',
      created_at: 'Anteayer 08:05', branchNotes: 'Me equivoqué de cantidad.',
      adminNotes: '',
      items: [
        { flavor_id: 'f-tramontana', quantity: 4 }
      ]
    },
    {
      id: 'PED-5D72', branch_id: 'b-palermo', status: 'rechazado',
      created_at: 'Anteayer 11:00', branchNotes: '', adminNotes: '',
      items: [
        { flavor_id: 'f-tramontana', quantity: 3 }
      ]
    },
    {
      id: 'PED-3F18', branch_id: 'b-nico', status: 'cancelado',
      created_at: 'Anteayer 09:40', branchNotes: 'Me equivoqué de sabor.', adminNotes: '',
      items: [
        { flavor_id: 'f-limon', quantity: 1 }
      ]
    }
  ];

  function asignarLatasSembradas() {
    PEDIDOS.forEach(function (pedido) {
      if (pedido.status !== 'despachado' && pedido.status !== 'entregado') return;

      pedido.items.forEach(function (item) {
        var disponibles = LATAS.filter(function (l) {
          return l.flavor_id === item.flavor_id &&
                 l.status === 'in_stock' &&
                 l.branch_id === null;
        }).slice(0, item.quantity);

        item.assignedTubs = disponibles.map(function (l) {
          l.order_id = pedido.id;

          if (pedido.status === 'entregado') {
            l.branch_id = pedido.branch_id;
            l.status    = 'in_stock';
          } else {
            l.status = 'in_transit';
          }

          return l.internal_code;
        });
      });
    });
  }

  asignarLatasSembradas();

  var ESTADO_PEDIDO = {
    pendiente:    { cls: 'pill--pendiente',   txt: 'Pendiente' },
    contraoferta: { cls: 'pill--contraoferta', txt: 'Contraoferta enviada' },
    confirmado:   { cls: 'pill--confirmado',  txt: 'Confirmado' },
    despachado:   { cls: 'pill--despachado',  txt: 'Despachado' },
    entregado:    { cls: 'pill--recibido',    txt: 'Entregado' },
    rechazado:    { cls: 'pill--rechazado',   txt: 'Rechazado' },
    cancelado:    { cls: 'pill--cancelado',   txt: 'Cancelado' }
  };

  var ESTADO_LATA = {
    in_stock:   { cls: 'pill--disponible', txt: 'En stock' },
    in_transit: { cls: 'pill--despachado', txt: 'En camino' },
    consumed:   { cls: 'pill--consumida',  txt: 'Consumida' }
  };

  function sabor(id) {
    return SABORES.filter(function (f) { return f.id === id; })[0] || null;
  }

  function saborPorNombre(nombre) {
    return SABORES.filter(function (f) { return f.name === nombre; })[0] || null;
  }

  function sucursal(id) {
    return SUCURSALES.filter(function (b) { return b.id === id; })[0] || null;
  }

  function latasDe(flavorId, estado) {
    return LATAS.filter(function (l) {
      return l.flavor_id === flavorId &&
             l.branch_id === null &&
             (!estado || l.status === estado);
    });
  }

  function latasSucursal(branchId, flavorId, estado) {
    return LATAS.filter(function (l) {
      return l.branch_id === branchId &&
             (!flavorId || l.flavor_id === flavorId) &&
             (!estado || l.status === estado);
    });
  }

  function stockSucursal(branchId, flavorId) {
    return latasSucursal(branchId, flavorId, 'in_stock').length;
  }

  function lataPorCodigo(codigo) {
    var buscado = String(codigo).trim().toUpperCase();
    return LATAS.filter(function (l) {
      return l.internal_code.toUpperCase() === buscado;
    })[0] || null;
  }

  function buscarLatas(texto, flavorIds) {
    var q = String(texto).trim().toLowerCase();
    if (!q) return [];

    return LATAS.filter(function (l) {
      if (l.status !== 'in_stock' || l.branch_id !== null) return false;
      if (flavorIds && flavorIds.length && flavorIds.indexOf(l.flavor_id) === -1) return false;
      return l.internal_code.toLowerCase().indexOf(q) !== -1 ||
             l.flavor_name.toLowerCase().indexOf(q) !== -1;
    });
  }

  function estadoStock(cantidad) {
    if (cantidad === 0) return { tipo: 'sin-stock',  txt: 'Sin stock' };
    if (cantidad < 5)   return { tipo: 'limitado',   txt: 'Limitado' };
    return { tipo: 'disponible', txt: 'Disponible' };
  }

  function estadoStockSucursal(cantidad) {
    if (cantidad === 0) return { tipo: 'sin-stock', txt: 'Sin stock' };
    if (cantidad < 4)   return { tipo: 'limitado',  txt: 'Limitado' };
    return { tipo: 'disponible', txt: 'Disponible' };
  }

  function insumo(id) {
    return INSUMOS.filter(function (s) { return s.id === id; })[0] || null;
  }

  function insumoPorCodigo(codigo) {
    var buscado = String(codigo).trim().toUpperCase();
    return INSUMOS.filter(function (s) {
      return String(s.codigo).toUpperCase() === buscado;
    })[0] || null;
  }

  function estadoInsumo(cantidad, minimo) {
    if (cantidad === 0) return { tipo: 'sin-stock', txt: 'Sin stock' };
    if (cantidad < minimo) return { tipo: 'limitado', txt: 'Limitado' };
    return { tipo: 'disponible', txt: 'Disponible' };
  }

  function cantidadInsumo(cantidad, ins) {
    var texto = cantidad.toLocaleString('es-AR') + ' ' +
                (cantidad === 1 ? ins.unidad : ins.plural);

    if (ins.bulto > 1 && cantidad >= ins.bulto) {
      var bultos = Math.floor(cantidad / ins.bulto);
      texto += ' (' + bultos + ' ' + ins.bulto_nombre + (bultos === 1 ? '' : 's') + ')';
    }
    return texto;
  }

  function insumosDe(pedido) {
    return pedido.supplies || [];
  }

  function totalInsumos(pedido) {
    return insumosDe(pedido).reduce(function (acc, i) {
      return acc + cantidadVigente(i);
    }, 0);
  }

  function stockDe(flavorId) {
    return latasDe(flavorId, 'in_stock').length;
  }

  function cantidadVigente(item) {
    return (item.approvedQuantity === undefined || item.approvedQuantity === null)
      ? item.quantity
      : item.approvedQuantity;
  }

  function totalLatas(pedido) {
    return pedido.items.reduce(function (acc, i) { return acc + cantidadVigente(i); }, 0);
  }

  function precioEstimado(pedido) {
    var latas = pedido.items.reduce(function (acc, item) {
      var f = sabor(item.flavor_id);
      if (!f) return acc;
      return acc + cantidadVigente(item) * f.prom * f.price_per_kilo;
    }, 0);

    var insumos = insumosDe(pedido).reduce(function (acc, item) {
      var s = insumo(item.supply_id);
      return s ? acc + cantidadVigente(item) * s.price_per_unit : acc;
    }, 0);

    return latas + insumos;
  }

  function precioInsumos(pedido) {
    return insumosDe(pedido).reduce(function (acc, item) {
      var s = insumo(item.supply_id);
      return s ? acc + cantidadVigente(item) * s.price_per_unit : acc;
    }, 0);
  }

  function precioFinal(pedido) {
    var latas = pedido.items.reduce(function (acc, item) {
      if (!item.assignedTubs) return acc;
      return acc + item.assignedTubs.reduce(function (sub, codigo) {
        var lata = lataPorCodigo(codigo);
        return sub + (lata ? lata.total_price : 0);
      }, 0);
    }, 0);

    return latas ? latas + precioInsumos(pedido) : 0;
  }

  function fmtKg(n) {
    return (Math.round(n * 10) / 10).toFixed(1) + ' kg';
  }

  function fmtPrecio(n) {
    return '$' + Math.round(n).toLocaleString('es-AR');
  }

  function plural(n, singular, prural) {
    return n + ' ' + (n === 1 ? singular : prural);
  }

  global.DATOS = {
    TARA_LATA: TARA_LATA,
    SUCURSAL_ACTUAL: 'b-caballito',
    SABORES: SABORES,
    INSUMOS: INSUMOS,
    CATEGORIAS_INSUMO: CATEGORIAS_INSUMO,
    SUCURSALES: SUCURSALES,
    LATAS: LATAS,
    PEDIDOS: PEDIDOS,
    ESTADO_PEDIDO: ESTADO_PEDIDO,
    ESTADO_LATA: ESTADO_LATA,
    sabor: sabor,
    saborPorNombre: saborPorNombre,
    sucursal: sucursal,
    latasDe: latasDe,
    latasSucursal: latasSucursal,
    stockSucursal: stockSucursal,
    lataPorCodigo: lataPorCodigo,
    buscarLatas: buscarLatas,
    estadoStock: estadoStock,
    estadoStockSucursal: estadoStockSucursal,
    insumo: insumo,
    insumoPorCodigo: insumoPorCodigo,
    estadoInsumo: estadoInsumo,
    cantidadInsumo: cantidadInsumo,
    insumosDe: insumosDe,
    totalInsumos: totalInsumos,
    precioInsumos: precioInsumos,
    stockDe: stockDe,
    cantidadVigente: cantidadVigente,
    totalLatas: totalLatas,
    precioEstimado: precioEstimado,
    precioFinal: precioFinal,
    fmtKg: fmtKg,
    fmtPrecio: fmtPrecio,
    plural: plural
  };

}(window));
