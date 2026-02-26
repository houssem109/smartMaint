import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Role-based route protection
// NOTE: superadmin should be treated like an admin for dashboard access.
const roleRoutes: Record<string, string[]> = {
  '/dashboard/admin': ['admin', 'superadmin'],
  '/dashboard/technician': ['technician'],
  '/dashboard/worker': ['worker'],
  // Shared: any authenticated role can create a ticket
  '/dashboard/create-ticket': ['admin', 'superadmin', 'technician', 'worker'],
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  for (const [route, allowedRoles] of Object.entries(roleRoutes)) {
    if (pathname.startsWith(route)) {
      const userRole = request.cookies.get('userRole')?.value?.toLowerCase();
      const token = request.cookies.get('token')?.value;

      if (!token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

      if (userRole && !allowedRoles.includes(userRole)) {
        let redirectPath = '/dashboard/worker';
        if (userRole === 'admin' || userRole === 'superadmin') redirectPath = '/dashboard/admin';
        else if (userRole === 'technician') redirectPath = '/dashboard/technician';
        const response = NextResponse.redirect(new URL(redirectPath, request.url));
        response.headers.set('x-forbidden', 'true');
        return response;
      }

      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
  ],
};
