import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/reset-password(.*)',
  '/api/webhooks/(.*)',
  // Cron endpoints have no Clerk session — they authenticate via CRON_SECRET
  // bearer token inside the route handler instead.
  '/api/cron/(.*)',
])
const isTasksRoute = createRouteMatcher(['/sign-in/tasks', '/sign-up/tasks'])
const isSuperadminRoute = createRouteMatcher(['/superadmin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // treatPendingAsSignedOut: false → pending sessions retain userId so we can
  // detect them and route to /sign-in/tasks instead of bouncing to /sign-in.
  const { userId, sessionClaims, sessionStatus } = await auth({ treatPendingAsSignedOut: false })

  // No user at all → kick to /sign-in (unless route is public).
  if (!userId) {
    if (isPublicRoute(req)) return
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }

  // Pending session (e.g. forced MFA setup or other Clerk task) → force
  // completion at /sign-in/tasks. Allow tasks route + webhooks + reset-password.
  if (sessionStatus === 'pending') {
    if (isTasksRoute(req) || req.nextUrl.pathname.startsWith('/api/webhooks/') || req.nextUrl.pathname.startsWith('/reset-password')) {
      return
    }
    return NextResponse.redirect(new URL('/sign-in/tasks', req.url))
  }

  // Active session: enforce superadmin role on superadmin routes.
  if (isSuperadminRoute(req)) {
    const metadata = sessionClaims?.metadata as Record<string, unknown> | undefined
    if (metadata?.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
