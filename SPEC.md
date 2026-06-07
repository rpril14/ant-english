# English Listening Practice App — Product Spec
> v2.2 · Stack: Next.js 14 · ASP.NET Core 8 · Supabase

---

## Table of contents

1. [Overview & goals](#1-overview--goals)
2. [Personas](#2-personas)
3. [Feature scope by phase](#3-feature-scope-by-phase)
4. [Tech stack](#4-tech-stack)
5. [Phase 1 — CC-only MVP](#5-phase-1--cc-only-mvp)
6. [Phase 2 — Whisper & AI](#6-phase-2--whisper--ai)
7. [Phase 3 — Scale & retention](#7-phase-3--scale--retention)
8. [Database schema](#8-database-schema)
9. [API endpoints](#9-api-endpoints)
10. [Error handling & edge cases](#10-error-handling--edge-cases)
11. [Open questions](#11-open-questions)
12. [Appendix — Code skeletons](#12-appendix--code-skeletons)

---

## 1. Overview & goals

A web application that lets learners improve English listening comprehension by practicing dictation on real YouTube videos. The learner imports a YouTube URL, watches the video sentence by sentence, types what they hear, and gets instant word-level feedback.

**Phase 1** is deliberately scoped to videos that already have closed captions (CC). This eliminates the Whisper transcription dependency entirely, reducing infrastructure complexity and cutting import time from 30–90 seconds to under 5 seconds.

### 1.1 Success metrics — Phase 1

| Metric | Target |
|---|---|
| Import-to-ready time (CC video) | < 5 seconds |
| Sentence match feedback latency | < 50ms after each keystroke |
| Video sentence range supported | 10–200 sentences |
| Whisper / GPU infrastructure | Zero — not required |
| Auth success rate | > 99% (Google OAuth) |

---

## 2. Personas

### P1 — Alex, intermediate learner (primary)
- 24 years old, working professional, studies English after work hours
- Watches YouTube regularly — wants to use videos they already enjoy for listening practice
- Frustrated by replaying the same clip repeatedly without knowing exactly which words they miss
- Goal: improve listening ability to feel confident in international work environments

### P2 — Sara, advanced learner (secondary)
- 28 years old, strong foundation, wants to sharpen accent recognition and comprehension at native speed
- Primarily uses TED Talks, podcasts, and films
- Needs the ability to save difficult sentences for later review
- Goal: understand native speakers at natural conversational speed

### P3 — Tom, beginner (tertiary)
- 19 years old, university student, basic English level
- Needs sentence-by-sentence translation as a comprehension aid
- Likely to drop off without hints when sentences are hard
- Goal: build vocabulary and get comfortable with simple spoken sentences

---

## 3. Feature scope by phase

| Feature | Phase | Notes |
|---|---|---|
| YouTube CC import | **Phase 1** | CC-only, no Whisper |
| Video player with sentence sync | **Phase 1** | Sentence-level auto-advance |
| Dictation input + word matching | **Phase 1** | Word-level real-time diff |
| Hint system (letter / word / all) | **Phase 1** | Keyboard shortcuts Alt+H, Alt+R |
| Translation toggle (EN → target language) | **Phase 1** | DeepL API, cached in DB |
| Transcript sidebar + progress | **Phase 1** | Blurred until sentence done |
| Video library (save & revisit) | **Phase 1** | Grid view, filter, tags |
| User auth — Google OAuth | **Phase 1** | Supabase Auth |
| Progress persistence | **Phase 1** | Per-sentence score saved to DB |
| Saved sentences (bookmarks) | **Phase 1** | User-level bookmark list |
| Whisper transcription | **Phase 2** | For videos without CC |
| Difficulty scoring | **Phase 2** | Based on vocab + speech rate |
| Lesson suggestions (AI) | **Phase 2** | Claude API — error pattern analysis |
| Proper name detection (NER) | **Phase 2** | Replace capitalisation heuristic |
| Auto-CC quality warning | **Phase 2** | Flag `trackKind = asr` videos |
| Mobile native app | **Phase 3** | React Native (Expo) |
| Spaced repetition review | **Phase 3** | SM-2 algorithm on saved sentences |
| Public lesson sharing | **Phase 3** | Share library with other users |
| Playlist / course grouping | Out of scope | Not planned |

---

## 4. Tech stack

### 4.1 Frontend

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI state | Zustand — sentence index, score, hint state, UI toggles |
| Video player | react-player — wraps YouTube iframe, handles autoplay policy |
| Styling | Tailwind CSS |
| Realtime updates | Supabase JS client (WebSocket channel per `job_id`) |
| HTTP client | SWR for data fetching + cache invalidation |
| Animation | Framer Motion — word reveal, completion states |
| Deploy | Vercel — auto-deploy from GitHub, preview URLs per PR |

### 4.2 Backend (.NET)

| | |
|---|---|
| Framework | ASP.NET Core Web API (.NET 8) |
| Background jobs | `ImportWorker` — `BackgroundService` polling `videos` table, in-process with API |
| ORM | Entity Framework Core + Npgsql (snake_case naming convention) |
| Validation | FluentValidation — request model validation |
| YouTube metadata | YouTube Data API v3 — title, duration, thumbnail, CC check |
| CC download | yt-dlp CLI — invoked via `Process.Start()`, parses SRT/VTT |
| Translation | DeepL API — EN → target language, results cached in DB |
| Deploy | Railway — Docker container, persistent worker process |

### 4.2.1 Backend project structure

```
src/
  AntEnglish.Api/
    Controllers/        # HTTP endpoints (ImportController, LibraryController, etc.)
    Workers/            # BackgroundService workers (ImportWorker)
    Program.cs          # AddHostedService<ImportWorker>()
  AntEnglish.Services/
    Interfaces/         # Service contracts
    Services/           # Business logic implementations
    Extensions/         # DI registration helpers
  AntEnglish.Data/
    Entities/           # EF Core entity classes (Video, Sentence, UserProgress, etc.)
    Migrations/         # EF Core migrations
    AntDbContext.cs
  frontend/             # Next.js 14 App Router (replaces my-app CRA)
    app/                # App Router pages and layouts
    components/
    hooks/              # e.g. useVideoReady.ts (Supabase Realtime + polling fallback)
```

> **Jobs in Api, not a separate Worker project.** `ImportWorker` runs in-process with the API host — one Railway container, one deployment. A separate Worker project is deferred to Phase 2 if Whisper transcription requires independent CPU scaling.

### 4.3 Data & infrastructure

| | |
|---|---|
| Database | Supabase (PostgreSQL 15) — snake_case columns |
| Auth | Supabase Auth — Google OAuth provider |
| File storage | Supabase Storage — thumbnails only in Phase 1 |
| Cache / queue | — (no external queue; job state persisted in `videos.transcript_status`) |
| Realtime | Supabase Realtime — push `video_ready` event to frontend |
| Error tracking | Sentry — Next.js + .NET |
| CI/CD | GitHub Actions — lint, test, deploy on merge to main |

---

## 5. Phase 1 — CC-only MVP

---

### US-101 · Import a YouTube video

**As** Alex,
**I want to** paste a YouTube URL and have it ready to practice in seconds,
**so that** I can start learning from any video I find without a long wait.

#### Acceptance criteria

**AC-101-1 — URL validation (client-side)**
- GIVEN I paste a URL into the import bar
- WHEN the URL matches `youtu.be/<id>`, `youtube.com/watch?v=<id>`, or `youtube.com/shorts/<id>`
- THEN the submit button becomes active with no error shown
- AND the `video_id` is extracted immediately without a network call

**AC-101-2 — Invalid URL rejected**
- GIVEN I paste a URL that does not match any YouTube pattern
- WHEN I finish typing
- THEN an inline error appears: `"Invalid URL — please paste a YouTube link"`
- AND the submit button remains disabled

**AC-101-3 — No English CC rejected**
- GIVEN I submit a valid YouTube URL
- WHEN the server checks and finds no English caption track
- THEN the API returns `400` with message: `"This video has no English captions — Phase 1 only supports CC-enabled videos"`
- AND no video record is created in the database
- AND the import bar shows the error inline

**AC-101-4 — Private or unavailable video rejected**
- GIVEN I submit a valid YouTube URL for a private or deleted video
- WHEN the server calls YouTube Data API v3
- THEN the API returns `404` with message: `"Video not found or has been removed"`

**AC-101-5 — Duplicate video handled**
- GIVEN a video with the same `youtube_id` already has `transcript_status = ready`
- WHEN I import the same URL
- THEN the server returns `{ status: "ready", video_id }` immediately without re-processing
- AND the video is added to my library pointing to the existing transcript

**AC-101-6 — Card appears instantly**
- GIVEN I submit a valid CC-enabled URL
- WHEN the server accepts the request
- THEN a video card appears in my library with status `"Processing…"` within 200ms
- AND the server response time for `POST /api/videos/import` is < 300ms (excluding background job)

**AC-101-7 — Card updates when ready**
- GIVEN a video card is in `"Processing…"` state
- WHEN the background job finishes
- THEN the card updates to `"Start practicing"` state without a page refresh
- AND the total import-to-ready time is < 5 seconds for a CC-enabled video

**AC-101-8 — Background job failure**
- GIVEN the background job fails (yt-dlp error, DeepL timeout, etc.)
- WHEN the worker catches the exception
- THEN the card shows status `"Import failed"` with a retry button
- AND the error is logged to Sentry with `job_id` and failure reason

---

### US-102 · Practice dictation on a sentence

**As** Alex,
**I want to** type what I hear sentence by sentence and see which words I got right or wrong,
**so that** I know exactly where my listening breaks down.

#### Acceptance criteria

**AC-102-1 — Player syncs to current sentence**
- GIVEN I open a video and the player is playing
- WHEN the player's `currentTime` reaches `sentence[i].start_time_ms`
- THEN sentence `i` becomes the active sentence in the input area
- AND the transcript sidebar scrolls to highlight sentence `i`

**AC-102-2 — Real-time word matching**
- GIVEN I am typing in the dictation input
- WHEN I type each character
- THEN the word diff updates within 50ms
- AND correctly typed words show as green chips
- AND incorrectly typed words show as red chips
- AND missing words show as gray placeholder chips

**AC-102-3 — Normalisation rules**
- GIVEN the expected text is `"I'm here to learn English."`
- WHEN I type `"im here to learn english"`
- THEN the match score is 100% (apostrophes in contractions retained, punctuation and case ignored)

**AC-102-4 — Sentence completion**
- GIVEN my input matches >= 95% of the expected words
- THEN the sentence is marked as `Complete` automatically
- AND `user_progress` is upserted with `{ sentence_id, attempts, final_score, completed_at }`
- AND the transcript sidebar marks the sentence as done (unblurred)

**AC-102-5 — Manual advance**
- GIVEN my input matches < 95%
- WHEN I press Enter or click Next
- THEN the session advances to the next sentence regardless of score
- AND `user_progress` is saved with the current score

**AC-102-6 — Replay sentence**
- GIVEN I am on sentence `i`
- WHEN I press Ctrl+R or click the replay button
- THEN the player seeks to `sentence[i].start_time_ms` and resumes playback
- AND my current input is preserved

**AC-102-7 — Auto-advance toggle**
- GIVEN Auto Next is toggled ON
- WHEN the player reaches `sentence[i+1].start_time_ms`
- THEN the session automatically advances to sentence `i+1`
- GIVEN Auto Next is toggled OFF
- THEN the session waits for manual advance regardless of playback time

**AC-102-8 — Progress persists on refresh**
- GIVEN I have completed 15 out of 49 sentences and I refresh the page
- WHEN the page reloads
- THEN the session resumes at sentence 16
- AND previously completed sentences show their saved scores

---

### US-103 · Use hints when stuck

**As** Tom,
**I want to** get a small hint without seeing the full answer,
**so that** I can keep practicing without giving up on a hard sentence.

#### Acceptance criteria

**AC-103-1 — First letter hint**
- GIVEN I press Alt+H (or click "1st letter")
- THEN each unrevealed word shows its first letter as a chip (e.g. `H___` for "Hello")
- AND the hint level is recorded as `1` for this sentence attempt

**AC-103-2 — Reveal next word**
- GIVEN I press Alt+R (or click "Reveal word")
- THEN the next unrevealed word is shown fully in the chip row
- AND my input field is not modified — I still need to type it myself
- AND the hint level is recorded as `2`

**AC-103-3 — Show all words**
- GIVEN I click "Show all"
- THEN all words are shown as chips
- AND the sentence score is capped at 60% regardless of typed input
- AND a notice shows: `"Score capped at 60% — answer revealed"`

**AC-103-4 — Proper names not penalised**
- GIVEN the sentence contains a proper name (e.g. "Ben")
- THEN a separate orange chip shows below the input: `"Proper name: Ben"`
- AND skipping or mistyping the proper name does not reduce match%

**AC-103-5 — No hint = full score available**
- GIVEN I complete a sentence without using any hint
- THEN the score can reach 100%

---

### US-104 · View translation

**As** Tom,
**I want to** see a translation of each sentence in my native language,
**so that** I understand the meaning even when I cannot catch all the words.

#### Acceptance criteria

**AC-104-1 — Translation toggle**
- GIVEN I click "Hide translation"
- THEN the translation row disappears for all subsequent sentences
- AND my preference is saved to `localStorage` and restored on next visit

**AC-104-2 — Translation present at session start**
- GIVEN translation is toggled ON
- WHEN I open a sentence
- THEN the translation appears below the input box in 14px muted text

**AC-104-3 — Translation unavailable — graceful degradation**
- GIVEN the DeepL quota was exceeded at import time for this video
- THEN the translation row shows `"Translation not available"` instead of empty space
- AND the practice session remains fully functional without translation

---

### US-105 · Manage video library

**As** Alex,
**I want to** see all my saved videos, track progress, and filter by status,
**so that** I can continue where I left off and know which videos I have finished.

#### Acceptance criteria

**AC-105-1 — Library grid**
- GIVEN I have added at least one video
- WHEN I open the library
- THEN videos display in a 3-column grid (desktop), 2-column (tablet), 1-column (mobile)
- AND each card shows: thumbnail, title, sentence count, progress bar, last studied date

**AC-105-2 — Card states**

| State | Trigger | Button label |
|---|---|---|
| `queued` | Job just enqueued | Spinner, disabled |
| `processing` | Worker is running | "Processing…", disabled |
| `ready` | Never studied | "Start practicing" |
| `in-progress` | 1 ≤ completed < total | "Continue (X / N)" |
| `completed` | completed = total | "Review again" (green) |
| `failed` | Job failed after 3 retries | "Import failed — Retry" |

**AC-105-3 — Filter pills**
- GIVEN I click "In progress"
- THEN only `in-progress` cards are shown
- GIVEN I click "Completed"
- THEN only `completed` cards are shown
- GIVEN I click "Favourites"
- THEN only cards where `is_favorited = true` are shown

**AC-105-4 — Sort options**
- GIVEN I select "Recently studied" from the sort dropdown
- THEN cards are ordered by `last_studied_at DESC`
- GIVEN I select "Progress"
- THEN cards are ordered by `completed_sentences / total_sentences DESC`

**AC-105-5 — Favourite toggle**
- GIVEN I click the heart icon on a card
- THEN `is_favorited` toggles immediately (optimistic update)
- AND the change is persisted to `user_videos` within 2 seconds

**AC-105-6 — Custom tags**
- GIVEN I add tag `"interview"` to a video card
- THEN the tag appears as a pill on the card
- AND I can filter by that tag from the filter bar

**AC-105-7 — Remove from library**
- GIVEN I click "Remove from library" from the card menu
- THEN the `user_videos` row is deleted
- AND the card disappears from my library
- AND the shared `videos` and `sentences` rows remain (other users unaffected)

**AC-105-8 — Import bar always visible**
- GIVEN I am on the library page
- THEN the import bar is pinned at the bottom of the screen at all times
- AND I can paste a URL and click "Add" without scrolling

---

### US-106 · Save sentences for review

**As** Sara,
**I want to** bookmark sentences I find difficult,
**so that** I can review them later outside the main practice session.

#### Acceptance criteria

**AC-106-1 — Save during practice**
- GIVEN I am in a practice session on sentence `i`
- WHEN I click "Save sentence"
- THEN a `saved_sentences` row is created for `(user_id, sentence_id)`
- AND a toast confirms: `"Sentence saved"`
- AND the button changes to a filled bookmark icon

**AC-106-2 — View saved sentences**
- GIVEN I navigate to "Saved sentences"
- THEN all saved sentences are listed with: sentence text, translation, source video title, and my personal note (if any)

**AC-106-3 — Add personal note**
- GIVEN I open a saved sentence
- WHEN I type a note and click Save
- THEN the note is persisted in `saved_sentences.note`
- AND the note appears on next visit

**AC-106-4 — Remove saved sentence**
- GIVEN I click the bookmark icon on an already-saved sentence
- THEN the `saved_sentences` row is deleted
- AND a toast confirms: `"Sentence removed from saved list"`

---

### US-107 · Sign in and own my data

**As** Alex,
**I want to** sign in with Google and have my library and progress tied to my account,
**so that** my data is safe and accessible on any device.

#### Acceptance criteria

**AC-107-1 — Google sign-in**
- GIVEN I click "Sign in with Google"
- THEN I am redirected to the Google OAuth consent screen
- AND after approval I am redirected back to the app with an active session

**AC-107-2 — New user onboarding**
- GIVEN I sign in for the first time
- THEN my library is empty
- AND an onboarding prompt shows: `"Paste your first YouTube link below to get started"`

**AC-107-3 — Data isolation**
- GIVEN I am signed in as user A
- THEN I cannot read or write `user_videos`, `user_progress`, or `saved_sentences` rows belonging to user B
- AND all such queries are blocked at the database level via Supabase RLS policies

**AC-107-4 — Session persistence**
- GIVEN I close the browser and reopen the app within the session TTL
- THEN I am still signed in without re-authenticating

**AC-107-5 — Sign out**
- GIVEN I click "Sign out"
- THEN my session is invalidated
- AND I am redirected to the landing page
- AND protected routes redirect to sign-in if accessed directly

---

### US-108 · Transcript sidebar navigation

**As** Sara,
**I want to** see all sentences in a sidebar and jump to any one,
**so that** I can skip ahead or revisit a specific sentence quickly.

#### Acceptance criteria

**AC-108-1 — Sidebar sentence list**
- GIVEN I open a practice session
- THEN the sidebar shows all sentences numbered `#1` to `#N`
- AND sentences I have not yet practiced show as blurred dots (`•••`)
- AND completed sentences show their text unblurred with a checkmark

**AC-108-2 — Jump to sentence**
- GIVEN I click sentence `#12` in the sidebar
- THEN the player seeks to `sentence[12].start_time_ms`
- AND the dictation input area loads sentence 12

**AC-108-3 — Progress counter**
- GIVEN I have completed 20 out of 49 sentences
- THEN the sidebar header shows `"20 / 49"` and a progress bar at 40%

---

## 6. Phase 2 — Whisper & AI

---

### US-201 · Import videos without CC (Whisper)

**As** Alex,
**I want to** import any YouTube video even if it has no captions,
**so that** I am not limited to CC-only content.

#### Acceptance criteria

**AC-201-1 — No CC → Whisper path**
- GIVEN I import a URL with no English CC
- THEN the server does NOT reject the request (unlike Phase 1)
- AND the job is enqueued for Whisper transcription
- AND the card shows `"Processing — this may take 1–2 minutes"`

**AC-201-2 — Whisper word timestamps**
- GIVEN Whisper transcribes a video
- THEN each sentence has `start_time_ms` and `end_time_ms` accurate to ± 200ms
- AND sentence breaks align with what a native speaker would consider natural pauses

**AC-201-3 — Temp audio cleanup**
- GIVEN the Whisper job completes (success or failure)
- THEN the downloaded `.mp3` file is deleted from local disk
- AND no audio is stored in Supabase Storage

**AC-201-4 — Processing time expectation**
- GIVEN a 10-minute video without CC
- THEN the import-to-ready time is < 120 seconds on CPU
- AND the UI shows a progress indicator with an estimated time remaining

---

### US-202 · See video difficulty before starting

**As** Alex,
**I want to** know how difficult a video is before I start practicing,
**so that** I can choose content appropriate for my current level.

#### Acceptance criteria

**AC-202-1 — Difficulty badge on card**
- GIVEN a video has been imported and sentences exist
- THEN a badge shows one of: `Beginner` / `Intermediate` / `Advanced` / `Expert`
- AND the badge colour is: green / blue / purple / red respectively

**AC-202-2 — Scoring factors**
- GIVEN difficulty is computed
- THEN it is based on: average words per sentence, type-token ratio (TTR), and average speech rate (words/second)
- AND a video with short simple sentences at slow speed scores `Beginner`
- AND a video with long complex sentences at fast speed scores `Expert`

**AC-202-3 — Filter by difficulty**
- GIVEN I select "Intermediate" in the difficulty filter
- THEN only videos with `difficulty_score = 3` are shown in the library

---

### US-203 · Get AI lesson suggestions

**As** Sara,
**I want to** receive video suggestions based on where I made mistakes,
**so that** I practice the areas I actually struggle with instead of choosing content at random.

#### Acceptance criteria

**AC-203-1 — Suggestions appear after session**
- GIVEN I complete a practice session (all sentences done)
- THEN a panel appears: `"Recommended next"`
- AND up to 3 video suggestions are shown with title, difficulty badge, and reason (e.g. `"Practice /θ/ and /ð/ sounds — similar to this video"`)

**AC-203-2 — Suggestions based on error pattern**
- GIVEN my session had consistent errors on words containing `th` sounds
- THEN at least 1 suggestion targets the `/θ/` or `/ð/` phoneme

**AC-203-3 — Suggestions from library only**
- GIVEN the suggestion engine runs
- THEN all suggested videos already exist in the shared `videos` table
- AND suggestions do not include videos I have already completed

---

### US-204 · Proper name detection (NER)

**As** Alex,
**I want** proper names to be reliably identified so they are not counted as errors,
**so that** my score reflects actual listening ability rather than knowledge of specific names.

#### Acceptance criteria

**AC-204-1 — NER replaces capitalisation heuristic**
- GIVEN a sentence contains `"She met President Biden in Washington"`
- THEN `"Biden"` and `"Washington"` are flagged as proper names
- AND `"She"` at sentence start is NOT flagged as a proper name

**AC-204-2 — Named entities stored**
- GIVEN NER runs at import time
- THEN `sentences.named_entities` is populated with `["Biden", "Washington"]`

**AC-204-3 — Score unaffected by proper names**
- GIVEN a sentence has 10 words and 2 are proper names
- THEN match% is calculated over the 8 non-proper-name words only

---

### US-205 · Auto-CC quality warning

**As** Alex,
**I want to** know when a video's captions are auto-generated rather than human-written,
**so that** I am not confused by transcription errors in the practice text.

#### Acceptance criteria

**AC-205-1 — ASR flag at import**
- GIVEN YouTube Data API returns `caption.trackKind = "asr"` for the CC track
- THEN `videos.cc_type` is set to `"asr"`

**AC-205-2 — Warning shown in practice**
- GIVEN `cc_type = "asr"`
- THEN a yellow banner appears at the top of the practice session: `"Auto-generated captions — may contain errors"`

**AC-205-3 — Human CC shows no warning**
- GIVEN `cc_type = "standard"`
- THEN no warning banner is shown

---

## 7. Phase 3 — Scale & retention

---

### US-301 · Spaced repetition review

**As** Sara,
**I want** a daily review queue of sentences I have saved,
**so that** I retain what I have practiced without re-watching full videos.

#### Acceptance criteria

**AC-301-1 — Daily review queue**
- GIVEN it is a new day
- WHEN I open "Today's review"
- THEN sentences due for review (SM-2 interval elapsed) are listed
- AND the queue count is shown as a badge on the nav icon

**AC-301-2 — Review mode (audio only)**
- GIVEN I start a review session
- THEN the video player is hidden
- AND only the audio plays for the relevant sentence timestamp
- AND I type what I hear as normal

**AC-301-3 — SM-2 interval update**
- GIVEN I score >= 80% on a review sentence
- THEN the interval increases (ease factor applied)
- GIVEN I score < 80%
- THEN the interval resets to 1 day

---

### US-302 · Mobile app

**As** Alex,
**I want to** practice on my phone during my commute,
**so that** I can use idle time productively without a laptop.

#### Acceptance criteria

**AC-302-1 — Core practice loop on mobile**
- GIVEN I open the React Native app
- THEN I can browse my library, open a video, and complete a dictation session with the same features as the web app

**AC-302-2 — Offline mode**
- GIVEN I download a video for offline use while on WiFi
- THEN the transcript and audio clip are stored on-device
- AND the practice session works with no internet connection

**AC-302-3 — Push notifications**
- GIVEN I have daily review items due
- THEN I receive a push notification at a time I configure (e.g. 7:00 AM)
- AND tapping the notification opens the review queue directly

---

### US-303 · Public library sharing

**As** Sara,
**I want to** share my curated video list with friends,
**so that** they can learn from the same content without manually importing each video.

#### Acceptance criteria

**AC-303-1 — Make library public**
- GIVEN I toggle "Share my library"
- THEN a shareable URL is generated: `app.com/library/@username`
- AND visitors can browse my library without signing in

**AC-303-2 — Fork a library**
- GIVEN I am viewing a public library
- WHEN I click "Add all to my library"
- THEN all videos in the public library are added to my `user_videos`
- AND no new transcript processing is triggered (existing shared video records are reused)

**AC-303-3 — Leaderboard (opt-in)**
- GIVEN a shared library has leaderboard enabled
- THEN members see a ranked list ordered by total sentences completed within that library

---

## 8. Database schema

> All tables in Supabase PostgreSQL 15. RLS enabled on all tables. Columns use snake_case (PostgreSQL convention — mapped to PascalCase in C# via `UseSnakeCaseNamingConvention()`).

### videos

```sql
id                uuid        PRIMARY KEY DEFAULT gen_random_uuid()
youtube_id        text        UNIQUE NOT NULL
title             text        NOT NULL
thumbnail_url     text
duration_seconds  int
transcript_status text        DEFAULT 'queued'   -- queued | processing | ready | failed
cc_type           text                            -- 'standard' | 'asr' | null (Whisper)
sentence_count    int         DEFAULT 0
difficulty_score  int                             -- null in Phase 1; 1–5 in Phase 2
created_at        timestamptz DEFAULT now()
```

### sentences

```sql
id              uuid        PRIMARY KEY DEFAULT gen_random_uuid()
video_id        uuid        REFERENCES videos(id) ON DELETE CASCADE
index           int         NOT NULL
text            text        NOT NULL
translation     text                              -- populated by DeepL at import
named_entities  text[]      DEFAULT '{}'          -- Phase 2: proper names
start_time_ms   int         NOT NULL
end_time_ms     int         NOT NULL
```

### user_videos

```sql
id              uuid        PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid        REFERENCES auth.users(id) ON DELETE CASCADE
video_id        uuid        REFERENCES videos(id) ON DELETE CASCADE
added_at        timestamptz DEFAULT now()
last_studied_at timestamptz
is_favorited    bool        DEFAULT false
custom_tags     text[]      DEFAULT '{}'
UNIQUE(user_id, video_id)
```

### user_progress

```sql
id              uuid        PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid        REFERENCES auth.users(id) ON DELETE CASCADE
sentence_id     uuid        REFERENCES sentences(id) ON DELETE CASCADE
attempts        int         DEFAULT 0
final_score     int                               -- 0–100
hint_level_used int         DEFAULT 0             -- 0=none 1=letter 2=word 3=all
completed_at    timestamptz
UNIQUE(user_id, sentence_id)
```

### saved_sentences

```sql
id              uuid        PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid        REFERENCES auth.users(id) ON DELETE CASCADE
sentence_id     uuid        REFERENCES sentences(id) ON DELETE CASCADE
saved_at        timestamptz DEFAULT now()
note            text
-- Phase 3 additions:
review_interval int         DEFAULT 1             -- SM-2 interval in days
review_ease     float       DEFAULT 2.5           -- SM-2 ease factor
next_review_at  timestamptz DEFAULT now()
UNIQUE(user_id, sentence_id)
```

### Row-level security policies

```sql
-- user_videos: users see only their own rows
CREATE POLICY "users own their library"
  ON user_videos FOR ALL
  USING (auth.uid() = user_id);

-- user_progress: users see only their own rows
CREATE POLICY "users own their progress"
  ON user_progress FOR ALL
  USING (auth.uid() = user_id);

-- saved_sentences: users see only their own rows
CREATE POLICY "users own their saved sentences"
  ON saved_sentences FOR ALL
  USING (auth.uid() = user_id);

-- videos: all authenticated users can read; only service role can write
CREATE POLICY "authenticated users read videos"
  ON videos FOR SELECT
  USING (auth.role() = 'authenticated');
```

---

## 9. API endpoints

### Phase 1

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/videos/import` | Validate URL, check CC, enqueue job → `{ job_id, status }` |
| `GET` | `/api/videos/{id}` | Video metadata + sentence count |
| `GET` | `/api/videos/{id}/sentences` | All sentences (text + timestamps + translations) |
| `GET` | `/api/jobs/{job_id}/status` | Poll job status (Realtime fallback) |
| `GET` | `/api/library` | Current user's video list with progress summary |
| `POST` | `/api/library/{video_id}/favorite` | Toggle `is_favorited` |
| `POST` | `/api/library/{video_id}/tags` | Update `custom_tags` array |
| `DELETE` | `/api/library/{video_id}` | Remove video from user's library |
| `POST` | `/api/progress` | Upsert `user_progress` for a sentence |
| `GET` | `/api/progress/{video_id}` | All sentence progress for a video |
| `POST` | `/api/saved` | Save sentence to `saved_sentences` |
| `DELETE` | `/api/saved/{sentence_id}` | Remove saved sentence |
| `GET` | `/api/saved` | List all saved sentences with video context |

### Phase 2 additions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/videos/{id}/difficulty` | Computed difficulty score + breakdown |
| `POST` | `/api/suggestions` | AI lesson suggestions based on error pattern |

### Phase 3 additions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/review/queue` | Today's spaced repetition queue |
| `POST` | `/api/review/result` | Submit review result, update SM-2 interval |
| `POST` | `/api/library/share` | Toggle public library, return share URL |
| `GET` | `/api/library/@{username}` | View a public library (no auth required) |
| `POST` | `/api/library/@{username}/fork` | Copy all videos to current user's library |

---

## 10. Error handling & edge cases

### 10.1 Import errors

| Condition | HTTP | User-facing message |
|---|---|---|
| Invalid URL format | 400 | `"Invalid URL — please paste a YouTube link"` |
| Video not found / deleted | 404 | `"Video not found or has been removed"` |
| Video private / age-restricted | 403 | `"This video is not publicly accessible"` |
| No English CC (Phase 1) | 400 | `"This video has no English captions — Phase 1 only supports CC-enabled videos"` |
| CC exists but not in English | 400 | `"Only English captions are supported"` |
| yt-dlp failure | — | Worker marks video `failed`, card → `failed` state + toast |
| DeepL quota exceeded | — | Sentences stored without translation; UI shows `"Translation not available"` |
| YouTube API quota exceeded | 503 | `"Service temporarily unavailable — please try again later"` |

### 10.2 Practice session edge cases

| Situation | Behaviour |
|---|---|
| Video deleted from YouTube after import | Player shows YouTube error; sentences remain in DB; practice continues |
| User refreshes mid-sentence | Progress restored from `user_progress`; resumes at first incomplete sentence |
| Sentence > 30 words | Hint system available from attempt 1; no score penalty |
| Sentence contains only proper nouns | match% = 100% (no scoreable words) |
| Input contains extra whitespace | Normalised before matching; not penalised |
| Two sentences have identical text | Matched by `sentence_id`, not text — no conflict |

### 10.3 Realtime fallback

- If Supabase Realtime WebSocket disconnects → frontend polls `GET /api/jobs/{id}/status` every 3 seconds
- Polling stops when `status = ready` or `failed`
- Max polling duration: 5 minutes, then a manual refresh prompt is shown

### 10.4 Concurrent imports

- If two users import the same `youtube_id` simultaneously:
  - First request creates the `videos` row and enqueues the job
  - Second request hits the duplicate check, waits for `status = ready`, then links `user_videos`
  - Handled via PostgreSQL `UNIQUE` constraint on `videos.youtube_id` + optimistic lock retry in the controller

---

## 11. Open questions

1. **Auto-CC quality (Phase 1):** YouTube `trackKind = 'asr'` captions can have significant transcription errors. Should Phase 1 warn users or reject ASR captions entirely? Rejecting reduces noise but limits available content.

2. **`user_videos` deletion:** Removing a video from a user's library only deletes the `user_videos` row — the shared `videos` and `sentences` rows remain. Should a cleanup job run periodically to remove `videos` rows with zero `user_videos` references?

3. **DeepL quota:** Free tier = 500,000 chars/month (~10,000 sentences at 50 chars). Options at scale: (a) per-user translation quota, (b) defer translation until first session open, (c) upgrade to DeepL Pro at launch.

4. **Sentence grouping heuristic:** Punctuation + pause gap > 1.5s may produce very short (1–2 words) or very long (30+ words) sentences depending on the speaker. Do we need a min (5 words) / max (25 words) clamp with forced splits?

5. **Playlist support (Phase 1):** Should the import bar accept YouTube playlist URLs for bulk import, or remain single-URL-only in Phase 1?

6. **Manually advanced sentences:** Currently a manually advanced sentence saves `final_score` at whatever match% was reached at the time of advance. Should advancing with 0% input save a score of 0 or be recorded as `skipped` (a separate state)?

---

## 12. Appendix — Code skeletons

### Import controller (C#)

```csharp
// Controllers/ImportController.cs
[HttpPost("import")]
public async Task<IActionResult> Import([FromBody] ImportRequest req)
{
    // 1. Server-side URL validation (client already validated)
    var videoId = YouTubeHelper.ExtractVideoId(req.Url);
    if (videoId is null)
        return BadRequest(new { message = "Invalid URL — please paste a YouTube link" });

    // 2. Duplicate check
    var existing = await _db.Videos
        .FirstOrDefaultAsync(v => v.YoutubeId == videoId);

    if (existing?.TranscriptStatus == "ready")
    {
        await _library.LinkVideoToUserAsync(req.UserId, existing.Id);
        return Ok(new { videoId = existing.Id, status = "ready" });
    }
    if (existing?.TranscriptStatus is "queued" or "processing")
        return Ok(new { jobId = existing.Id, status = existing.TranscriptStatus });

    // 3. Fetch YouTube metadata + CC check
    var meta = await _youtube.GetVideoMetaAsync(videoId);
    if (meta is null)
        return NotFound(new { message = "Video not found or has been removed" });
    if (!meta.IsPublic)
        return StatusCode(403, new { message = "This video is not publicly accessible" });
    if (!meta.HasEnglishCC)
        return BadRequest(new { message = "This video has no English captions" });

    // 4. Create record + enqueue — return immediately (< 300ms)
    var video = new Video
    {
        YoutubeId = videoId,
        Title = meta.Title,
        ThumbnailUrl = meta.ThumbnailUrl,
        DurationSeconds = meta.DurationSeconds,
        CcType = meta.CcType,          // "standard" or "asr"
        TranscriptStatus = "queued"
    };
    await _db.Videos.AddAsync(video);
    await _library.LinkVideoToUserAsync(req.UserId, video.Id);
    await _db.SaveChangesAsync();

    _jobs.Enqueue<CcImportJob>(j => j.RunAsync(video.Id));

    return Ok(new { jobId = video.Id, status = "queued" });
}
```

### Background job (C#)

```csharp
// Jobs/CcImportJob.cs
public class CcImportJob(AppDbContext db, YtDlpService ytDlp,
    SrtParser parser, DeepLService deepL, SupabaseRealtime realtime)
{
    public async Task RunAsync(Guid videoId)
    {
        await db.Videos.Where(v => v.Id == videoId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.TranscriptStatus, "processing"));

        // 1. Download CC subtitle file
        var srtPath = await ytDlp.DownloadSubtitleAsync(videoId, lang: "en");

        // 2. Parse SRT/VTT → sentence list
        var sentences = parser.Parse(srtPath);

        // 3. Batch translate via DeepL (graceful degradation on quota exceeded)
        List<string?> translations;
        try {
            translations = await deepL.TranslateBatchAsync(
                sentences.Select(s => s.Text).ToList(), targetLang: "VI");
        } catch (DeepLQuotaExceededException) {
            translations = Enumerable.Repeat<string?>(null, sentences.Count).ToList();
        }

        // 4. Bulk insert sentences
        await db.Sentences.AddRangeAsync(sentences.Select((s, i) => new Sentence
        {
            VideoId   = videoId,
            Index     = i,
            Text      = s.Text,
            Translation = translations[i],
            StartTimeMs = s.StartMs,
            EndTimeMs   = s.EndMs
        }));

        // 5. Mark ready
        await db.Videos.Where(v => v.Id == videoId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(v => v.TranscriptStatus, "ready")
                .SetProperty(v => v.SentenceCount, sentences.Count));

        await db.SaveChangesAsync();

        // 6. Push Realtime event → frontend card updates without page refresh
        await realtime.BroadcastAsync($"video:{videoId}", "video_ready", new { videoId });
    }
}
```

### Matching engine (C#)

```csharp
// Services/MatchingEngine.cs
public static MatchResult Evaluate(string input, string expected,
    IEnumerable<string> properNames)
{
    var normalize = (string s) => s
        .ToLowerInvariant()
        .Replace("\u2019", "'")                   // normalise smart apostrophes
        .Where(c => char.IsLetterOrDigit(c) || c == '\'' || c == ' ')
        .Aggregate("", (acc, c) => acc + c)
        .Split(' ', StringSplitOptions.RemoveEmptyEntries);

    var inputWords    = normalize(input);
    var expectedWords = normalize(expected);
    var properSet     = new HashSet<string>(
        properNames.Select(n => n.ToLowerInvariant()));

    // LCS-based word diff
    var lcs            = ComputeLcs(inputWords, expectedWords);
    var scoreableWords = expectedWords.Where(w => !properSet.Contains(w)).ToList();
    var correctCount   = lcs.Count(w => !properSet.Contains(w));

    var matchPercent = scoreableWords.Count == 0
        ? 100
        : (int)Math.Round(correctCount * 100.0 / scoreableWords.Count);

    return new MatchResult
    {
        MatchPercent = matchPercent,
        IsComplete   = matchPercent >= 95,
        WordStates   = BuildWordStates(inputWords, expectedWords, lcs, properSet)
    };
}
```

### Frontend Realtime listener (TypeScript)

```typescript
// hooks/useVideoReady.ts
export function useVideoReady(jobId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`video:${jobId}`)
      .on('broadcast', { event: 'video_ready' }, () => {
        queryClient.invalidateQueries({ queryKey: ['library'] })
      })
      .subscribe()

    // Fallback polling if Realtime disconnects
    const poll = setInterval(async () => {
      const { data } = await fetch(`/api/jobs/${jobId}/status`).then(r => r.json())
      if (data.status === 'ready' || data.status === 'failed') {
        queryClient.invalidateQueries({ queryKey: ['library'] })
        clearInterval(poll)
      }
    }, 3000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [jobId])
}
```

---

*v2.1 · Full English · Phase 1 ready to build*