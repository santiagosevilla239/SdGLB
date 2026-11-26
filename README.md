This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Prueba: Demanda de fábrica

En **Métricas de fábrica** se añadió una gráfica semanal y mensual con filtros por sucursal y gusto. La demanda suma cantidades solicitadas por otras sucursales y aperturas en Daireaux. Los despachos se muestran aparte, por su fecha real. Las aperturas se cuentan por fecha de escaneo en Argentina (00:00 a 24:00); Cerrar Día conserva su función actual.

Para probarlo, configurar una base Supabase separada con el esquema original y usuarios de prueba. Aplicar `supabase/migrations/202611190001_factory_metrics.sql` en esa base. El nuevo detalle por gusto de las aperturas y de los baldes transferidos empieza a registrarse al aplicar la migración. Los pedidos anteriores se leen desde sus registros existentes. El gráfico anterior de pedidos despachados pasa a agrupar por `delivery_date`; sus cantidades históricas aprobadas no sustituyen al nuevo conteo de baldes transferidos.

Prueba sugerida: pedir 6 baldes y enviar 4, comprobar que el gráfico muestre 6 pedidos y 4 despachados en las fechas que correspondan, abrir un balde en Daireaux y comprobar que se sume una sola vez, incluso después de pulsar Cerrar Día.

## Base del repositorio y Producción

La app Next.js del ZIP está en la raíz: Vercel debe usar la raíz del repositorio, preset Next.js y las dos variables públicas de Supabase. El ZIP permanece como referencia. El prototipo Vinext/D1 anterior queda disponible en el historial de Git.

En fábrica, **Producción** reutiliza el catálogo y cuenta los baldes en stock todavía sin sucursal asignada, como los registra la app base al cargarlos en fábrica. Agrega reposición por mínimos, existencias de materias primas, pedidos de compra, recepciones parciales e historial de estos movimientos. Se necesita el esquema operativo base, la migración de métricas y `supabase/migrations/202611260001_factory_planning.sql`, en ese orden. Los administradores se validan contra `profiles.role`; las políticas de Supabase deben darles visibilidad sobre el inventario de fábrica.

El despacho, la apertura de baldes, la balanza y Métricas siguen usando las pantallas y reglas del ZIP. No se importan datos de D1. Las recetas y fórmulas siguen fuera de la nube.

Si se habilitan las operaciones que requieren acceso administrativo, la clave privada va en `SUPABASE_SERVICE_ROLE_KEY`, solo del lado del servidor. La base de demostración de Métricas tiene reglas de solo lectura para las tablas operativas y no alcanza para probar los circuitos completos de sucursal.
