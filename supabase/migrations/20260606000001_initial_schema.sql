-- Phase 1 schema for English Listening Practice App
-- All tables use snake_case per PostgreSQL convention
-- EF Core maps to PascalCase via UseSnakeCaseNamingConvention()

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE videos (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_id        text        UNIQUE NOT NULL,
    title             text        NOT NULL,
    thumbnail_url     text,
    duration_seconds  int,
    transcript_status text        NOT NULL DEFAULT 'queued',  -- queued | processing | ready | failed
    cc_type           text,                                    -- 'standard' | 'asr' | null (Whisper path in Phase 2)
    sentence_count    int         NOT NULL DEFAULT 0,
    difficulty_score  int,                                     -- null in Phase 1; 1-5 in Phase 2
    created_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT videos_transcript_status_check
        CHECK (transcript_status IN ('queued', 'processing', 'ready', 'failed'))
);

CREATE TABLE sentences (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id        uuid    NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    index           int     NOT NULL,
    text            text    NOT NULL,
    translation     text,
    named_entities  text[]  NOT NULL DEFAULT '{}',
    start_time_ms   int     NOT NULL,
    end_time_ms     int     NOT NULL
);

CREATE TABLE user_videos (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id        uuid        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    added_at        timestamptz NOT NULL DEFAULT now(),
    last_studied_at timestamptz,
    is_favorited    bool        NOT NULL DEFAULT false,
    custom_tags     text[]      NOT NULL DEFAULT '{}',

    UNIQUE (user_id, video_id)
);

CREATE TABLE user_progress (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sentence_id     uuid        NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
    attempts        int         NOT NULL DEFAULT 0,
    final_score     int,
    hint_level_used int         NOT NULL DEFAULT 0,  -- 0=none 1=letter 2=word 3=all
    completed_at    timestamptz,

    UNIQUE (user_id, sentence_id)
);

CREATE TABLE saved_sentences (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sentence_id     uuid        NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
    saved_at        timestamptz NOT NULL DEFAULT now(),
    note            text,
    -- Phase 3 SM-2 fields (present but unused in Phase 1 UI)
    review_interval int         NOT NULL DEFAULT 1,
    review_ease     float       NOT NULL DEFAULT 2.5,
    next_review_at  timestamptz NOT NULL DEFAULT now(),

    UNIQUE (user_id, sentence_id)
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_sentences_video_id ON sentences (video_id);
CREATE INDEX idx_user_videos_user_id ON user_videos (user_id);
CREATE INDEX idx_user_progress_user_id ON user_progress (user_id);
CREATE INDEX idx_user_progress_sentence_id ON user_progress (sentence_id);
CREATE INDEX idx_saved_sentences_user_id ON saved_sentences (user_id);

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE videos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_videos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_sentences ENABLE ROW LEVEL SECURITY;

-- videos: authenticated users can read; service role writes
CREATE POLICY "authenticated users read videos"
    ON videos FOR SELECT
    USING (auth.role() = 'authenticated');

-- sentences: authenticated users can read
CREATE POLICY "authenticated users read sentences"
    ON sentences FOR SELECT
    USING (auth.role() = 'authenticated');

-- user_videos: users own their rows
CREATE POLICY "users own their library"
    ON user_videos FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- user_progress: users own their rows
CREATE POLICY "users own their progress"
    ON user_progress FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- saved_sentences: users own their rows
CREATE POLICY "users own their saved sentences"
    ON saved_sentences FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
