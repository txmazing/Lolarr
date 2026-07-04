# Graph Report - .  (2026-07-04)

## Corpus Check
- 218 files · ~106,941 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1173 nodes · 2196 edges · 86 communities (81 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.78)
- Token cost: 0 input · 271,111 output

## Community Hubs (Navigation)
- [[_COMMUNITY_seerr.ts|seerr.ts]]
- [[_COMMUNITY_server.ts|server.ts]]
- [[_COMMUNITY_jellyfinLibrary.ts|jellyfinLibrary.ts]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_Player|Player]]
- [[_COMMUNITY_HomeScreen.tsx|HomeScreen.tsx]]
- [[_COMMUNITY_AVPlay|AVPlay]]
- [[_COMMUNITY_NotificationsProvider.test.tsx|NotificationsProvider.test.tsx]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_playbackSession.ts|playbackSession.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_app.tsx|app.tsx]]
- [[_COMMUNITY_AVPlayPlayer|AVPlayPlayer]]
- [[_COMMUNITY_packagesfeatures Moon Project C|packages/features Moon Project C]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_experience.tsx|experience.tsx]]
- [[_COMMUNITY_ActionComponent|ActionComponent]]
- [[_COMMUNITY_appstv Moon Project Config|apps/tv Moon Project Config]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_App.tsx|App.tsx]]
- [[_COMMUNITY_web build task|web build task]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_tizenDeviceProfile.ts|tizenDeviceProfile.ts]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_Lolarr Monorepo (Moonrepo)|Lolarr Monorepo (Moonrepo)]]
- [[_COMMUNITY_deviceProfile.ts|deviceProfile.ts]]
- [[_COMMUNITY_WebPlayer|WebPlayer]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_Lolarr Slice 1 Fundament + Auth|Lolarr Slice 1: Fundament + Auth]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_AVPlayPlayer (Tizen native AVPla|AVPlayPlayer (Tizen native AVPla]]
- [[_COMMUNITY_packagesjellyfin Moon Project C|packages/jellyfin Moon Project C]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_packagesdomain|packages/domain]]
- [[_COMMUNITY_Docker Service api|Docker Service: api]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_PlayerControls.tsx|PlayerControls.tsx]]
- [[_COMMUNITY_GET apihome endpoint|GET /api/home endpoint]]
- [[_COMMUNITY_Lolarr Slice 6 Seerr-Webhooks -|Lolarr Slice 6: Seerr-Webhooks -]]
- [[_COMMUNITY_Moon Workspace Config|Moon Workspace Config]]
- [[_COMMUNITY_domain-schemas.test.ts|domain-schemas.test.ts]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_PlaybackSession orchestration|PlaybackSession orchestration]]
- [[_COMMUNITY_SeasonRequestPicker.tsx|SeasonRequestPicker.tsx]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_RequestList.tsx|RequestList.tsx]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_appsapi Moon Project Config|apps/api Moon Project Config]]
- [[_COMMUNITY_react.ts|react.ts]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_appsweb Moon Project Config|apps/web Moon Project Config]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_EpisodeList.tsx|EpisodeList.tsx]]
- [[_COMMUNITY_Norigin Spatial Navigation (SKIL|Norigin Spatial Navigation (SKIL]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_tsconfig.app.json|tsconfig.app.json]]
- [[_COMMUNITY_tsconfig.node.json|tsconfig.node.json]]
- [[_COMMUNITY_tsconfig.app.json|tsconfig.app.json]]
- [[_COMMUNITY_tsconfig.node.json|tsconfig.node.json]]
- [[_COMMUNITY_appsapisrcmodulesrequests.ts|apps/api/src/modules/requests.ts]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_HomeScreenBadge.test.tsx|HomeScreenBadge.test.tsx]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_Lolarr Tizen App Favicon|Lolarr Tizen App Favicon]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]

