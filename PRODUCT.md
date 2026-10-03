# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vanilla HTML · CSS · JavaScript (no build tool), served as static files by a Python FastAPI backend; MySQL 8.0. Desktop browsers first (Chrome/Edge) for the sequencer; marketing and account pages must also work on mobile. (Decided by the user in `StudioNx_CLAUDE.md`.)

## Users

- Beginner producers who find installing or buying a desktop DAW a barrier and do not yet know how to mix.
- Beat makers and hobby composers who work sample-first and move between computers.
- Small collaborating teams (bands, composition study groups) tired of passing project files around.

## Product Purpose

Studio Nx is a browser-based DAW sequencer: drop samples, write MIDI, shape sound with web-native instruments and effects, and export WAV/MP3 — with no install. Success is a newcomer finishing and exporting a track in the browser.

## Positioning

- AI reference analysis: give it a track you love (link or file) plus a genre, and it recommends synth/effect presets and mixing/mastering settings that apply directly to the project.
- Real-time collaboration in the style of Google Docs, with a per-project group chat.
- Nyxi — an original character who dances to the beat in the sequencer (like FL Studio's Fruity Dance) and is the face of the built-in AI assistant.

## Operating Context

Long creative sessions, often at night; switching between home and other computers; headphones and USB MIDI keyboards. The landing page (`home.html`) introduces the service and routes visitors to Sign In / Join Us.

## Capabilities and Constraints

- Feature scope and phases: `docs/PRD/00_PRD_Overview.md` … `06_*.md`; build order: `docs/Implementation_Plan.md`.
- AI may write HTML/CSS; JavaScript and backend logic are templates only unless the user asks. C++ (JUCE → WASM) is user-only.
- Before writing HTML/CSS, read `studionx/frontend-reference/` (layout references and annotated change requests).

## Brand Commitments

- Name: **Studio Nx**. Character/assistant name: **Nyxi**.
- Nyxi artwork, logo (a crescent moon taken from Nyxi's headband), and animations are produced on an external AI platform; this project never draws or redesigns the character, only places supplied assets. Character files: `studionx/characters/nyxi/`.
- Copy language for the landing hero: English.

## Evidence on Hand

- Nyxi images: `studionx/characters/nyxi/base/nyxi_base_v1.png`, transparent landing pose `studionx/characters/nyxi/poses/main page transparent.png`.
- No users, testimonials, metrics, or pricing exist yet — do not invent them.
- Logo file not delivered yet (placeholder until it arrives).

## Product Principles

1. No install, no friction: the first sound should be minutes away.
2. AI explains and recommends; the producer decides and can undo everything.
3. Make the room feel alive — Nyxi and collaboration exist to keep a creator company.
4. Respect the craft: real audio quality and precise timing over gimmicks.
