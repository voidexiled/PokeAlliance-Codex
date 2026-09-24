import { defineConfig, devices } from '@playwright/test';

import { ACCOUNT_ORIGIN, localSupabase } from './tests/e2e/local-supabase';

// The six projects of §14.3 over the two servers of the same section.
//
// Server 1 is the Astro development server, started with node and no PowerShell, which
// the Playwright container does not carry (scripts/test/start-astro.ps1 goes away with
// this change). It carries `COMERCIO_DEMO=1` so the Comercio specs have listings (§9.2);
// that variable never reaches the production build, which `seo:check` checks from M12.
//
// Server 2 is scripts/test/serve-vercel-output.mjs over `.vercel/output`, so the `prod`
// and `visual` projects measure the configuration that gets deployed — the 302 of
// `astro.config.mjs` and the on-demand 404 included — instead of a copy of it. It needs
// `pnpm build` to have run, and so does tests/e2e/routes.ts, which reads the §14.4 route
// list from `.vercel/output/static`.
//
// Supabase (M13, OG-1). .env names the owner's remote Supabase project, and Astro reads it
// unless the environment already sets the variable, even to an empty value. So both servers
// run with the three Supabase variables blank: no test ever reaches the remote project, the
// site is in local mode and `/{l}/cuenta/` does not exist on them. Account mode is tested on
// a third server, on 4323, pointed at the LOCAL stack (`supabase start`,
// tests/e2e/local-supabase.ts); it is only started when `supabase status` reports one, and
// the specs that use it (cuenta.spec.ts, comercio-fase-b.spec.ts and the account case of
// guild.spec.ts) skip otherwise. It runs Comercio phase B (COMERCIO_PUBLICO and COMERCIO_DEMO,
// 9.2): registration is the same for every account (9.15.1), and phase B only adds to it.
//
// Two things §14.3 asks of every project are not here, because Playwright 1.63 has no
// configuration option for either: `page.route('https://wiki.pokealliance.com/**')` and
// `page.clock.setFixedTime`. `PlaywrightTestOptions` carries neither a route handler nor
// a clock, and an auto fixture only reaches a spec through the module it imports `test`
// from. Both live in tests/e2e/routes.ts as `stubRemoteArt` and `freezeClock`, which a
// spec calls in its own `beforeEach`.

const DEV = 'http://127.0.0.1:4321';
const OUTPUT = 'http://127.0.0.1:4322';

/** The Supabase variables of .env, overridden for every server (see the head of this file). */
const NO_SUPABASE = {
  PUBLIC_SUPABASE_URL: '',
  PUBLIC_SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
};

const stack = localSupabase();

/**
 * The answer of the Comercio 18+ gate (9.15.2, `AGE_ANSWER_KEY` of AgeGate.tsx), already given
 * on every server: otherwise its dialog covers every Comercio page a spec opens. The specs of the
 * gate itself clear it with `test.use({ storageState: NO_STORAGE })`.
 */
const AGE_ANSWERED = {
  cookies: [],
  origins: [DEV, OUTPUT, ACCOUNT_ORIGIN].map((origin) => ({
    origin,
    localStorage: [{ name: 'alliance-codex:comercio:edad:v1', value: 'adulto' }],
  })),
};

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/**
 * §14.3, `prod` row: these read the Vercel output, so the projects on the development
 * server leave them out. The `desktop` row of that table says «todos salvo perf, prod,
 * motion, mobile-menu y visual», but `seo`, `links` and `money` describe themselves as
 * «sobre la salida de Vercel»: on the development server there are no redirections from
 * `config.json` to check, so they belong to `prod` alone. So does `rutas` (M11): RZ1–RZ3,
 * NF1–NF3, MP1–MP3 and CP1 run «sobre el emulador de la salida de Vercel» (§8.11–§8.14).
 */
