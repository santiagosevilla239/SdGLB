import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Si hay un token hash en la URL (Implicit flow), el cliente SSR lo maneja si se visita la página, 
  // pero lo normal con generateLink es que devuelva `token_hash` o `code` según la configuración.
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Fallback a login si algo falla
  return NextResponse.redirect(`${origin}/login?error=Invalid_or_expired_link`);
}
