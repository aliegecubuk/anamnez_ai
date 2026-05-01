# Technology Stack: AnamnezAl

**Project:** AnamnezAl — hands-free dental anamnesis + charting SaaS
**Researched:** 2026-05-01
**Confidence:** MEDIUM-HIGH (each section rated individually below)

---

## 1. Frontend Framework

### Recommendation: Next.js 15 (App Router)
**Version:** 15.x (latest stable)
**Confidence:** HIGH

**Why:** The project is already greenfield Next.js. App Router's React Server Components reduce client bundle size — important for a clinical dashboard that must load fast over hospital Wi-Fi. Route Handlers support both SSE and WebSocket patterns needed for real-time transcription streaming. Vercel provides a Live Transcription template using Next.js + Deepgram that confirms the pattern is battle-tested.

**Specific choices within Next.js:**
- Use App Router exclusively — Pages Router is legacy and lacks RSC support
- Use React 19 concurrent features for streaming UI updates during transcription
- Use `export const dynamic = 'force-dynamic'` on SSE route handlers (required to prevent Vercel edge caching from killing streams)

**What NOT to use:**
- **SvelteKit / Remix / Astro** — no ecosystem advantage here; team would lose Next.js momentum from the existing commit, and these frameworks have thinner ecosystems for the auth/database integrations needed
- **Next.js Pages Router** — deprecated direction, no RSC, poor SSE ergonomics

---

## 2. Database

### Recommendation: Supabase (Frankfurt region, eu-central-1)
**Version:** Supabase hosted (PostgreSQL 15 underlying)
**Confidence:** HIGH

**Why:** AnamnezAl has three hard requirements that Supabase satisfies together in a single managed service:

1. **Multi-tenancy via Row Level Security (RLS)** — Supabase's RLS integrates directly with JWT claims. One PostgreSQL instance, but tenant isolation is enforced at the database layer. This is the correct pattern for medical SaaS: no risk of query bugs leaking cross-tenant data.

2. **KVKK / GDPR data residency** — Deploy in `eu-central-1` (Frankfurt). Real-world precedent: Sonomed, a Turkish medical AI company, ran patient voice data on AWS Frankfurt eu-central-1 specifically for KVKK alignment. Supabase runs on AWS and allows Frankfurt region selection.

3. **Integrated auth, storage, and realtime** — Supabase gives you Auth (JWT/RLS integration), Storage (encrypted file storage, needed for session audio if you store it), and Postgres in one dashboard. Reduces operational surface area significantly for a small team.

**KVKK caveat:** Supabase is US-incorporated. Under the US CLOUD Act, data in Frankfurt can theoretically be compelled. For v1 MVP of a university research tool, this is an acceptable risk. For production with national health data, add a legal review and consider signing a Data Processing Agreement (DPA) with Supabase (available on Pro plan). Turkey has not yet published its "adequate countries" list, so SCCs (Standard Contractual Clauses) + DPA is the current compliance path.

**Schema pattern for multi-tenancy:**
```sql
-- Every table gets tenant isolation
CREATE TABLE patients (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES universities(id),
  ...
);

-- RLS policy
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON patients
  USING (tenant_id = (current_setting('app.current_tenant'))::uuid);
```

**What NOT to use:**
- **PlanetScale** — MySQL-based (no RLS), deprecated free tier, weaker for medical compliance; PostgreSQL is the medical SaaS standard
- **Neon** — Database-only; forces you to wire auth, storage separately; HIPAA only on Scale plan (expensive); less mature RLS tooling than Supabase
- **Raw PostgreSQL on EC2** — Valid for later scale but massive operational overhead for MVP; Supabase gives you this + auth + storage for free tier

---

## 3. Hosting & KVKK Compliance

### Recommendation: Vercel (Next.js frontend) + Supabase Frankfurt (data)
**Confidence:** MEDIUM

**Rationale:** KVKK's primary requirement is that Turkish citizen health data is stored on servers with adequate protection guarantees. The "storage" layer (Supabase Frankfurt) is where patient records live — this is the critical compliance surface. Vercel's edge functions process requests but do not durably store health data; they are stateless compute.

