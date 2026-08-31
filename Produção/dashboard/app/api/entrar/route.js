import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

/**
 * GET /api/entrar?nicho=tenis&utm_source=instagram&utm_campaign=campanha1
 * 
 * Rota de redirect estável — esta é a URL que vai em TUDO:
 * bio do Instagram, anúncios, TikTok, etc.
 * 
 * Lógica:
 * 1. Recebe o nicho como parâmetro (default: tenis)
 * 2. Busca o grupo ativo mais recente daquele nicho
 * 3. Registra o clique (com UTMs) na tabela `cliques`
 * 4. Retorna HTTP 302 Redirect para o link de convite do grupo
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  const nicho = searchParams.get('nicho') || 'tenis';
  const utm_source = searchParams.get('utm_source') || null;
  const utm_medium = searchParams.get('utm_medium') || null;
  const utm_campaign = searchParams.get('utm_campaign') || null;
  const utm_content = searchParams.get('utm_content') || null;

  const supabase = getServiceClient();

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase não configurado. Configure as variáveis de ambiente.' },
      { status: 503 }
    );
  }

  try {
    // Buscar o grupo ativo mais recente do nicho
    const { data: grupo, error } = await supabase
      .from('grupos')
      .select('id, link_convite, nome_grupo, qtd_membros, capacidade_maxima')
      .eq('nicho', nicho)
      .eq('status', 'ativo')
      .order('numero_sequencial', { ascending: false })
      .limit(1)
      .single();

    if (error || !grupo || !grupo.link_convite) {
      return NextResponse.json(
        { error: `Nenhum grupo ativo encontrado para o nicho "${nicho}".` },
        { status: 404 }
      );
    }

    // Registrar o clique (async, não bloqueia o redirect)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    // Hash do IP para LGPD (não armazenar IP real)
    const ipHash = await hashString(ip);

    supabase
      .from('cliques')
      .insert({
        nicho,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        grupo_destino_id: grupo.id,
        ip_hash: ipHash,
        user_agent: userAgent.substring(0, 255),
        referer: request.headers.get('referer') || null,
      })
      .then(() => {}) // fire and forget
      .catch(() => {}); // don't let tracking errors block redirect

    // HTTP 302 Redirect para o grupo
    return NextResponse.redirect(grupo.link_convite, 302);

  } catch (err) {
    console.error('Erro no redirect:', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar o redirect.' },
      { status: 500 }
    );
  }
}

// Simple hash function for IP anonymization (LGPD compliance)
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str + 'salt_ofertas_2026');
  // Use a simple hash since crypto.subtle may not be available in all environments
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}
