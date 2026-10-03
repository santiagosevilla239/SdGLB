import { env } from 'cloudflare:workers';
export function database(){ if(!env.DB) throw new Error('El almacenamiento no está disponible.'); return env.DB; }
