// Central lookup of DOM elements used throughout the app, resolved after parsing.

export const dom = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),

    gameHud: document.getElementById('gameHud'),
    toast: document.getElementById('toast'),
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
    livesBadge: document.getElementById('livesBadge'),
    multiplierBadge: document.getElementById('multiplierBadge'),
    scoreboardModeTabs: document.getElementById('scoreboardModeTabs'),
    nokiaAsciiLogo: document.getElementById('nokiaAsciiLogo'),

    powerupInfoButton: document.getElementById('powerupInfoButton'),
    powerupInfoModal: document.getElementById('powerupInfoModal'),
    powerupInfoCloseButton: document.getElementById('powerupInfoCloseButton'),
    powerupInfoList: document.getElementById('powerupInfoList'),

    settingsButton: document.getElementById('settingsButton'),
    settingsPauseButton: document.getElementById('settingsPauseButton'),
    settingsGameOverButton: document.getElementById('settingsGameOverButton'),
    settingsModal: document.getElementById('settingsModal'),
    settingsCloseButton: document.getElementById('settingsCloseButton'),
    confirmExitModal: document.getElementById('confirmExitModal'),
    confirmExitButton: document.getElementById('confirmExitButton'),
    cancelExitButton: document.getElementById('cancelExitButton'),

    eatingSound: new Audio('/EatingSound.mp3'),
    gameOverSound: new Audio('/GameOverSound.mp3'),
    gameMusic: new Audio('/SnakeGameMusic.mp3'),

    pauseButton: document.getElementById('pauseButton'),
    resumeButton: document.getElementById('resumeButton'),
    mainMenuButton: document.getElementById('mainMenuButton'),
    mainMenuPauseButton: document.getElementById('mainMenuPauseButton'),

    muteMusicButton: document.getElementById('muteMusicButton'),
    muteEffectsButton: document.getElementById('muteEffectsButton'),
    nokiaModeButton: document.getElementById('nokiaModeButton'),

    offlineBanner: document.getElementById('offlineBanner'),
    installPwaButton: document.getElementById('installPwaButton')
};
