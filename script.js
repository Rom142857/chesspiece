window.onload = function() {
// Création de la partie
let game; // objet Chess()
let board;
let players = { white: null, black: null };
let myColor; // 'w' ou 'b'
let currentGameId;
let gameReady = false;
let myName;
const firebaseConfig = {
    apiKey: "AIzaSyDKFmG_xjBxU1XkpOvFlfF1UymqpqpBS6g",
    authDomain: "chesspiece-fc91e.firebaseapp.com",
    databaseURL: "https://chesspiece-fc91e-default-rtdb.firebaseio.com",
    projectId: "chesspiece-fc91e",
    storageBucket: "chesspiece-fc91e.firebasestorage.app",
    messagingSenderId: "150549414858",
    appId: "1:150549414858:web:0e200e0d48d5c9c0f3c533"
  };


firebase.initializeApp(firebaseConfig);
const db = firebase.database();
db.ref(`games/${currentGameId}`).on('value', snapshot => {
  const gameData = snapshot.val();
  if (!gameData) return;

  gameReady = true;

  // ⚠️ Toujours utiliser la variable globale Chess()
  game.load(gameData.fen || 'start');
  board.position(game.fen());

  updateStatus();
});


function joinQueue(name) {
  myName = name;

  const ref = db.ref(`queue/${myUid}`);
  ref.set({
    name: myName,
    joinedAt: Date.now()
  });

  attemptMatchmaking();
}
document.getElementById('joinQueue').addEventListener('click', () => {
  const name = document.getElementById('playerName').value.trim();

  if (!name) {
    alert('Entre un pseudo');
    return;
  }

  // Empêche doublons
  if (waitingQueue.includes(name)) {
    alert('Tu es déjà dans la file');
    return;
  }

  joinQueue(name);
  updateQueueStatus();

  tryPairing();
});

function attemptMatchmaking() {
  const queueRef = db.ref('queue');

  queueRef.transaction(queue => {
    if (!queue) return queue;

    const ids = Object.keys(queue);

    // On enlève notre propre uid des candidats
    const otherIds = ids.filter(id => id !== myUid);

    if (otherIds.length < 1) return queue;

    const opponentId = otherIds[0];
    const opponent = queue[opponentId];
    const me = queue[myUid];

    if (!me || !opponent) return queue;

    const gameId = db.ref('games').push().key;

    const whiteIsMe = Math.random() < 0.5;

    db.ref(`games/${gameId}`).set({
      white: whiteIsMe ? me.name : opponent.name,
      black: whiteIsMe ? opponent.name : me.name,
      fen: 'start'
    });

    // On retire LES DEUX joueurs
    delete queue[myUid];
    delete queue[opponentId];

    return queue;
  });
}


  
function listenToGameUpdates() {
  db.ref(`games/${currentGameId}`).on('value', snapshot => {
    const data = snapshot.val();
    if (!data) return;

    // Évite boucle infinie
    syncing = true;

    game.load(data.fen);
    board.position(data.fen);

    syncing = false;
    updateStatus();
  });
}

function tryPairing() {
  if (waitingQueue.length >= 2) {
    const p1 = waitingQueue.shift();
    const p2 = waitingQueue.shift();

    // Attribution aléatoire des couleurs
    if (Math.random() < 0.5) {
      players.white = { name: p1 };
      players.black = { name: p2 };
    } else {
      players.white = { name: p2 };
      players.black = { name: p1 };
    }

    startNewGame();
  }
}
function updateQueueStatus() {
  const status = document.getElementById('queueStatus');

  if (waitingQueue.length === 0) {
    status.textContent = 'Aucun joueur en attente';
  } else {
    status.textContent =
      `En attente : ${waitingQueue.join(', ')}`;
  }
}

function startNewGame() {
  board.position(game.fen());

  document.getElementById('lobby').style.display = 'none';

  updateStatus();
}

function onDragStart(source, piece) {
  if (game.isGameOver) return false;

  // Empêche de jouer les pièces adverses
  if (
    (myColor === 'w' && piece.startsWith('b')) ||
    (myColor === 'b' && piece.startsWith('w'))
  ) {
    return false;
  }

  // Empêche de jouer hors tour
  if (game.turn() !== myColor) {
    return false;
  }
}


function onDrop(source, target) {
  if (!gameReady) return;
  if (game.turn() !== myColor) return 'snapback';

  const move = game.move({ from: source, to: target, promotion: 'q' });
  if (!move) return 'snapback';

  // Mise à jour de la FEN dans Firebase
  db.ref(`games/${currentGameId}`).update({
    fen: game.fen(),
    turn: game.turn()
  });

  // Si capture, mettre à jour le classement par pièce
  if (move.captured) {
    const capturingPlayer = (myColor === 'w') ? players.white.name : players.black.name;
    const capturedPlayer  = (myColor === 'w') ? players.black.name : players.white.name;

    // move.captured contient le type de pièce capturée : 'p', 'n', 'b', 'r', 'q', 'k'
    handleCapture(capturingPlayer, capturedPlayer, move.captured);
  }

  updateStatus();

  // Si partie terminée, on peut aussi appeler endGame() pour mises à jour supplémentaires
  if (game.isGameOver()) {
    endGame();
  }
}



function updateStatus() {
  if (!gameReady) {
    document.getElementById('status').textContent =
      'En attente d’un adversaire…';
    return;
  }

  let status = '';

  if (game.isCheckmate) {
    const winner =
      game.turn() === 'w'
        ? players.black.name
        : players.white.name;

    status = `Échec et mat ! Victoire de ${winner}`;
  } else if (game.isDraw) {
    status = 'Partie nulle';
  } else {
    const currentPlayer =
      game.turn() === 'w'
        ? players.white.name
        : players.black.name;

    status = `Au tour de ${currentPlayer}`;
  }

  document.getElementById('status').textContent = status;
}

function updatePieceElo(winnerPieces, loserPieces) {
  const newWinnerPieces = {};
  const newLoserPieces  = {};

  for (const piece in winnerPieces) {
    const winnerElo = winnerPieces[piece];
    const loserElo  = loserPieces[piece];

    const gain = loserElo * 0.01;

    newWinnerPieces[piece] = winnerElo + gain;
    newLoserPieces[piece]  = loserElo - gain;
  }

  return { newWinnerPieces, newLoserPieces };
}

function endGame() {
  if (!game.isGameOver()) return;

  let winnerName, loserName;
  let isDraw = false;

  if (game.isCheckmate()) {
    winnerName = (game.turn() === 'w') ? players.black.name : players.white.name;
    loserName  = (game.turn() === 'w') ? players.white.name : players.black.name;
  } else if (game.isDraw()) {
    isDraw = true;
    winnerName = players.white.name; // on traite white et black de manière égale
    loserName  = players.black.name;
  } else {
    return;
  }

  const winnerRef = db.ref(`players/${winnerName}/pieces`);
  const loserRef  = db.ref(`players/${loserName}/pieces`);

  Promise.all([winnerRef.get(), loserRef.get()]).then(([wSnap, lSnap]) => {
    const winnerPieces = wSnap.val();
    const loserPieces  = lSnap.val();

    const { newWinnerPieces, newLoserPieces } = updatePieceElo(winnerPieces, loserPieces, isDraw);

    winnerRef.set(newWinnerPieces);
    loserRef.set(newLoserPieces);

    console.log("Classements Elo par pièce mis à jour à la fin de la partie !");
  }).catch(err => {
    console.error("Erreur mise à jour Elo fin de partie :", err);
  });
}

function updatePieceEloCapture(winnerPieces, loserPieces, piece) {
  const winnerElo = winnerPieces[piece];
  const loserElo  = loserPieces[piece];

  const gain = loserElo * 0.01;

  winnerPieces[piece] = winnerElo + gain;
  loserPieces[piece]  = loserElo - gain;

  return { winnerPieces, loserPieces };
}

function handleCapture(capturingPlayer, capturedPlayer, capturedPiece) {
  const winnerRef = db.ref(`players/${capturingPlayer}/pieces`);
  const loserRef  = db.ref(`players/${capturedPlayer}/pieces`);

  Promise.all([winnerRef.get(), loserRef.get()]).then(([wSnap, lSnap]) => {
    let winnerPieces = wSnap.val();
    let loserPieces  = lSnap.val();

    // Met à jour le classement pour la pièce capturée
    ({ winnerPieces, loserPieces } = updatePieceEloCapture(winnerPieces, loserPieces, capturedPiece));

    // Mettre à jour Firebase
    winnerRef.set(winnerPieces);
    loserRef.set(loserPieces);

    console.log(`Classements mis à jour après la capture de ${capturedPiece} !`);
  }).catch(err => {
    console.error("Erreur mise à jour Elo capture :", err);
  });
}

const config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop
};

board = Chessboard('board', config);
updateStatus();
};