**Vercel specifics:**
- Set all Vercel functions to execute in `fra1` (Frankfurt) region using `vercel.json`:
  ```json
  {
    "functions": {
      "app/api/**": { "regions": ["fra1"] }
    }
  }
  ```
- GDPR compliant; HIPAA BAA available on Enterprise. For KVKK v1 compliance, configure EU-only function regions.
- Vercel Pro plan ($20/mo) removes the 10s function timeout — required for Whisper API calls which can take 5-15s on longer recordings.

**Alternative if KVKK strictness escalates:** Migrate compute to **Railway (EU West)** or **Fly.io (ams/fra machines)**. Both allow Docker containers, which is compatible with Next.js standalone output. Railway's HIPAA BAA requires $1,000/mo minimum — not viable for v1. Fly.io has no HIPAA BAA. For KVKK's current enforcement posture (similar to GDPR), Vercel + Supabase Frankfurt is sufficient.

**What NOT to use:**
- **Vercel default (Washington DC)** — All functions must be pinned to `fra1`; the default US region violates KVKK intent for health data compute
- **Azure Turkey North (Istanbul)** — Azure does operate an Istanbul region, and Microsoft has answered KVKK questions officially. However, Azure requires enterprise agreements for KVKK BAA-equivalent contracts. Not practical for an early SaaS. Revisit at Series A scale.
- **AWS Istanbul** — Does not exist. AWS Frankfurt (eu-central-1) is the closest AWS region for Turkey. AWS has real-world Turkish healthcare use cases (Sonomed case study) but requires significant DevOps setup vs. managed Vercel/Supabase for a small team.

---

## 4. Speech-to-Text (STT)

### Recommendation: OpenAI Whisper API (whisper-1, large-v3 backend)
**Version:** `whisper-1` model via OpenAI API
**Confidence:** HIGH

**Why Turkish specifically:**
- Whisper large-v3 achieves WER of 4.3%–14.2% on Turkish speech datasets — the best published results for Turkish among general-purpose STT services
- Whisper large-v3 reduces errors 10–20% over large-v2 across all languages including Turkish
- Google STT achieves WER 16.5%–20.6% (median) vs Whisper's 8% median — roughly 2x worse
- OpenAI API cost: **$0.006/minute** vs Google: $0.016/minute — 2.7x cheaper

**Dental medical context:** A Turkish paper specifically fine-tuned Whisper architecture for Turkish ASR and validated it across 5 datasets. The phonetic disambiguation requirement (18 vs 28 tooth numbers) is an LLM-layer concern, not STT; Whisper's job is accurate transcription, not interpretation.

**Implementation pattern:**
```typescript
// Send audio blob to route handler
// Route handler calls Whisper API
// Stream transcript text back via SSE
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: "whisper-1",
  language: "tr",   // ALWAYS set — forces Turkish model path, reduces WER
  response_format: "text"
});
```

Always pass `language: "tr"` — omitting it causes language detection overhead and occasionally mis-detects short Turkish audio clips as other languages.

**What NOT to use:**
- **Google Cloud Speech-to-Text** — 2x worse WER on Turkish, 2.7x more expensive. No upside.
- **Self-hosted faster-whisper** — Requires GPU (g5 EC2 ≈ $1.00–1.60/hr). Faster-whisper cuts GPU cost 4x but still exceeds API cost at early usage volumes. Self-hosting also adds DevOps overhead incompatible with a small team. Revisit if monthly audio minutes exceed ~10,000 (break-even point vs GPU instance).
- **Deepgram** — Good general STT but not specifically benchmarked or optimized for Turkish; no evidence of better Turkish accuracy than Whisper.
- **Azure Speech** — Supports Turkish but no published WER benchmarks beating Whisper; tied to Azure ecosystem.

---

## 5. LLM for Form Filling + Dental Descriptions

### Recommendation: GPT-4o (gpt-4o-2024-08-06 or later) for form extraction + Claude claude-3-5-sonnet-20241022 for descriptions
**Confidence:** MEDIUM

