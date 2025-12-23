window.onload = function() {
// Création de la partie
const game = new Chess();
let board = null;
let waitingQueue = [];
let players = {
  white: null,
  black: null
};
let myName = null;
let myColor = null;
let currentGameId = null;
let syncing = false;
let gameReady = false;

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
db.ref('games').on('child_added', snapshot => {
  const gameId = snapshot.key;
  const game = snapshot.val();

  if (game.white === myName || game.black === myName) {
    currentGameId = gameId;

    myColor = (game.white === myName) ? 'w' : 'b';

    players.white = { name: game.white };
    players.black = { name: game.black };

    gameReady = true
    
    game.load(game.fen);
    board.position(game.fen);

    listenToGameUpdates();
    startNewGame();
  }
});

function joinQueue(name) {
  myQueueRef = db.ref('queue').push();
  myQueueRef.set({
    name: name,
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
    if (ids.length < 2) return queue;

    // On prend les 2 premiers
    const id1 = ids[0];
    const id2 = ids[1];

    const p1 = queue[id1].name;
    const p2 = queue[id2].name;

    const gameId = db.ref('games').push().key;

    db.ref(`games/${gameId}`).set({
      white: Math.random() < 0.5 ? p1 : p2,
      black: Math.random() < 0.5 ? p2 : p1,
      fen: 'start'
    });

    // Supprime les joueurs de la file
    delete queue[id1];
    delete queue[id2];

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
  if (syncing) return;

  const move = game.move({
    from: source,
    to: target,
    promotion: 'q'
  });

  if (move === null) return 'snapback';

  // Envoie la position au serveur
  db.ref(`games/${currentGameId}`).update({
    fen: game.fen(),
    turn: game.turn()
  });

  updateStatus();
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



const config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop
};

board = Chessboard('board', config);
updateStatus();
};
