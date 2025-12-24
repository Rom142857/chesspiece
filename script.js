// ==================== VARIABLES GLOBALES ====================
let game = new Chess();
let board;
let players = { white: null, black: null };
let myColor;
let currentGameId;
let currentGameRef = null;
let gameReady = false;
let myName = prompt("Entrez votre pseudo :");

const firebaseConfig = {
    apiKey: "AIzaSyDKFmG_xjBxU1XkpOvFlfF1UymqpqpBS6g",
    authDomain: "chesspiece-fc91e.firebaseapp.com",
    databaseURL: "https://chesspiece-fc91e-default-rtdb.firebaseio.com",
    projectId: "chesspiece-fc91e",
    storageBucket: "chesspiece-fc91e.firebasestorage.app",
    messagingSenderId: "150549414858",
    appId: "1:150549414858:web:0e200e0d48d5c9c0f3c533"
  };

 // Initialize Firebase
const db = initializeApp(firebaseConfig);

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

// ==================== CALLBACK FIREBASE : ÉCOUTE DE LA PARTIE ====================
function listenToGame(gameId) {
  // Detach previous listener si existant
  if (currentGameRef) {
    try {
      currentGameRef.off();
    } catch (e) {
      console.warn("Erreur lors de la suppression de l'ancien listener :", e);
    }
    currentGameRef = null;
  }

  if (!gameId) return;

  currentGameRef = db.ref(`games/${gameId}`);
  currentGameRef.on('value', snapshot => {
    const data = snapshot.val();

    // Si la partie a été supprimée côté serveur
    if (!data) {
      console.log(`La partie ${gameId} a été supprimée côté serveur.`);
      gameReady = false;
      currentGameId = null;

      // Remise à zéro locale
      try {
        game.reset();
      } catch (e) { /* ignore */ }

      board.position('start');
      return;
    }

    // Mise à jour des joueurs et du tour (facultatif)
    if (data.white) players.white = { name: data.white };
    if (data.black) players.black = { name: data.black };

    // Mise à jour de la position via la FEN si différente
    if (typeof data.fen === 'string') {
      const remoteFen = data.fen === 'start' ? new Chess().fen() : data.fen; // normalize 'start'
      if (remoteFen !== game.fen()) {
        // Tenter de charger la FEN distante
        const loaded = game.load(remoteFen);
        if (!loaded) {
          console.warn("Impossible de charger la FEN distante :", remoteFen, "- remise à l'état par défaut.");
          game.reset();
          // si remoteFen n'est pas valide, on garde la position par défaut
        }
        board.position(game.fen());
        updateStatus();
      }
    }

    // Activation du jeu si nécessaire
    gameReady = true;
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

      // Démarre l'écoute Firebase pour cette partie
      listenToGame(currentGameId);

      gameReady = true;
      console.log(`Partie commencée contre ${opponentName}`);
    }
  });
}
