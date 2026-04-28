import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { accessToken, refreshToken } = await request.json();

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({ error: 'Tokens required' }), { status: 400 });
    }

    // Set cookies server-side (more reliable than document.cookie)
    cookies.set('sb-access-token', accessToken, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: true,
      httpOnly: false,
      sameSite: 'lax',
    });

    cookies.set('sb-refresh-token', refreshToken, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      secure: true,
      httpOnly: false,
      sameSite: 'lax',
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Set session error:', error);
    return new Response(JSON.stringify({ error: 'Failed to set session' }), { status: 500 });
  }
};