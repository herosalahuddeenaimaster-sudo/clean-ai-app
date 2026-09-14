# Status — Android app

## What's implemented (all real, not mockups)

1. **Entry point** — `MainActivity.kt` hosts the Compose navigation graph.
2. **Full navigation**: Home → Select → Edit → Processing → Result, for
   both video and image, via `navigation/CleanAiNavHost.kt`. Back
   button, "Continue", "Clean", auto-advance on completion, and "Clean
   Another" (resets and returns to Home) are all wired.
3. **Real Gallery picker** — Android's Photo Picker
   (`ActivityResultContracts.PickVisualMedia`), filtered to images or
   videos depending on which card the person tapped. No storage
   permission needed to pick media.
4. **Real media preview** — Coil (+ `coil-video` for video frames) for
   images/thumbnails, Media3 `ExoPlayer`/`PlayerView` for actual
   video playback with a working play/pause button, aspect ratio
   preserved via letterboxing.
5. **Real area selection** — `ui/screens/edit/MaskCanvas.kt`: brush
   (freehand, 3 size presets) and rectangle tools, drawn with
   `pointerInput`/`detectDragGestures`. Undo removes the last stroke/
   rectangle; Clear wipes everything. The mask is rasterized to an
   actual black/white PNG at the source media's native resolution
   (`util/MaskBitmapGenerator.kt`) — not just a UI overlay.
6. **Backend wired from the actual implementation, not guessed** —
   `data/remote/CleanAiApiService.kt` matches `backend/src/routes/*.js`
   exactly: `POST /api/upload`, `POST /api/jobs`,
   `GET /api/jobs/{jobId}`, `GET /api/jobs/{jobId}/result`,
   `DELETE /api/jobs/{jobId}`.
7. **Loading/success/error states** — `ui/CleanFlowViewModel.kt` drives
   a `JobPhase` state machine (`PREPARING → UPLOADING → QUEUED →
   PROCESSING → DOWNLOADING → COMPLETED/FAILED/CANCELLED`) that every
   screen renders from; no screen guesses at network state on its own.
8. **Real job-status polling** — polls `GET /api/jobs/{jobId}` every
   1.5s, updates the progress ring from the backend's real progress
   value, with a client-side timeout (90s image / 150s video) mapped
   to a "taking longer than expected" error.
9. **Real result on the Result screen** — the actual bytes streamed
   back from `GET /api/jobs/{jobId}/result`, not a placeholder.
10. **Real Save to Gallery** — `util/MediaStoreSaver.kt` inserts into
    `MediaStore.Images`/`MediaStore.Video` with the correct
    scoped-storage handling for Android 10+ vs 9 and below.
11. **"Clean Another"** returns to Home with all flow state and temp
    files cleared.
12. **Error cases** mapped to user-facing messages: no internet,
    upload failed, invalid file, file too large, backend/API error,
    processing failed, timeout, cancelled — see
    `data/model/AppError.kt` + `ui/ErrorMessages.kt`.
13. **No API keys in the app** — the app only ever talks to your own
    backend's base URL (`BuildConfig.BASE_URL`); the AI vendor key
    lives only in the backend's `.env`.
14. **Design preserved** — colors, spacing, corner radii, card/button
    shapes, and the icon language are ported 1:1 from the HTML
    prototype's tokens (`ui/theme/Color.kt`, `Shape.kt`). Two
    intentional, necessary deviations from a literal prototype clone:
    - No fake status bar / gesture pill — a real Android app uses the
      real system status bar, not a drawn imitation of one.
    - Typography currently falls back to the platform's default
      sans-serif. Plus Jakarta Sans / Inter can't be bundled as binary
      font files from here, and I didn't want to fabricate the
      certificate hashes a Downloadable-Fonts XML needs. See the
      comment in `ui/theme/Type.kt` for the two ways to drop in the
      real fonts.

## Update: app icon + rename to "Clean Spark"

