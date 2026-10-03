# Los Bambinos — primera versión

Aplicación TypeScript / React / Vinext con almacenamiento Cloudflare D1. Código portable; la publicación actual utiliza Sites y repositorio Git administrado.

## Ejecutar

Node.js 22.13 o superior. Instalar con `npm install` (o el gestor declarado en package.json). `npm run dev` inicia desarrollo. Aplicar las migraciones de drizzle al D1 local para guardar datos; el enlace de producción ya las aplica automáticamente. `npm run build` compila.

## Alcance implementado

- Sabores y mínimos por baldes; stock agregado sin ID individual ni lotes.
- Ingresos de producción con peso real; egresos asociados a pedido; ajuste automático si falta saldo, separado de producción.
- Requerimiento dinámico max(0, mínimo − stock), aceptación sin responsable.
- Pedidos por sucursal y sabor; envío parcial y recepción completa de lo enviado.
- Recetas por preparación, disponibilidad de ingredientes y descuento al iniciar.
- Almacén de materias primas con kg, L o unidades, ajustes con motivo.
- Pedido de compra y recepción parcial; exportación JSON e historial.
- Persistencia D1, control optimista de concurrencia e identificadores de operación contra repetición de la misma petición.

## Límites explícitos

- Balanza y formato del código de barras pendientes: lector puede rellenar código, pero sabor/peso se ingresan manualmente. No se simula integración física.
- Acceso privado del propietario; faltan cuentas y permisos individuales por sucursal y administrador.
- No implementa ventas al público, facturación, ingresos financieros, pronósticos ni recursos humanos.
- Recepción con diferencias, conversión automática de envases y sugerencia automática de compras pendientes. Para compras el faltante es visible en producción y se carga manualmente.
- Kilos en sucursal representan peso recibido; consumo parcial en mostrador no medido. Baldes de depósito se descuentan al mostrador.
- La primera versión guarda el estado en un documento JSON versionado en D1. Para crecimiento sostenido se debe normalizar en tablas por entidad y paginar historial.
- El ajuste automático corrige saldo numérico, no verifica inventario físico ni detecta baldes repetidos. Auditar avisos y hacer conteos.

## Reglas pendientes de validar

Recepción de materias primas solo suma stock al confirmar llegada, incluidas entregas parciales. Se adoptó como comportamiento inicial porque la conversación cambió de tema antes de confirmarlo.

## Próximos pasos

Validar etiquetas y protocolo de balanza; implementar permisos; probar circuito completo con datos reales; normalizar almacenamiento antes de uso intensivo.
