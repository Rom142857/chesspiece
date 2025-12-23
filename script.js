// ==================== VARIABLES GLOBALES ====================
let game = new Chess();
let board;
let players = { white: null, black: null };
let myColor;
let currentGameId;
let gameReady = false;
let myName = prompt("Entrez votre pseudo :");

// ==================== INITIALISATION ÉCHIQUIER ====================
board = Chessboard('board', {
  draggable: true,
  position: 'start',
  onDrop: onDrop
});

// ==================== FONCTION ONDROP ====================
function onDrop(source, target) {
  if (!gameReady) return;
  if (game.turn() !== myColor) return 'snapback';

  const move = game.move({ from: source, to: target, promotion: 'q' });
  if (!move) return 'snapback';

  // Mise à jour Firebase
  db.ref(`games/${currentGameId}`).update({
    fen: game.fen(),
    turn: game.turn()
  });

  // Capture : mise à jour Elo pièce par pièce
  if (move.captured) {
    const capturingPlayer = (myColor === 'w') ? players.white.name : players.black.name;
    const capturedPlayer  = (myColor === 'w') ? players.black.name : players.white.name;

    handleCapture(capturingPlayer, capturedPlayer, move.captured);
  }

  updateStatus();

  if (game.isGameOver) {
    endGame();
  }
}

// ==================== MISE À JOUR DU STATUS ====================
function updateStatus() {
  board.position(game.fen());
}

// ==================== FONCTIONS ELO ====================
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

    ({ winnerPieces, loserPieces } = updatePieceEloCapture(winnerPieces, loserPieces, capturedPiece));

    winnerRef.set(winnerPieces);
    loserRef.set(loserPieces);

    console.log(`Classements mis à jour après la capture de ${capturedPiece} !`);
  }).catch(err => {
    console.error("Erreur mise à jour Elo capture :", err);
  });
}

function endGame() {
  if (!game.isGameOver) return;

  let winnerName, loserName;
  let isDraw = false;

  if (game.isCheckmate) {
    winnerName = (game.turn() === 'w') ? players.black.name : players.white.name;
    loserName  = (game.turn() === 'w') ? players.white.name : players.black.name;
  } else if (game.isDraw) {
    isDraw = true;
    winnerName = players.white.name;
    loserName  = players.black.name;
  } else return;

  const winnerRef = db.ref(`players/${winnerName}/pieces`);
  const loserRef  = db.ref(`players/${loserName}/pieces`);

  Promise.all([winnerRef.get(), loserRef.get()]).then(([wSnap, lSnap]) => {
    const winnerPieces = wSnap.val();
    const loserPieces  = lSnap.val();

    const { newWinnerPieces, newLoserPieces } = updatePieceEloCaptureForEnd(winnerPieces, loserPieces, isDraw);

    winnerRef.set(newWinnerPieces);
    loserRef.set(newLoserPieces);

    console.log("Classements Elo mis à jour à la fin de la partie !");
  });
}

function updatePieceEloCaptureForEnd(winnerPieces, loserPieces, isDraw) {
  const newWinnerPieces = {};
  const newLoserPieces = {};

  for (const piece in winnerPieces) {
    const winnerElo = winnerPieces[piece];
    const loserElo  = loserPieces[piece];

    if (isDraw) {
      newWinnerPieces[piece] = winnerElo * 0.995 + loserElo * 0.005;
      newLoserPieces[piece]  = loserElo  * 0.995 + winnerElo * 0.005;
    } else {
      const gain = loserElo * 0.01;
      newWinnerPieces[piece] = winnerElo + gain;
      newLoserPieces[piece]  = loserElo - gain;
    }
  }

  return { newWinnerPieces, newLoserPieces };
}

// ==================== AFFICHAGE EN DIRECT ====================
function displayPieceElo(playerColor, pieces) {
  for (const piece in pieces) {
    const id = `${playerColor}-${piece}`;
    const el = document.getElementById(id);
    if (el) el.textContent = Math.round(pieces[piece]);
  }
}

// Synchronisation Firebase
function listenEloUpdates() {
  if (!players.white || !players.black) return;

  db.ref(`players/${players.white.name}/pieces`).on('value', snapshot => {
    const pieces = snapshot.val();
    if (pieces) displayPieceElo('white', pieces);
  });

  db.ref(`players/${players.black.name}/pieces`).on('value', snapshot => {
    const pieces = snapshot.val();
    if (pieces) displayPieceElo('black', pieces);
  });
}

// ==================== GESTION FILE D'ATTENTE ====================
function clearCurrentGame(playerName) {
  const gamesRef = db.ref('games');

  gamesRef.once('value').then(snapshot => {
    snapshot.forEach(childSnap => {
      const game = childSnap.val();
      const gameId = childSnap.key;

      if (game.white === playerName || game.black === playerName) {
        db.ref(`games/${gameId}`).remove()
          .then(() => console.log(`Partie ${gameId} supprimée pour ${playerName}`))
          .catch(err => console.error("Erreur suppression partie :", err));
      }
    });
  });
}

function joinQueue() {
  clearCurrentGame(myName); // supprime parties existantes

  const queueRef = db.ref('queue');
  queueRef.push({ name: myName });

  // Écoute de l'appairage
  queueRef.on('child_added', snapshot => {
    const opponentName = snapshot.val().name;
    if (opponentName !== myName) {
      // Crée la partie
      const gameRef = db.ref('games').push({
        white: myName,
        black: opponentName,
        fen: 'start',
        turn: 'w'
      });

      currentGameId = gameRef.key;
      players.white = { name: myName };
      players.black = { name: opponentName };
      myColor = 'w';

      gameReady = true;
      listenEloUpdates();
      console.log(`Partie commencée contre ${opponentName}`);
    }
  });
}
