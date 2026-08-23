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
    NOKIA_PIXEL: '#3a3f2e',
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
    inGame: false,
    directionQueue: [],
    lastTickTime: 0,
    foodSpawnTime: 0,
    nextBlinkTime: 0,
    blinkStartTime: -Infinity,

    musicMuted: false,
    effectsMuted: false,
    nokiaMode: false,

    googleIdToken: null,
    googleDisplayName: null,

    cachedScoresByPeriod: { alltime: [], weekly: [] },
    activePeriod: { highScoreList: 'alltime', gameOverHighScoreList: 'alltime' }
};
