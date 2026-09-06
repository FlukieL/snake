// Centralized mutable game state and constants shared across all modules.
// Other modules import `state` and mutate its properties directly (never
// reassign the whole object) so every module always sees the latest values.

export const constants = {
    MAX_QUEUE: 2,
    TICK_RATE: 12,
    TICK_INTERVAL: 1000 / 12,
    FRUIT_TYPES: ['apple', 'orange', 'grape', 'cherry', 'lemon'],
    FOOD_POP_DURATION: 260, // ms
    BLINK_DURATION: 130, // ms
    // Primary color for each fruit type, used for the "digestion wave" that
    // travels through the snake's body after eating.
    FRUIT_COLORS: {
        apple: '#ff3b30',
        orange: '#ff9f1c',
        grape: '#8e44ad',
        cherry: '#d21f3c',
        lemon: '#f4e04d'
    },
    DIGESTION_WAVE_SPEED: 26, // segments per second the color wave travels through the body
    DIGESTION_WAVE_WIDTH: 1.6, // width of the glow band, in segments

    // --- Levels Mode ---
    FRUITS_PER_LEVEL: 5, // fruits needed to eat before advancing to the next level
    LEVEL_BASE_TICK_RATE: 12,
    LEVEL_TICK_RATE_STEP: 0.6, // base speed increase per level
    // The per-level speed increase itself grows the higher the level gets, so
    // later levels ramp up noticeably faster than earlier ones (an
    // accelerating difficulty curve rather than a flat linear one).
    LEVEL_TICK_RATE_ACCEL: 0.06,
    LEVEL_MAX_TICK_RATE: 26,
    OBSTACLES_START_LEVEL: 3, // obstacles begin appearing from this level onward
    OBSTACLES_PER_LEVEL: 2, // additional obstacle blocks added per level past the start
    MAX_OBSTACLES: 24,
    OBSTACLE_COLOR: '#5b4636',

    POWERUP_SPAWN_INTERVAL: 11000, // ms between power-up spawn attempts
    POWERUP_LIFETIME: 8000, // ms a spawned power-up stays on the board before vanishing
    MULTIPLIER_DURATION: 10000, // ms a multiplier stack lasts / is refreshed to on pickup
    FOOD_RESPAWN_TIMEOUT: 20000, // ms - in Levels Mode, uneaten food relocates to a new cell after this long

    // Permanent speed penalties, added directly to the tick interval (ms).
    // These stack additively when gained, but partially decay every time the
    // player levels up (see LEVEL_SLOWDOWN_DECAY) so speed gradually recovers
    // as the run progresses, rather than being a permanent dead weight.
    SLOWDOWN_PER_POWERUP: 10, // ms added to tick interval when the "Slow" power-up is collected
    SLOWDOWN_ON_DEATH: 6, // ms added to tick interval every time a life is lost
    LEVEL_SLOWDOWN_DECAY: 4, // ms of accumulated slowdown removed every time the player levels up

    POWERUP_TYPES: {
        multiplier: {
            color: '#ffd54f',
            symbol: '\u00d7',
            duration: 10000,
            label: 'Score Multiplier',
            // Weight controls how much more likely this type is to be chosen
            // vs the others when a power-up spawns (higher = more common).
            weight: 3,
            description: 'Multiplies fruit points x2 for 10 seconds. Grabbing another one while it\u2019s active stacks the multiplier even higher (x3, x4...) and refreshes the timer - the snake flashes yellow while active.'
        },
        invincible: {
            color: '#4fc3f7',
            symbol: '\u2605',
            duration: 6000,
            label: 'Invincible',
            weight: 1,
            description: 'Grants 6 seconds of immunity to obstacles and self-collision - crash safely!'
        },
        shrink: {
            color: '#ba68c8',
            symbol: '-3',
            duration: 0,
            label: 'Shrink',
            weight: 1,
            description: 'Instantly removes up to 3 segments from the snake\u2019s tail, great for escaping tight obstacle mazes.'
        },
        slow: {
            color: '#66bb6a',
            symbol: '\u2744',
            duration: 0,
            label: 'Slow Down',
            weight: 1,
            description: 'Permanently slows the snake down a little for the rest of the run - handy for surviving tricky later levels. Losing a life also slows you down slightly.'
        }
    },

    // --- Lives (Levels Mode only) ---
    STARTING_LIVES: 3,
    POINTS_PER_EXTRA_LIFE: 30, // score needed for the 1st extra life
    // Each subsequent extra life requires this much more than the last
    // (30, then 40, then 50...) rather than a flat repeating amount.
    EXTRA_LIFE_INCREMENT_STEP: 10,

    NOKIA_PIXEL: '#3a3f2e',
    // Levels Mode theme colors (matches the "Play Levels" button's purple).
    LEVELS_ACCENT: '#ba68c8',
    LEVELS_ACCENT_DARK: '#7d3f8e',
    LEVELS_SNAKE_HEAD: '#7d3f8e',
    LEVELS_SNAKE_BODY: '#ba68c8',
    MULTIPLIER_FLASH_COLOR: '#ffe066',
    BANNER_LETTER_COLORS: ['#33d17a', '#4dd0e1', '#ffd54f', '#ff8a65', '#ba68c8', '#4fc3f7'],
    RANK_MEDALS: { 2: 'silver', 3: 'bronze' },
    GOOGLE_CLIENT_ID: '600684655874-jfqakqf9snp67eikljkfsl3qmbtopin5.apps.googleusercontent.com',
    NOKIA_ASCII_LOGO:
        '   _____             _\n' +
        '  / ____|           | |\n' +
        ' | (___  _ __   __ _| | _____\n' +
        '  \\___ \\| \'_ \\ / _` | |/ / _ \\\n' +
        '  ____) | | | | (_| |   <  __/\n' +
        ' |_____/|_| |_|\\__,_|_|\\_\\___|'
};