**Split recommendation rationale:**

**GPT-4o for structured form extraction:**
- GPT-4o's Structured Outputs (JSON Schema mode) achieves 100% schema adherence via constrained decoding — this is critical for the anamnesis form where every field must land in the correct slot
- Published research shows GPT-4o outperforms alternatives on Turkish medical text: 12–25% better than GPT-3.5, demonstrated on Turkish surgical pathology reports
- GPT-4o scored highest (89.2% via o1) on Turkish Dentistry Specialization Exam (DUS) questions
- Use `response_format: { type: "json_schema", json_schema: { strict: true, schema: anamnesiFormSchema } }` — this guarantees you never get a malformed JSON that crashes the form render

**Claude claude-3-5-sonnet for dental AI descriptions (click-to-expand):**
- Claude Sonnet has superior instruction-following for constrained prose generation — staying within a 3-line, dentistry-only scope is a content constraint task where Claude's RLHF training excels
- Also now supports Structured Outputs (public beta as of Nov 2025) if you want to guarantee format there too
- For this use case (generate 3-line dental-relevant description of drug X), latency matters less than quality, making Sonnet's slightly higher latency acceptable

**Alternative: Use GPT-4o for both** — simpler vendor dependency, GPT-4o also does excellent constrained generation. The dual-vendor approach only makes sense if you want to A/B test or hedge against OpenAI rate limits. For MVP, GPT-4o for everything is simpler and still correct.

**Both models caveat (MEDIUM confidence):** Both Claude and GPT-4o "only identified 60–80% of data correctly in most fields" for complex extraction without careful prompting. The LLM layer needs well-engineered prompts with few-shot examples of filled anamnesis forms. This is the highest-risk technical component and requires dedicated prompt engineering iteration.

**What NOT to use:**
- **GPT-3.5-turbo** — 12–25% worse on Turkish medical text; structured output reliability is poor
- **Gemini 1.5 Pro** — Scored lowest (67.7%) on Turkish dentistry exam; no advantage for this use case
- **Local LLMs (Llama, Mistral)** — Turkish medical instruction following quality is substantially below GPT-4o/Claude; not viable for clinical accuracy requirements

---

## 6. Authentication

### Recommendation: Clerk (Organizations plan)
**Version:** Clerk latest (check clerk.com for current SDK version)
**Confidence:** HIGH

**Why:**
- Clerk's Organizations feature directly maps to AnamnezAl's tenant model: each university = one Organization, dentists/assistants/admins = members with roles
- Built-in RBAC: assign `admin`, `dentist`, `assistant` roles at the organization level — no custom role table needed in the database
- Native Next.js 15 App Router support: `clerkMiddleware()`, RSC-compatible `auth()` helper, edge-compatible sessions
- Multi-tenant setup time: half a day vs 3–7 days for Auth0 Organizations or manual Auth.js implementation
- Clerk handles MFA, passkeys, session management — all required for a medical SaaS

**Cost:** Pro plan $25/month. For a university SaaS with potentially 100s of users across tenants, this is negligible.

**What NOT to use:**
- **NextAuth.js v5 (Auth.js)** — No built-in organizations, no RBAC. You would build the entire tenant/role system from scratch. Valid for simple apps, wrong for multi-tenant medical SaaS.
- **Auth0** — Feature-equivalent to Clerk Organizations but 3–7 day setup time and more expensive at scale. No compelling advantage over Clerk for Next.js projects.
- **Better Auth** — Best free self-hosted option with organizations plugin (v1.0 released 2025). Viable alternative if Clerk's cost is a constraint, but requires more integration work and is younger/less documented than Clerk. The "no vendor lock-in" benefit of Better Auth is real — consider it for v2 if Clerk pricing escalates.

---

## 7. Real-Time Communication (Transcription Streaming)

### Recommendation: Server-Sent Events (SSE) via Next.js Route Handlers
**Confidence:** HIGH

**Why SSE over WebSockets:**

