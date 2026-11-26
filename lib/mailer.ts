import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { format } from "date-fns";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export type OrderAction = 
  | "created"
  | "cancelled"
  | "confirmed"
  | "counter_offer"
  | "counter_offer_accepted"
  | "counter_offer_rejected"
  | "dispatched"
  | "received";

export async function sendOrderNotification(
  toEmail: string,
  orderId: string,
  action: OrderAction,
  details?: string,
  priceInfo?: { estimatedPrice?: number, totalPrice?: number }
) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP credentials not set, skipping email notification");
    return;
  }

  let shortId = `PED-${orderId.substring(0, 4).toUpperCase()}`;
  let subject = "";
  let html = "";

  try {
    const supabase = createAdminClient();
    const { data: order } = await supabase
      .from("orders")
      .select(`
        created_at,
        branches ( name ),
        order_items ( quantity, approved_quantity, flavors ( name ) ),
        supply_order_items ( quantity, approved_quantity, supplies ( name, price_per_unit ) ),
        tubs ( flavor_id, internal_code, net_weight, total_price, flavors ( name ) )
      `)
      .eq("id", orderId)
      .single();

    if (order) {
      const orderAny = order as any;
      const branchStr = (orderAny.branches?.name || "Desconocida").toUpperCase().replace("SUCURSAL", "").trim().replace(/\s+/g, '');
      const datePart = order.created_at ? format(new Date(order.created_at), "ddMMyy") : "000000";
      shortId = `PED-${datePart}${branchStr}`;
      
      let detailsHtml = '<br/><table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
      detailsHtml += '<tr style="background-color: #fca5a5; color: white;"><th>Tipo</th><th>Nombre</th><th>Cant. / Peso</th></tr>';
      
      if (order.tubs && order.tubs.length > 0) {
        order.tubs.forEach((tub: any) => {
          detailsHtml += `<tr><td>Helado</td><td>${tub.flavors?.name || 'Helado'}</td><td>${tub.net_weight ? tub.net_weight.toFixed(3) + ' kg' : 'N/A'}</td></tr>`;
        });
      } else if (order.order_items && order.order_items.length > 0) {
        order.order_items.forEach((item: any) => {
          const qty = item.approved_quantity !== null ? item.approved_quantity : item.quantity;
          detailsHtml += `<tr><td>Helado Solicitado</td><td>${item.flavors?.name || 'Desconocido'}</td><td>${qty} latas</td></tr>`;
        });
      }

      if (order.supply_order_items && order.supply_order_items.length > 0) {
        order.supply_order_items.forEach((item: any) => {
          const qty = item.approved_quantity !== null ? item.approved_quantity : item.quantity;
          detailsHtml += `<tr><td>Insumo</td><td>${item.supplies?.name || 'Desconocido'}</td><td>${qty} unid.</td></tr>`;
        });
      }
      detailsHtml += '</table><br/>';
      details = (details || "") + detailsHtml;
    }
  } catch (e) {
    console.error("Error fetching order details for email:", e);
  }

  switch (action) {
    case "created":
      subject = `Nuevo Pedido Creado - ${shortId}`;
      html = `<h2>Un nuevo pedido ha sido creado</h2><p>El pedido <strong>${shortId}</strong> está ahora pendiente de confirmación en la fábrica.</p>`;
      break;
    case "cancelled":
      subject = `Pedido Cancelado - ${shortId}`;
      html = `<h2>Pedido Cancelado</h2><p>El pedido <strong>${shortId}</strong> ha sido cancelado por la sucursal.</p>`;
      break;
    case "confirmed":
      subject = `Pedido Confirmado - ${shortId}`;
      html = `<h2>Pedido Confirmado</h2><p>La fábrica ha confirmado tu pedido <strong>${shortId}</strong> y comenzará a prepararlo.</p>`;
      break;
    case "counter_offer":
      subject = `Contraoferta Recibida - ${shortId}`;
      html = `<h2>Contraoferta de la Fábrica</h2><p>La fábrica ha enviado una contraoferta para el pedido <strong>${shortId}</strong>. Por favor, revisa el panel para aceptarla o rechazarla.</p>`;
      break;
    case "counter_offer_accepted":
      subject = `Contraoferta Aceptada - ${shortId}`;
      html = `<h2>Contraoferta Aceptada</h2><p>La sucursal ha aceptado la contraoferta para el pedido <strong>${shortId}</strong>.</p>`;
      break;
    case "counter_offer_rejected":
      subject = `Contraoferta Rechazada - ${shortId}`;
      html = `<h2>Contraoferta Rechazada</h2><p>La sucursal ha rechazado la contraoferta para el pedido <strong>${shortId}</strong>. Volvió a estado Pendiente.</p>`;
      break;
    case "dispatched":
      subject = `Pedido Despachado - ${shortId}`;
      html = `<h2>Pedido en Camino</h2><p>Tu pedido <strong>${shortId}</strong> ha sido despachado por la fábrica y está en camino.</p>`;
      break;
    case "received":
      subject = `Pedido Recibido - ${shortId}`;
      html = `<h2>Pedido Recibido</h2><p>La sucursal ha confirmado la recepción del pedido <strong>${shortId}</strong>.</p>`;
      break;
  }

  if (priceInfo?.estimatedPrice !== undefined && priceInfo.estimatedPrice > 0 && (action === "created" || action === "counter_offer" || action === "counter_offer_rejected")) {
    html += `<p><strong>Precio Estimado:</strong> $${priceInfo.estimatedPrice.toLocaleString('es-AR')}</p>`;
  }

  if (priceInfo?.totalPrice !== undefined && priceInfo.totalPrice > 0 && (action === "confirmed" || action === "counter_offer_accepted" || action === "dispatched" || action === "received")) {
    html += `<p><strong>Precio Final:</strong> $${priceInfo.totalPrice.toLocaleString('es-AR')}</p>`;
  }

  if (details) {
    html += `<p><strong>Detalles adicionales:</strong> ${details}</p>`;
  }

  html += `<br/><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard/orders">Ver en el sistema</a></p>`;

  try {
    await transporter.sendMail({
      from: `"Los Bambinos" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html,
    });
    console.log(`Notification sent to ${toEmail} for order ${shortId} (${action})`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

export async function sendWelcomeNotification(
  toEmail: string,
  passwordTemp: string,
  branchName: string
) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP credentials not set, skipping welcome email");
    return;
  }

  const subject = `¡Bienvenido a Los Bambinos - ${branchName}!`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  const html = `
    <h2>¡Hola! Se ha creado tu cuenta para la sucursal <strong>${branchName}</strong>.</h2>
    <p>Ya puedes acceder al sistema de gestión de Los Bambinos con las siguientes credenciales temporales:</p>
    <ul>
      <li><strong>Correo:</strong> ${toEmail}</li>
      <li><strong>Contraseña Temporal:</strong> ${passwordTemp}</li>
    </ul>
    <p>Por seguridad, te recomendamos cambiar tu contraseña desde la sección de Configuración una vez ingreses al sistema.</p>
    <br/>
    <p><a href="${siteUrl}/login" style="padding: 10px 15px; background-color: #fca5a5; color: white; text-decoration: none; border-radius: 5px;">Ingresar al Sistema</a></p>
  `;

  try {
    await transporter.sendMail({
      from: `"Los Bambinos" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html,
    });
    console.log(`Welcome notification sent to ${toEmail} for branch ${branchName}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
}

export async function sendPasswordRecoveryEmail(
  toEmail: string,
  resetLink: string
) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP credentials not set, skipping recovery email");
    return;
  }

  const subject = `Recuperación de contraseña - Los Bambinos`;
  
  const html = `
    <h2>¿Olvidaste tu contraseña?</h2>
    <p>Hemos recibido una solicitud para recuperar la contraseña de tu cuenta (<strong>${toEmail}</strong>).</p>
    <p>Haz clic en el siguiente botón para establecer una nueva contraseña:</p>
    <br/>
    <p><a href="${resetLink}" style="padding: 10px 15px; background-color: #ED1C24; color: white; text-decoration: none; border-radius: 5px;">Recuperar mi contraseña</a></p>
    <br/>
    <p>Si no fuiste tú, por favor ignora este correo.</p>
  `;

  try {
    await transporter.sendMail({
      from: `"Los Bambinos" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html,
    });
    console.log(`Password recovery email sent to ${toEmail}`);
  } catch (error) {
    console.error("Error sending recovery email:", error);
  }
}