- Launcher icon replaced with the user-provided artwork: legacy PNGs
  (`ic_launcher.png` / `ic_launcher_round.png`) at all 5 densities, plus
  a proper adaptive icon (bitmap foreground inset to fit the safe zone,
  solid near-white background matching the artwork's own background).
  Verified visually by compositing/circle-masking the generated PNGs
  before packaging — nothing important gets clipped.
- App display name changed to **Clean Spark** (`app_name` string
  resource) — this drives both the launcher label and the in-app brand
  text on Home, since both read from the same resource.
- **Not renamed**: the internal package id (`com.cleanai.app`) and code
  identifiers (`CleanAiTheme`, `CleanAiNavHost`, etc.) — only the
  user-visible name was in scope here; renaming the package is a much
  larger, purely cosmetic change I didn't make unasked.

## Re-inspection pass (this round) — bugs actually found and fixed

Static re-inspection isn't the same as compiling, but it did catch real
mistakes this time, not just confirm things were fine:

- **Missing `import androidx.compose.foundation.layout.width`** in
  `EditScreen.kt` and `SelectScreen.kt` — both used `Modifier.width(...)`
  without importing it. This would have failed with "unresolved
  reference: width". Fixed.
- **A bogus `import androidx.compose.foundation.layout.weight`** in
  those same two files — `weight()` (and `align()`) are member
  functions of `RowScope`/`ColumnScope`/`BoxScope` themselves, not
  top-level functions in that package, so that import doesn't resolve
  to anything and would have failed the build on its own. Verified
  against real AndroidX source (a Google-authored diff that explicitly
  imports `RowScope` — never `weight` — to use the modifier outside its
  natural scope). Removed from both files.
- Everything else in this pass came back clean under automated
  cross-checks: every `R.string.*` reference has a matching declaration
  (43/43), every cross-file `ui.components`/`ui.theme` import matches an
  actual declaration, every package statement matches its file's actual
  folder, no duplicate top-level declarations, and the backend routes
  were re-read fresh and re-diffed against the Android DTOs/API
  interface line-by-line (still an exact match).

This is a stronger form of checking than "read it and it looked fine,"
but it is still not a compiler. See the next section for what that
distinction means in practice.

## Round 2 — library API verification + proof network is truly blocked

Continuing past the import-level checks, I verified the less-common
API calls against official sources (not just memory):

- `ImageLoader.Builder(context).components { add(VideoFrameDecoder.Factory()) }`
  — confirmed against Coil's own README/changelog; this is the exact
  documented Coil 2.x pattern for `io.coil-kt:coil-video`, matching
  the Gradle coordinate used here.
- `PlayerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT`
  — confirmed against Media3's own source (`PlayerView.java`) and a
  real Compose+`AndroidView` code sample using the identical line.
  (Worth knowing: a few Media3 GitHub issues report `RESIZE_MODE_FIT`
  rendering imperfectly on specific devices/Android 14 combinations —
  an upstream library quirk, not something wrong with this usage.)
- The `org.jetbrains.kotlin.plugin.compose` Compose Compiler Gradle
  plugin setup (declared in the root `build.gradle.kts` with a version
  matching Kotlin's, applied without a version in the module) matches
  Android's official "without version catalogs" setup instructions
  exactly.
- Also validated: every XML file under `res/` parses as well-formed
  XML, no duplicate resource names anywhere, no duplicate top-level
  Kotlin declarations in any package.

I also directly confirmed this sandbox cannot reach any build
infrastructure at all — not "slow," genuinely blocked:

```
$ curl -sI https://repo1.maven.org/maven2/
HTTP/2 403
x-deny-reason: host_not_allowed
```

So there is no path to an actual Gradle build from inside this
environment, with or without more effort. The verification above is
the strongest confidence I can build without a compiler; running
`./gradlew assembleDebug` yourself is still the real test.

## What was NOT run/verified here (be aware before you trust it blindly)

This sandbox has **no Android SDK and no internet access**, so none of
the following could actually be executed:
- `./gradlew build` / `assembleDebug` was never run — no compiler ever
  touched this code.
- No emulator/device test of the Gallery picker, mask drawing, network
  calls, polling, or MediaStore save.
- Dependency versions (AGP 8.7.2, Kotlin 2.0.21, Compose BOM
  2024.12.01, Media3 1.5.0, Retrofit 2.11.0, Coil 2.7.0, Navigation
  2.8.5) are ones I have high confidence are mutually compatible, but
  they were never actually resolved by Gradle here.

Every file was written carefully and cross-checked by hand (function
signatures, imports, package declarations, string resources), but
"I checked it carefully" is not the same guarantee as "it compiled."
**Please build it locally before relying on it.**

## First things to check if `./gradlew assembleDebug` fails

Roughly in order of likelihood:
1. **Dependency version drift** — if Gradle can't resolve an exact
   version pinned in `app/build.gradle.kts`, bump it to whatever's
   current for that artifact; nothing in the code is tied to an exact
   patch version.
2. **Emulator can't reach the backend** — confirm the backend is
   actually running (`curl http://localhost:8080/api/health`) and, for
   a physical device, that you changed `BASE_URL` to your machine's LAN
   IP, not left it as `10.0.2.2`.
3. **Photo Picker unavailable** — on an emulator image without Google
   Play, `PickVisualMedia` falls back to the system document picker
   automatically; this is expected AndroidX behavior, not a bug.
4. **Kotlin/Compose compiler mismatch** — if you change the Kotlin
   version, the `org.jetbrains.kotlin.plugin.compose` plugin version
   in `build.gradle.kts` (root) must match it exactly.

## Command to build/run

```bash
cd backend && npm install && npm start        # terminal 1
```

Then in Android Studio: open `android/`, sync, run the `app`
configuration. Or from the command line with the SDK installed:

```bash
cd android
gradle wrapper
./gradlew installDebug
```
