# 0009 Use youtube-transcript-api Instead of yt-dlp

Date: 2026-06-06

## Status

Accepted

## Context

Phase 1 needs English transcript text and timestamps for each sentence. Initial implementation used yt-dlp to download VTT files and a custom SRT parser to extract sentences. This added two moving parts (a binary + a parser) and introduced friction: yt-dlp requires a JavaScript runtime (Node.js/Deno) from newer versions, frequently hits YouTube 429 rate limits, and is designed for video/audio download — far more than we need.

## Decision

Replace yt-dlp + SRT parser with `youtube-transcript-api` (Python package). Call it via `python -m youtube_transcript_api {videoId} --format json` and parse the JSON response directly. The package returns `{text, start, duration}` per line — exactly what we store in `sentences.start_time_ms` / `end_time_ms`.

## Alternatives Considered

1. **yt-dlp** — rejected; overkill for subtitle-only use, JS runtime dependency, frequent 429s.
2. **YouTube Captions.download API (official)** — rejected; requires OAuth 2.0 and the authenticated user must be the video owner. Unusable for third-party videos.
3. **Direct timedtext URL scraping** — same underlying mechanism as youtube-transcript-api but without maintained error handling and retry logic.

## Consequences

Positive:
- Single Python subprocess call replaces two services (IYtDlpService + ISrtParser).
- No binary installation needed beyond the pip package.
- HTML entity decoding handled in one place.
- Segment timestamps preserved (`start + duration → endMs`), supporting per-sentence video loop playback.

Tradeoffs:
- Still requires Python on the server.
- YouTube IP blocking affects both tools equally; workaround is the same (cookies file via `TranscriptService:CookiesFile` config).

## Follow-Up

- For deployments on blocked IPs: configure `TranscriptService:CookiesFile` with a Netscape-format cookies export from a logged-in browser.
- Phase 2: if auto-generated captions are low quality, add a quality score or Whisper fallback (US-201).