const OUTPUT_SPECS = [
  '**/prod.spec.ts',
  '**/perf.spec.ts',
  '**/seo.spec.ts',
  '**/links.spec.ts',
  '**/money.spec.ts',
  '**/rutas.spec.ts',
];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // One Astro development server compiles every page on demand for all the workers of the
  // `desktop`, `mobile`, `webkit-mobile` and `reduced-motion` projects, and the parity pages
  // hydrate dozens of islands each. At Playwright's default of half the logical cores (6 on
  // a 12-thread machine) that server ran out of resources mid-run (ERR_INSUFFICIENT_RESOURCES,
  // then ERR_CONNECTION_REFUSED) and browsers crashed, so locally a quarter of the cores
  // runs at once. It changes no check, only how many run together, and `--workers` still
  // overrides it. CI keeps the default.
  workers: process.env.CI ? undefined : '25%',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'on-first-retry',
    storageState: AGE_ANSWERED,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP, baseURL: DEV },
      testIgnore: [...OUTPUT_SPECS, '**/motion.spec.ts', '**/mobile-menu.spec.ts'],
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        baseURL: DEV,
      },
      // The `mobile` row of §14.3 does not name `mobile-menu`, but the row of
      // `mobile-menu.spec.ts` asks for V5-4 «en `mobile` y en `webkit-mobile`». Nor does it
      // name `lists`, which the plan (M6) runs in `desktop` and `mobile`: the list controller
      // and the compact cards answer a touch pointer too.
      testMatch: [
        '**/smoke.spec.ts',
        '**/a11y.spec.ts',
        '**/keyboard.spec.ts',
        '**/contract.spec.ts',
        '**/tooltip.spec.ts',
        '**/content-sentinel.spec.ts',
        '**/mobile-menu.spec.ts',
        '**/lists.spec.ts',
      ],
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'], baseURL: DEV },
      testMatch: ['**/mobile-menu.spec.ts'],
    },
    {
      name: 'reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        viewport: DESKTOP,
        reducedMotion: 'reduce',
        baseURL: DEV,
      },
      testMatch: ['**/motion.spec.ts'],
    },
    {
      name: 'prod',
      // §14.6: `perf` runs with no retries so an intermittent difference is not hidden,
      // and `perf` lives in this project. The other four read a static build served from
      // this machine, so a retry there could only hide a real failure.
      retries: 0,
      // The `prod` row of §14.3 reads «Desktop Chrome y 390 × 844», and a project takes
      // one viewport. §14.1 fixes `test:e2e` to these five projects, so the second width
      // lives inside the specs that change with it: `perf`, `money` and `links` declare
      // both with `test.use`. `seo` never builds a page (every check goes through
      // `request`) and `prod` measures font traffic and URL state, so neither of those
      // two reads differently at 390.
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP, baseURL: OUTPUT },
      testMatch: OUTPUT_SPECS,
    },
    {
      name: 'visual',
      // §14.6: no retries, for the same reason.
      retries: 0,
      // §14.5: the specs are `tests/visual/*.spec.ts`; `content/`, `fixtures/`,
      // `goldens/` and `baselines/` beside them hold data, not tests.
      testDir: './tests/visual',
      testMatch: ['*.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: DESKTOP,
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        baseURL: OUTPUT,
      },
    },
  ],
  webServer: [
    {
      // `--ignore-lock` and `ASTRO_DEV_BACKGROUND` keep this server in the foreground,
      // which is what Playwright needs from a `webServer`. Astro 7.3 detects an agent
      // environment and then starts the dev server as a detached daemon that writes
      // `.astro/dev.json` and returns at once (`dist/cli/dev/index.js:91-119`), so the
      // process Playwright watches exits and the run fails with «exited early». Setting
      // the variable turns that detection off, exactly as the daemon does for its own
      // worker, and `--ignore-lock` starts the server without reading or writing the
      // lock file, so a stale `.astro/dev.json` from a killed server cannot stop a run.
      command:
        'node node_modules/astro/bin/astro.mjs dev --host 127.0.0.1 --port 4321 --ignore-lock',
      url: `${DEV}/es/`,
      env: { ...NO_SUPABASE, COMERCIO_DEMO: '1', ASTRO_DEV_BACKGROUND: '0' },
      // A server already listening on this port is used as it is. One started before the
      // dependencies changed answers its client modules with 504 «Outdated Optimize Dep»
      // and no island hydrates: stop it and let the run start its own.
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'node scripts/test/serve-vercel-output.mjs --port 4322',
      // A real page, not `/`: the root is the 302 of §8.13 with no HTML behind it, so
      // waiting on `/` would not prove the static output is served.
      url: `${OUTPUT}/es/`,
      env: NO_SUPABASE,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    // Account mode, on the local stack only. A server already on 4323 is never reused: nothing
    // would prove it points at the local stack.
    ...(stack === null
      ? []
      : [
          {
            command:
              'node node_modules/astro/bin/astro.mjs dev --host 127.0.0.1 --port 4323 --ignore-lock',
            url: `${ACCOUNT_ORIGIN}/es/cuenta/`,
            env: {
              ...NO_SUPABASE,
              PUBLIC_SUPABASE_URL: stack.url,
              PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
              COMERCIO_PUBLICO: '1',
              COMERCIO_DEMO: '1',
              ASTRO_DEV_BACKGROUND: '0',
            },
            reuseExistingServer: false,
            timeout: 120_000,
          },
        ]),
  ],
});
