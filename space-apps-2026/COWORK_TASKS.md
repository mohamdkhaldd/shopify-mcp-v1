# Tasks for Claude Cowork (paste this whole file into Cowork)

You are helping Team StellarOps finish their NASA Space Apps 2026 game, **StellarOps Mission Lab**.
The code is already done and pushed. These tasks need the team's own browser accounts (GitHub, Google, Supabase, Google Flow).
Do them in order. Ask the user to sign in when a page needs it. Never paste passwords or secrets into chat.

---

## Task 1 · Turn on GitHub Pages (public game link)
1. Open https://github.com/mohamdkhaldd/shopify-mcp-v1/settings/pages
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose `claude/magical-darwin-2gtbz6` and folder `/ (root)`. Click **Save**.
4. Wait 1–3 minutes, then open https://mohamdkhaldd.github.io/shopify-mcp-v1/space-apps-2026/
5. Check: the home page shows **MISSION LAB**, and **Online team** says "Connected".
   - If the page is 404 after 5 minutes, open the repo's **Actions** tab and report the error of the "pages build and deployment" run.

## Task 2 · Google sign-in (keeps each player's levels on any device)
**A. Google Cloud**
1. Open https://console.cloud.google.com/ → create or pick a project named `StellarOps Mission Lab`.
2. **APIs & Services → OAuth consent screen**: User type **External**; app name `StellarOps Mission Lab`; support email = the user's; save. Add the team's Gmail addresses as **Test users**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Web application**.
4. **Authorized redirect URIs** → add exactly: `https://sruvvklwlixpzjyhhnit.supabase.co/auth/v1/callback`
5. Create. Keep the **Client ID** and **Client secret** on screen (do not paste them in chat).

**B. Supabase**
1. Open https://supabase.com/dashboard → project **mission-architect** (`sruvvklwlixpzjyhhnit`).
2. **Authentication → Sign In / Providers → Google** → enable → paste the Client ID and Client secret → Save.
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://mohamdkhaldd.github.io/shopify-mcp-v1/space-apps-2026/`
   - **Redirect URLs**: add `https://mohamdkhaldd.github.io/shopify-mcp-v1/space-apps-2026/**`
4. Test: open the game link → **Sign in with Google** → after coming back, the home page shows the player's name.

## Task 3 · Make the briefing videos in Google Flow
Use `space-apps-2026/FLOW_CLIP_PLAN.md` (same folder). It lists every line of every briefing, the picture to upload as an **Ingredient**, and a ready Flow prompt.
- **Start with Level 1 only** (`storm_*`, 5 videos). Levels 2–4 can keep the current slide videos for the hackathon.
- Make clips with **no dialogue audio**. Join the clips of one video in order, then lay the voice over them (use the current game video's voice track, or a new recording).
- Export each video as **MP4, 1280×720 or 1920×1080**, named exactly as in the plan (e.g. `storm_science.mp4`).
- Give the finished files back to the user, so they can send them to Claude Code to put in the game.

---
When done, report: the public game link, whether Google sign-in works, and which videos are finished.
