window.onload = function() {
// Création de la partie
const game = new Chess();
let board = null;
let waitingQueue = [];
let players = {
  white: null,
  black: null
};
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

  waitingQueue.push(name);
  updateQueueStatus();

  tryPairing();
});
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
  game.reset();
  board.position('start');

  document.getElementById('lobby').style.display = 'none';

  updateStatus();
}

function onDragStart(source, piece) {
  // Empêche de déplacer si la partie est finie
  if (game.isGameOver) return false;

  // Empêche de jouer les pièces adverses
  if (
    (game.turn() === 'w' && piece.startsWith('b')) ||
    (game.turn() === 'b' && piece.startsWith('w'))
  ) {
    return false;
  }
}

function onDrop(source, target) {
  // Essaie le coup
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q' // promotion automatique en dame
  });

  // Coup illégal → retour
  if (move === null) return 'snapback';

  updateStatus();
}

function updateStatus() {
  let status = '';

  if (game.isCheckmate) {
    const winner = game.turn() === 'w'
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