## God Nodes (most connected - your core abstractions)
1. `ActionComponent` - 33 edges
2. `LolarrDatabase` - 27 edges
3. `createServer()` - 24 edges
4. `AVPlayPlayer` - 24 edges
5. `createTestContext()` - 18 edges
6. `Player` - 18 edges
7. `SeerrAdapter` - 17 edges
8. `SeerrSessionService` - 17 edges
9. `MediaItem` - 17 edges
10. `useApi()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `pnpm Package Manager (Toolchain)` --conceptually_related_to--> `pnpm Workspace Config`  [INFERRED]
  .moon/toolchains.yml → pnpm-workspace.yaml
- `apps/* Workspace Glob` --conceptually_related_to--> `Moon Workspace Config`  [INFERRED]
  pnpm-workspace.yaml → .moon/workspace.yml
- `packages/* Workspace Glob` --conceptually_related_to--> `Moon Workspace Config`  [INFERRED]
  pnpm-workspace.yaml → .moon/workspace.yml
- `Docker Service: api` --conceptually_related_to--> `apps/api Moon Project Config`  [INFERRED]
  docker-compose.yml → apps/api/moon.yml
- `api build task` --references--> `domain build task`  [EXTRACTED]
  apps/api/moon.yml → packages/domain/moon.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **TV Tizen Sync Flow (features/ui build to tizen-index.html to tizen/ output)** — packages_features_moon_build_task, packages_ui_moon_build_task, apps_tv_moon_tizen_sync_task, apps_tv_tizen_index_html_2 [EXTRACTED 1.00]
- **apps/web Build Dependency Chain (domain to ui/features to web)** — packages_domain_moon_build_task, packages_ui_moon_build_task, packages_features_moon_build_task, apps_web_moon_build_task [EXTRACTED 1.00]
- **Docker Compose Deployment Stack (api + web services)** — docker_compose_service_api, docker_compose_service_web, docker_compose_volume_lolarr_data [EXTRACTED 1.00]
- **401-Kaskade participants (Jellyfin token, Seerr session, Silent-QC)** — concept_401_cascade, concept_silent_quick_connect, concept_seerr_api_key_scoping, code_apps_api [INFERRED 0.85]
- **Webhook-to-toast notification pipeline** — code_apps_api_webhooks_module, code_map_webhook_to_notification, code_notifications_table, code_apps_api_notifications_module, code_notifications_provider, code_toast_stack [EXTRACTED 1.00]
- **Player platform abstraction across web/Tizen** — code_player_interface, code_web_player, code_avplay_player, concept_player_platform_seam, code_playback_session [INFERRED 0.90]

## Communities (86 total, 5 thin omitted)

### Community 0 - "seerr.ts"
Cohesion: 0.06
Nodes (40): extractItems(), imageUrl(), isMediaItem(), isRecord(), mapSeasonAvailabilities(), mapSeerrAvailability(), mapSeerrItem(), mapSeerrRequest() (+32 more)

### Community 1 - "server.ts"
Cohesion: 0.07
Nodes (32): coerceTmdbId(), MappedNotification, mapWebhookToNotification(), normalizeMediaType(), NotificationKind, SeerrWebhookPayload, seerrWebhookSchema, TYPE_TO_KIND (+24 more)

### Community 2 - "jellyfinLibrary.ts"
Cohesion: 0.08
Nodes (44): assertOk(), authenticateByName(), authenticateWithQuickConnect(), authorizeQuickConnect(), buildAuthorizationHeader(), getQuickConnectState(), initiateQuickConnect(), JellyfinAuthResult (+36 more)

### Community 3 - "devDependencies"
Cohesion: 0.05
Nodes (38): devDependencies, @babel/core, babel-plugin-react-compiler, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+30 more)

### Community 4 - "index.ts"
Cohesion: 0.13
Nodes (21): Availability, MediaItem, labelForAvailability(), DefaultTextInput(), DetailPanel(), DetailPanelProps, requestLabel(), HeroPanel() (+13 more)

### Community 5 - "Player"
Cohesion: 0.09
Nodes (12): StreamSource, PlaybackApi, DeviceProfileValue, Player, PlayerEvent, PlayerHost, VIDEO_EVENT_MAP, directSource (+4 more)

### Community 6 - "HomeScreen.tsx"
Cohesion: 0.19
Nodes (17): useApi(), DetailScreen(), HomeScreen(), useHome(), readErrorMessage(), enrichItems(), resolveItemImages(), LibraryDetailScreen() (+9 more)

### Community 7 - "AVPlay"
Cohesion: 0.07
Nodes (7): AVPlay, AVPlayListener, AVPlayState, ProductInfo, TizenSystemInfo, TvInputDevice, TvInputDeviceKey

### Community 8 - "NotificationsProvider.test.tsx"
Cohesion: 0.10
Nodes (19): NotificationsContext, NotificationsContextValue, NotificationsProvider(), ToastContext, ToastContextValue, ToastProvider(), useToast(), APPROVED (+11 more)

### Community 9 - "index.ts"
Cohesion: 0.08
Nodes (23): availabilitySchema, discoverResponseSchema, episodeSchema, ErrorResponse, errorResponseSchema, jellyfinSessionSchema, libraryDetailResponseSchema, loginResponseSchema (+15 more)

### Community 10 - "playbackSession.ts"
Cohesion: 0.19
Nodes (18): JellyfinSession, authorizationHeader(), buildStoppedBeaconPayload(), buildStreamSource(), getPlaybackInfo(), jellyfinRequest(), JellyfinRequestError, MediaSourceInfo (+10 more)

### Community 11 - "package.json"
Cohesion: 0.09
Nodes (21): dependencies, fastify, @fastify/cors, @fastify/rate-limit, @lolarr/domain, zod, devDependencies, tsx (+13 more)

### Community 12 - "app.tsx"
Cohesion: 0.20
Nodes (14): LolarrApp(), LolarrAppProps, LolarrExperience(), canUseRuntimeGatewayConfig(), isFileProtocol(), normalizeApiBaseUrl(), readInitialApiBaseUrl(), readStoredApiBaseUrl() (+6 more)

### Community 14 - "packages/features Moon Project C"
Cohesion: 0.15
Nodes (20): tv typecheck task, web typecheck task, Moon Project: api-client, Moon Project: domain, Moon Project: features, Moon Project: ui, api-client lint task, packages/api-client Moon Project Config (+12 more)

### Community 15 - "index.ts"
Cohesion: 0.12
Nodes (16): createLolarrApiClient(), LolarrApiClient, LolarrApiClientOptions, LolarrApiError, DiscoverResponse, HomeResponse, LibraryDetailResponse, MediaDetailResponse (+8 more)

### Community 16 - "experience.tsx"
Cohesion: 0.22
Nodes (14): LoginRequest, LoginResponse, QuickConnectScreen(), QuickConnectScreenProps, adoptSession(), useAuth(), writeStoredToken(), AuthenticatedExperience() (+6 more)

### Community 17 - "ActionComponent"
Cohesion: 0.14
Nodes (11): GatewayScreen(), LoginScreen(), AppFrame(), AppFrameProps, AutoplayOverlay(), GatewayPanel(), GatewayPanelProps, LoginPanel() (+3 more)

### Community 18 - "apps/tv Moon Project Config"
Cohesion: 0.16
Nodes (18): apps/tv index.html Entry, apps/tv src/main.tsx, tv build task, tv dev task, tv lint task, apps/tv Moon Project Config, tv tizen-sync task, apps/tv tizen-index.html (Tizen Build Source) (+10 more)

### Community 19 - "index.ts"
Cohesion: 0.16
Nodes (9): AutoplayNext(), session, storage, JellyfinImageType, readJellyfinSession(), SessionStorageReader, getNextUpEpisode(), NextUpEpisode (+1 more)

### Community 20 - "package.json"
Cohesion: 0.11
Nodes (17): dependencies, hls.js, @lolarr/domain, @lolarr/jellyfin, devDependencies, jsdom, vitest, exports (+9 more)

### Community 21 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+9 more)

### Community 22 - "App.tsx"
Cohesion: 0.22
Nodes (12): activateTextInput(), blurActiveTextInput(), blurTextInput(), findTextInputByFocusKey(), focusTextInputByKey(), isBackKey(), scrollFocusedElementIntoView(), selectTextForEditing() (+4 more)

### Community 23 - "web build task"
Cohesion: 0.17
Nodes (15): desktop build task, desktop lint task, apps/desktop Moon Project Config, desktop typecheck task, apps/desktop README, Tauri Desktop Shell (Planned), Capacitor Mobile Shell (Planned), mobile build task (+7 more)

### Community 24 - "index.ts"
Cohesion: 0.28
Nodes (9): PlayerScreen(), usePlaybackSession(), createPlaybackSession(), PlaybackSessionHandle, PlaybackSessionState, isTizenPlayerAvailable(), MEDIA_KEYS, tizenPlatform (+1 more)

### Community 25 - "package.json"
Cohesion: 0.13
Nodes (14): dependencies, @lolarr/domain, devDependencies, vitest, exports, name, private, scripts (+6 more)

### Community 26 - "tizenDeviceProfile.ts"
Cohesion: 0.23
Nodes (12): audioCodecsForYear(), buildTizenDeviceProfile(), defaultInfoSource(), detectTizenYear(), MODEL_YEAR, safe(), TizenInfoSource, VERSION_YEAR (+4 more)

### Community 27 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+6 more)

### Community 28 - "Lolarr Monorepo (Moonrepo)"
Cohesion: 0.16
Nodes (14): apps/desktop (placeholder), apps/mobile (placeholder), apps/web, api-client deleteRequest method, Lolarr Monorepo (Moonrepo), packages/api-client, packages/features, packages/ui (+6 more)

### Community 29 - "deviceProfile.ts"
Cohesion: 0.20
Nodes (10): AUDIO_CODEC_PROBES, buildDeviceProfile(), DeviceProfile, probe(), resolveTypeSupport(), TypeSupportCheck, VIDEO_CODEC_PROBES, webPlatform (+2 more)

### Community 31 - "package.json"
Cohesion: 0.14
Nodes (13): dependencies, @lolarr/domain, exports, ./styles.css, name, private, scripts, build (+5 more)

### Community 32 - "scripts"
Cohesion: 0.15
Nodes (12): name, private, scripts, build, build:tizen, dev, lint, preview (+4 more)

### Community 33 - "Lolarr Slice 1: Fundament + Auth"
Cohesion: 0.22
Nodes (13): apps/api (Fastify BFF), GET /api/library/:itemId endpoint, packages/jellyfin (client image-URL builder), Tizen Remote Media-Key Registration, Jellyfin (media server), Lolarr Hybrid-BFF Architecture, Moonfin (Tizen/webOS reference client), Password Login Flow (Web) (+5 more)

### Community 34 - "package.json"
Cohesion: 0.15
Nodes (12): exports, name, peerDependencies, react, private, scripts, build, lint (+4 more)

### Community 35 - "AVPlayPlayer (Tizen native AVPla"
Cohesion: 0.23
Nodes (12): AVPlayPlayer (Tizen native AVPlay implementation), packages/player, Player interface, packages/player/src/tizen.d.ts (ambient webapis/tizen types), buildTizenDeviceProfile, webPlatform factory (packages/player), WebPlayer (hls.js-based Player impl), AVPlay 500ms Polling for timeupdate (+4 more)

### Community 36 - "packages/jellyfin Moon Project C"
Cohesion: 0.17
Nodes (12): Moon Project: jellyfin, Moon Project: player, jellyfin build task, jellyfin lint task, packages/jellyfin Moon Project Config, jellyfin test task, jellyfin typecheck task, player build task (+4 more)

### Community 37 - "package.json"
Cohesion: 0.17
Nodes (11): dependencies, @lolarr/domain, exports, name, private, scripts, build, lint (+3 more)

### Community 38 - "package.json"
Cohesion: 0.17
Nodes (11): dependencies, zod, exports, name, private, scripts, build, lint (+3 more)

### Community 39 - "packages/domain"
Cohesion: 0.18
Nodes (11): apps/api/src/config.ts loadConfig, apps/api/src/services/crypto.ts, episodeSchema / seasonSchema, homeResponseSchema, mapJellyfinItem (Jellyfin item -> MediaItem mapping), packages/domain, Demo-Mode Removal, MediaItem.jellyfin sub-object (Approach A) (+3 more)

### Community 40 - "Docker Service: api"
Cohesion: 0.22
Nodes (10): Dockerfile.api, Dockerfile.web, JELLYFIN_URL Env Var, LOLARR_DATABASE_PATH Env Var, LOLARR_SECRET Env Var, SEERR_API_KEY Env Var, SEERR_URL Env Var, Docker Service: api (+2 more)

### Community 41 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, allowImportingTsExtensions, declaration, declarationMap, noEmit, outDir, rootDir, sourceMap (+1 more)

### Community 42 - "package.json"
Cohesion: 0.20
Nodes (9): dependencies, @lolarr/features, @lolarr/ui, react, react-dom, name, private, type (+1 more)

### Community 43 - "PlayerControls.tsx"
Cohesion: 0.24
Nodes (5): App(), DefaultAction(), formatTime(), PlayerControls(), PlayerControlsProps

### Community 44 - "GET /api/home endpoint"
Cohesion: 0.20
Nodes (10): GET /api/home endpoint, NotificationsProvider / useNotifications, ToastStack component, 401-Kaskade (session invalidation cascade), Discover 5-minute In-Memory Cache, "Toast exactly once" Dedup Strategy, Poll (~45s) instead of SSE/WebSocket Realtime Push, Quick Connect Login Flow (TV) (+2 more)

### Community 45 - "Lolarr Slice 6: Seerr-Webhooks -"
Cohesion: 0.27
Nodes (10): apps/api/src/modules/notifications.ts, apps/api/src/modules/webhooks.ts, mapWebhookToNotification (pure mapping function), notificationSchema / notificationsResponseSchema, notifications SQLite table, Username-based User Matching (no email fallback), LOLARR_WEBHOOK_SECRET config, Lolarr Slice 6: Seerr-Webhooks -> Notifications (Implementation Plan) (+2 more)

### Community 46 - "Moon Workspace Config"
Cohesion: 0.22
Nodes (10): Moon Toolchains Config, Node.js 25.8.0, pnpm 11.9.0, pnpm Package Manager (Toolchain), Moon Workspace Config, apps/* Workspace Glob, pnpm Workspace Config, esbuild allowBuilds Entry (+2 more)

### Community 47 - "domain-schemas.test.ts"
Cohesion: 0.22
Nodes (8): createRequestSchema, homeResponseSchema, mediaDetailResponseSchema, mediaItemSchema, mediaRequestSchema, notificationSchema, notificationsResponseSchema, requestStatusSchema

### Community 48 - "package.json"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, lint, typecheck, type, version

### Community 49 - "package.json"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, lint, typecheck, type, version

### Community 50 - "PlaybackSession orchestration"
Cohesion: 0.22
Nodes (9): buildStreamSource function, getPlaybackInfo function, packages/jellyfin playback API (PlaybackInfo/StreamSource/Progress), JellyfinRequestError class, PlaybackSession orchestration, Autoplay-Next Overlay (10s countdown), DirectPlay -> Transcode Retry Rule, ProgressReporter (10s interval + event-driven reporting) (+1 more)

### Community 51 - "SeasonRequestPicker.tsx"
Cohesion: 0.50
Nodes (6): SeasonAvailability, SeasonRequestPicker(), SeasonRequestPickerProps, pruneSelection(), selectableSeasonNumbers(), toggleSeason()

### Community 52 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @lolarr/features, @lolarr/player, @lolarr/ui, @noriginmedia/norigin-spatial-navigation-core, @noriginmedia/norigin-spatial-navigation-react, react, react-dom

### Community 53 - "RequestList.tsx"
Cohesion: 0.39
Nodes (5): RequestStatus, RequestListProps, requestTitle(), RequestStatusBadge(), labelForRequestStatus()

### Community 54 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @lolarr/api-client, @lolarr/domain, @lolarr/jellyfin, @lolarr/player, @lolarr/ui, @tanstack/react-query, zustand

### Community 55 - "apps/api Moon Project Config"
Cohesion: 0.29
Nodes (7): api build task, api dev task, api lint task, apps/api Moon Project Config, api test task, api typecheck task, Moon Project: api

### Community 56 - "react.ts"
Cohesion: 0.43
Nodes (3): defineLolarrReactConfig(), peerDependencies, react

### Community 57 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, jsdom, react, react-dom, @testing-library/dom, @testing-library/react, vitest

### Community 58 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, jsdom, react, react-dom, @testing-library/dom, @testing-library/react, vitest

### Community 59 - "apps/web Moon Project Config"
Cohesion: 0.33
Nodes (6): apps/web index.html Entry, apps/web src/main.tsx, web dev task, web lint task, apps/web Moon Project Config, Moon Project: web

### Community 60 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, typecheck

### Community 61 - "EpisodeList.tsx"
Cohesion: 0.40
Nodes (3): Episode, EpisodeList(), episodes

### Community 62 - "Norigin Spatial Navigation (SKIL"
Cohesion: 0.40
Nodes (5): FocusContext.Provider, Norigin Spatial Navigation (SKILL), @noriginmedia/norigin-spatial-navigation-core, useFocusable hook, apps/tv

### Community 63 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 64 - "tsconfig.app.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 65 - "tsconfig.node.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 66 - "tsconfig.app.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 67 - "tsconfig.node.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 68 - "apps/api/src/modules/requests.ts"
Cohesion: 0.40
Nodes (5): apps/api/src/modules/requests.ts, Home Degradation Strategy (Promise.allSettled row-wise), Seerr Request/Media Status Mapping Table, Seerr (request management server), Seerr as Source of Truth for Requests

### Community 69 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 70 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 72 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 73 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 74 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 75 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): compilerOptions, tsBuildInfoFile, extends, include

### Community 76 - "Lolarr Tizen App Favicon"
Cohesion: 0.67
Nodes (4): Lolarr TV App Favicon, Lolarr Tizen App Favicon, Lolarr Tizen App Icon (PNG), Lolarr Web App Favicon

## Ambiguous Edges - Review These
- `packages/jellyfin Moon Project Config` → `packages/player Moon Project Config`  [AMBIGUOUS]
  packages/jellyfin/moon.yml · relation: conceptually_related_to

## Knowledge Gaps
- **406 isolated node(s):** `name`, `private`, `version`, `type`, `build` (+401 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `packages/jellyfin Moon Project Config` and `packages/player Moon Project Config`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `AVPlayPlayer` connect `AVPlayPlayer` to `index.ts`, `Player`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `Player` connect `Player` to `index.ts`, `playbackSession.ts`, `AVPlayPlayer`, `WebPlayer`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `MediaItem` connect `index.ts` to `seerr.ts`, `jellyfinLibrary.ts`, `HomeScreen.tsx`, `index.ts`, `experience.tsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `createServer()` (e.g. with `authRoutes()` and `discoverRoutes()`) actually correct?**
  _`createServer()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _413 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seerr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05660945498343872 - nodes in this community are weakly interconnected._