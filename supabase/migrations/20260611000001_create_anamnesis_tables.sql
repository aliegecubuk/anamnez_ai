-- Phase 4: Anamnez Motoru — data layer
-- Tables: form_templates, template_versions, template_questions, anamnesis_answers
-- Modifies: sessions (template_version_id, kvkk_consent, informed_consent + consent CHECK)
-- All rows user-scoped via Clerk JWT 'sub' claim (pivot flat-user RLS template).
-- App-layer isolation: routes use supabaseAdmin + .eq('user_id', userId) per pivot pattern.

-- ============================================================
-- form_templates: mutable template header (TPLT-01)
-- ============================================================
CREATE TABLE public.form_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text        NOT NULL,  -- Clerk userId (admin who owns the template)
  name            text        NOT NULL CHECK (char_length(trim(name)) > 0),
  department      text        NOT NULL DEFAULT 'genel'
                              CHECK (department IN ('genel', 'periodontoloji', 'pedodonti', 'endodonti', 'cerrahi', 'ortodonti')),
  is_archived     boolean     NOT NULL DEFAULT false,
  -- Points to latest published version number; 0 = no published version yet.
  current_version integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON public.form_templates
  FOR ALL
  USING      (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE INDEX form_templates_user_id_idx ON public.form_templates (user_id);

-- ============================================================
-- template_versions: IMMUTABLE published snapshot (TPLT-04)
-- One row per publish. NEVER UPDATEd after insert — sessions
-- reference these snapshots so editing a template can never
-- mutate a version already referenced by a saved session.
-- ============================================================
CREATE TABLE public.template_versions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  template_id uuid        NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  version     integer     NOT NULL CHECK (version >= 1),
  name        text        NOT NULL,  -- snapshot of template name at publish time
  department  text        NOT NULL,
  -- Frozen array of question objects:
  -- [{id, prompt, question_type, options, position, required}]
  -- Full snapshot so sessions never depend on live template_questions.
  questions   jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_versions_template_version_unique UNIQUE (template_id, version)
);

COMMENT ON TABLE public.template_versions IS
  'Immutable published template snapshots — never UPDATEd after insert (TPLT-04).';

ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON public.template_versions
  FOR ALL
  USING      (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE INDEX template_versions_user_id_idx          ON public.template_versions (user_id);
CREATE INDEX template_versions_template_version_idx ON public.template_versions (template_id, version);

-- ============================================================
-- template_questions: EDITABLE working set for the current
-- draft of a template (TPLT-02, TPLT-03)
-- ============================================================
CREATE TABLE public.template_questions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text        NOT NULL,
  template_id   uuid        NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  prompt        text        NOT NULL CHECK (char_length(trim(prompt)) > 0),
  question_type text        NOT NULL
                            CHECK (question_type IN ('yes_no', 'text', 'multi_select', 'numeric')),
  options       jsonb,      -- nullable; array of string choices — required only for multi_select
  position      integer     NOT NULL CHECK (position >= 0),
  required      boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_questions_position_unique UNIQUE (template_id, position)
);

ALTER TABLE public.template_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON public.template_questions
  FOR ALL
  USING      (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE INDEX template_questions_user_id_idx           ON public.template_questions (user_id);
CREATE INDEX template_questions_template_position_idx ON public.template_questions (template_id, position);

-- ============================================================
-- anamnesis_answers: one row per (session, question) holding
-- the AI-mapped or human-edited answer
-- ============================================================
CREATE TABLE public.anamnesis_answers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text        NOT NULL,
  session_id      uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  -- References the snapshot question id inside template_versions.questions.
  -- NOT a live FK — snapshot ids are stable, live template_questions are not.
  question_id     uuid        NOT NULL,
  prompt          text        NOT NULL,  -- denormalized prompt snapshot for display without re-joining
  question_type   text        NOT NULL
                              CHECK (question_type IN ('yes_no', 'text', 'multi_select', 'numeric')),
  -- NULL = unanswered; shape depends on question_type: bool / string / string[] / number
  answer_value    jsonb,
  confidence      real        CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  edited_by_human boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anamnesis_answers_session_question_unique UNIQUE (session_id, question_id)
);

ALTER TABLE public.anamnesis_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON public.anamnesis_answers
  FOR ALL
  USING      (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE INDEX anamnesis_answers_user_id_idx    ON public.anamnesis_answers (user_id);
CREATE INDEX anamnesis_answers_session_id_idx ON public.anamnesis_answers (session_id);

-- ============================================================
-- sessions: template linkage + consent columns (TPLT-05, ANAM-06)
-- ============================================================
-- Nullable — set when dentist selects a template (TPLT-05).
ALTER TABLE public.sessions
  ADD COLUMN template_version_id uuid REFERENCES public.template_versions(id);

ALTER TABLE public.sessions
  ADD COLUMN kvkk_consent boolean NOT NULL DEFAULT false;

ALTER TABLE public.sessions
  ADD COLUMN informed_consent boolean NOT NULL DEFAULT false;

-- ANAM-06 DB-layer guard: a session cannot be marked completed
-- without BOTH consent flags set true — independent of API code.
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_consent_required_when_completed
  CHECK (status <> 'completed' OR (kvkk_consent = true AND informed_consent = true));
