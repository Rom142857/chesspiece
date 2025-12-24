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

  updateStatus();
}

// ==================== MISE À JOUR DU STATUS ====================
function updateStatus() {
  board.position(game.fen());
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
      console.log(`Partie commencée contre ${opponentName}`);
    }
  });
}
