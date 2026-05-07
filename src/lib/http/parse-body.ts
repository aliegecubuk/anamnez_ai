// Reads request body as JSON or form-urlencoded/multipart depending on Content-Type.
// HTML <form method="POST"> sends form-urlencoded by default; programmatic clients send JSON.
export async function parseRequestBody(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return (await req.json()) as Record<string, string>
  }

  const form = await req.formData()
  const out: Record<string, string> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}
