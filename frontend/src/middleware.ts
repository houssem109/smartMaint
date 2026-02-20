import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Strict role-based route protection - each role can ONLY access their own routes
const roleRoutes: Record<string, string[]> = {
  '/dashboard/admin': ['admin'],
  '/dashboard/technician': ['technician'],
  '/dashboard/worker': ['worker'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path requires role-based access
  for (const [route, allowedRoles] of Object.entries(roleRoutes)) {
    if (pathname.startsWith(route)) {
      const userRole = request.cookies.get('userRole')?.value;
      const token = request.cookies.get('token')?.value;

      // If no token, redirect to login
      if (!token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Strict role check: If user role doesn't match exactly, redirect to their own dashboard
      if (userRole && !allowedRoles.includes(userRole)) {
        // Redirect to user's own dashboard based on their role
        let redirectPath = '/dashboard/worker';
        if (userRole === 'admin') {
          redirectPath = '/dashboard/admin';
        } else if (userRole === 'technician') {
          redirectPath = '/dashboard/technician';
        }
        // Return forbidden response and let ProtectedRoute handle the UI
        const response = NextResponse.redirect(new URL(redirectPath, request.url));
        response.headers.set('x-forbidden', 'true');
        return response;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
  ],
};