The transcription streaming flow is unidirectional: server receives audio chunk → calls Whisper → pushes transcript text → client displays it. SSE is purpose-built for server-to-client unidirectional streams. WebSockets add bidirectional complexity with no benefit for this specific data flow.

**SSE advantages for this use case:**
- Works natively with Next.js Route Handlers (no custom server, no socket.io)
- Works through Vercel's edge network without special configuration (unlike raw WebSockets which require persistent connections)
- HTTP/2 multiplexing means SSE connections don't consume extra sockets
- Automatic reconnection built into browser EventSource API
- Simpler to implement, test, and debug than WebSocket servers

**Implementation pattern:**
```typescript
// app/api/transcribe/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // NOT edge — Whisper needs Node.js fetch

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send audio to Whisper, push chunks back
      const send = (text: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      
      const transcription = await openai.audio.transcriptions.create({...});
      send(transcription.text);
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
```

**What NOT to use:**
- **WebSockets (socket.io)** — Requires a custom server or separate WebSocket service (Vercel serverless doesn't support persistent WebSocket connections natively). Adds infra complexity. No benefit over SSE for this unidirectional flow.
- **Long polling** — Higher latency, more server load. No reason to use it when SSE is available and simpler.

---

## 8. UI Component Library

### Recommendation: shadcn/ui + Tailwind CSS v4
**Version:** shadcn/ui latest CLI; Tailwind CSS 4.x
**Confidence:** HIGH

**Why shadcn/ui:**
- You own the components — critical for custom dental chart components (FDI tooth grid, 6-point perio measurement grid). No wrestling with library internals to render a 32-tooth SVG chart with color-coded conditions.
- Zero runtime overhead: shadcn/ui copies code into your repo; no component library bundle shipped to client
- Built on Radix UI primitives (WAI-ARIA compliant) — clinical apps need accessible modals, alerts, and form fields
- Designed for Next.js + Tailwind + App Router: all component code works with RSC
- Fastest growth trajectory in React ecosystem in 2025; best AI tooling integration (Cursor, Claude, etc. know shadcn/ui patterns well)

**Clinical dashboard specifics:**
- Use `shadcn/ui` for: forms, buttons, alerts, dialogs, tabs, tables, badges, toasts
- Build **tooth charts custom** using SVG + React — no library has FDI dental chart components
- For the perio measurement grid (6 points × 32 teeth × 2 rows), build a custom React table component with Tailwind styling

**What NOT to use:**
- **MUI (Material UI)** — Heavy runtime bundle, Material Design aesthetics clash with clinical/medical UI. MUI X DataGrid is compelling for complex data tables but overkill for dental charts that need custom SVG rendering anyway. The trade-off isn't worth the bundle weight for a mobile-hostile clinical web app.
- **Radix UI raw** — shadcn/ui IS Radix under the hood. Don't use raw Radix unless you want to write your own Tailwind styling from scratch.
- **Ant Design** — Enterprise aesthetic fine, but designed for Chinese enterprise market patterns; less Next.js-idiomatic than shadcn/ui; heavier bundle.
- **Chakra UI** — Lost momentum post-v2 rewrite; smaller community than shadcn/ui in 2025.

---

## Complete Stack Summary

| Layer | Technology | Version | Hosting/Region |
|-------|-----------|---------|---------------|
| Frontend | Next.js 15 (App Router) | 15.x | Vercel Pro (fra1) |
| UI Library | shadcn/ui + Tailwind CSS | latest | — |
| Database | Supabase (PostgreSQL 15) | Pro plan | Frankfurt (eu-central-1) |
| Auth | Clerk Organizations | latest | Clerk cloud |
| STT | OpenAI Whisper API | whisper-1 | OpenAI (stateless) |
| LLM (extraction) | GPT-4o Structured Outputs | gpt-4o-2024-08-06+ | OpenAI (stateless) |
| LLM (descriptions) | Claude Sonnet | claude-3-5-sonnet-20241022 | Anthropic (stateless) |
| Realtime | SSE via Next.js Route Handlers | native | — |
| Tooth Charts | Custom SVG + React | — | — |

---

## Rejected Alternatives (Summary)

| Category | Rejected | Reason |
|----------|---------|--------|
| DB | PlanetScale | MySQL (no RLS), deprecated free tier |
| DB | Neon | DB-only, forces separate auth/storage, no KVKK precedent |
| STT | Google STT | 2x worse WER on Turkish, 2.7x higher cost |
| STT | Self-hosted faster-whisper | GPU infra cost > API cost at early volume, DevOps overhead |
| LLM | Gemini 1.5 Pro | Lowest score on Turkish dentistry exam (67.7%) |
| LLM | GPT-3.5 | 12–25% worse on Turkish medical text |
| Auth | NextAuth.js | No built-in orgs/RBAC, manual tenant system from scratch |
| Auth | Auth0 | 3–7 day setup, more expensive, no Next.js advantage over Clerk |
| UI | MUI | Heavy bundle, Material Design wrong for clinical aesthetic |
| Realtime | WebSocket/socket.io | Custom server required, no benefit over SSE for unidirectional stream |
| Hosting | Vercel default (US) | KVKK intent violated for health data; must pin to fra1 |
| Hosting | Azure Istanbul | Enterprise contracts required; not practical for early SaaS |

---

## KVKK Compliance Checklist (Stack-Relevant)

- [ ] Supabase project deployed in `eu-central-1` (Frankfurt)
- [ ] Supabase DPA signed (available on Pro plan)
- [ ] Vercel functions pinned to `fra1` in `vercel.json`
- [ ] OpenAI DPA signed (data not used for training by default on API)
- [ ] Anthropic API — verify DPA / data processing terms for Turkish health data
- [ ] Patient TC kimlik (ID numbers) encrypted at application layer before storage (not just Supabase at-rest encryption)
- [ ] Supabase RLS policies enforce tenant isolation on ALL tables with patient data
- [ ] VERBİS registration required if processing health data > threshold (consult legal)
- [ ] Breach notification workflow: 72-hour window to KVKK Authority

---

## Sources

- OpenAI Whisper Turkish WER (4.3%–14.2%): https://www.mdpi.com/2079-9292/13/21/4227
- Whisper vs Google STT cost/accuracy comparison: https://diyai.io/ai-tools/speech-to-text/reviews/openai-whisper-review/
- GPT-4o Turkish medical text performance: https://pubmed.ncbi.nlm.nih.gov/40971916/
- Turkish dentistry exam LLM benchmark: https://onlinelibrary.wiley.com/doi/10.1111/eje.70121
- GPT-4o Structured Outputs 100% schema compliance: https://platform.openai.com/docs/guides/structured-outputs
- Claude Structured Outputs announcement: https://claude.com/blog/structured-outputs-on-the-claude-developer-platform
- Clerk Organizations for multi-tenant Next.js: https://zenstack.dev/blog/clerk-multitenancy
- Better Auth organizations (free alternative): https://starterpick.com/blog/better-auth-clerk-nextauth-saas-showdown-2026
- Supabase RLS multi-tenant pattern: https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/
- Supabase Frankfurt region: https://supabase.com/docs/guides/platform/regions
- KVKK 2025 updates: https://alfalawfirm.com/kvkk-2025-updates-a-compliance-guide-for-companies/
- AWS Frankfurt + KVKK (Sonomed Turkish medical case study): https://callie.center/study-case-sonomed/
- Azure Turkey North (Istanbul) region: https://techcommunity.microsoft.com/discussions/azurepartners/new-azure-region---turkey/4003617
- Vercel SSE for transcription: https://vercel.com/templates/next.js/nextjslive-transcription
- Vercel EU region (fra1) GDPR: https://www.contentinsights.dev/2025/02/content-insights-tip-74-gdpr-and-vercel.html
- shadcn/ui vs MUI comparison 2025: https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra
- faster-whisper GPU cost vs API: https://deepgram.com/learn/whisper-vs-deepgram
- Next.js SSE streaming: https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events