export const state = {
    gridSize: 20,
    cellCount: 20,
    snake: [{ x: 10, y: 10 }],
    previousSnake: [{ x: 10, y: 10 }],
    food: { x: 5, y: 5, type: 'apple' },
    direction: 'right',
    score: 0,
    gameOver: false,
    gamePaused: false,
    scoreSubmitted: false,
    scoreSubmissionInProgress: false,
    // Generated exactly once when a run starts and sent with its score. It
    // remains stable across click/retry attempts so the API can make score
    // submission idempotent.
    gameRunId: null,
    inGame: false,
    // Incremented whenever a run begins or is abandoned. Animation frames
    // capture this value so an old loop can never restart after a menu return.
    gameSessionId: 0,
    directionQueue: [],
    lastTickTime: 0,
    foodSpawnTime: 0,
    nextBlinkTime: 0,
    blinkStartTime: -Infinity,

    // Music volume is one of: 0 (Off), 0.25 (Low), 0.55 (Medium), 0.85 (High).
    // `musicMuted` remains for compatibility with existing game/audio checks.
    musicVolume: 0.25,
    musicMuted: false,
    effectsVolume: 0.55,
    effectsMuted: false,
    nokiaMode: false,
    vibrationEnabled: true,

    // True/false once initOfflineDetection() runs (see offline.js) - starts
    // as true so nothing is prematurely blocked before that init call.
    isOnline: true,

    googleIdToken: null,
    googleDisplayName: null,

    // Cached leaderboard data is grouped by period and page (1–3). Keeping
    // each page separate avoids overwriting page one when a player browses.
    cachedScoresByPeriod: { alltime: { 1: [] }, weekly: { 1: [] } },
    activePeriod: { highScoreList: 'alltime', gameOverHighScoreList: 'alltime' },
    activeLeaderboardPage: { highScoreList: 1, gameOverHighScoreList: 1 },
    leaderboardTotalPages: { classic: { alltime: 1, weekly: 1 }, levels: { alltime: 1, weekly: 1 } },

    // Active "digestion wave" animations - each is { color, startTime }. A wave's
    // travel position through the snake's body is computed purely from elapsed
    // time, so it stays smooth regardless of the game tick rate.
    digestionWaves: [],

    // --- Levels Mode state ---
    gameMode: 'classic', // 'classic' | 'levels'
    level: 1,
    fruitsEatenThisLevel: 0,
    tickInterval: 1000 / 12,
    // Cumulative permanent speed penalty (ms), added on top of the level's
    // base tick interval. Grows from the "Slow" power-up and from dying, and
    // never decreases for the rest of the run.
    permanentSlowdown: 0,
    obstacles: [], // array of { x, y }
    // Ghost preview of the NEXT level's obstacle layout, shown starting one
    // fruit before the level actually advances so new walls never just
    // "pop up" with no warning. Empty when there's nothing to preview.
    upcomingObstacles: [],
    lives: 3,
    nextExtraLifeAt: 30, // score threshold at which the next extra life is awarded
    nextExtraLifeIncrement: 30, // how much the threshold increases by each time (grows by EXTRA_LIFE_INCREMENT_STEP)

    // Active power-ups: spawned pickup on the board, and currently-applied effects.
    activePowerup: null, // { type, x, y, spawnTime }
    lastPowerupSpawnAttempt: 0,
    effects: {
        multiplierUntil: 0,
        multiplierStacks: 0, // 0 = no multiplier active; 1 = x2, 2 = x3, etc.
        invincibleUntil: 0
    },

    cachedLevelsScoresByPeriod: { alltime: { 1: [] }, weekly: { 1: [] } },
    activeLevelsPeriod: { levelsHighScoreList: 'alltime', levelsGameOverHighScoreList: 'alltime' },
    activeLevelsLeaderboardPage: { levelsHighScoreList: 1, levelsGameOverHighScoreList: 1 }
};
