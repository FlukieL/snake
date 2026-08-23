// Central lookup of DOM elements used throughout the app, resolved once at
// module load time (after the document is parsed, since script.js modules
// are loaded with `defer`/`type="module"` which run after DOM parsing).

export const dom = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),

    gameOverScreen: document.getElementById('gameOverScreen'),
    startGameScreen: document.getElementById('startGameScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    finalScore: document.getElementById('finalScore'),
    finalLevel: document.getElementById('finalLevel'),
    finalLevelValue: document.getElementById('finalLevelValue'),
    restartButton: document.getElementById('restartButton'),
    startButton: document.getElementById('startButton'),
    startLevelsButton: document.getElementById('startLevelsButton'),
    highScoreList: document.getElementById('highScoreList'),
    gameOverHighScoreList: document.getElementById('gameOverHighScoreList'),
    levelsHighScoreList: document.getElementById('levelsHighScoreList'),
    levelsGameOverHighScoreList: document.getElementById('levelsGameOverHighScoreList'),
    submitScoreButton: document.getElementById('submitScoreButton'),
    googleSignInContainer: document.getElementById('googleSignInContainer'),
    signedInAsEl: document.getElementById('signedInAs'),
    scoreCounter: document.getElementById('scoreCounter'),
    levelBadge: document.getElementById('levelBadge'),
    scoreboardModeTabs: document.getElementById('scoreboardModeTabs'),

    eatingSound: new Audio('/EatingSound.mp3'),
    gameOverSound: new Audio('/GameOverSound.mp3'),
    gameMusic: new Audio('/SnakeGameMusic.mp3'),

    pauseButton: document.getElementById('pauseButton'),
    mainMenuButton: document.getElementById('mainMenuButton'),

    muteMusicButton: document.getElementById('muteMusicButton'),
    muteEffectsButton: document.getElementById('muteEffectsButton'),
    muteMusicGameOverButton: document.getElementById('muteMusicGameOverButton'),
    muteEffectsGameOverButton: document.getElementById('muteEffectsGameOverButton'),
    muteMusicPauseButton: document.getElementById('muteMusicPauseButton'),
    muteEffectsPauseButton: document.getElementById('muteEffectsPauseButton'),

    nokiaModeButton: document.getElementById('nokiaModeButton'),
    nokiaModePauseButton: document.getElementById('nokiaModePauseButton'),
    nokiaAsciiLogo: document.getElementById('nokiaAsciiLogo')
};
