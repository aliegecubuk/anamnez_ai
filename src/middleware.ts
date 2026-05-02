import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'anamnezal.com'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/reset-password(.*)'])
const isSuperadminRoute = createRouteMatcher(['/superadmin(.*)'])

export default clerkMiddleware(
  async (auth, req) => {
    const url = req.nextUrl
    const hostname = req.headers.get('host') || ''

    // Extract tenant slug from subdomain
    const slug = hostname
      .replace(`.${ROOT_DOMAIN}`, '')
      .replace(`:3000`, '')
    const isTenantSubdomain = slug !== ROOT_DOMAIN && slug !== 'www' && slug !== ''

    if (isTenantSubdomain) {
      // Enforce auth before rewriting — prevents unauthenticated access to tenant routes
      if (!isPublicRoute(req)) {
        await auth.protect()
      }
      // Rewrite to /orgs/[slug]/... so organizationSyncOptions activates the org
      const newPath = `/orgs/${slug}${url.pathname}`
      const rewriteUrl = new URL(newPath, req.url)
      rewriteUrl.search = url.search
      return NextResponse.rewrite(rewriteUrl)
    }

    // Superadmin route protection — check publicMetadata.role
    if (isSuperadminRoute(req)) {
      const { sessionClaims } = await auth()
      const metadata = sessionClaims?.metadata as Record<string, unknown> | undefined
      if (metadata?.role !== 'superadmin') {
        return NextResponse.redirect(new URL('/sign-in', req.url))
      }
    }

    if (!isPublicRoute(req)) {
      await auth.protect()
    }
  },
  {
    organizationSyncOptions: {
      organizationPatterns: ['/orgs/:slug', '/orgs/:slug/(.*)'],
    },
  }
)

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
