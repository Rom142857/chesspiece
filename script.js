window.onload = function() {
// Création de la partie
const game = new Chess();
let board = null;

let players = {
  white: null,
  black: null
};
document.getElementById('startGame').addEventListener('click', () => {
  const whiteName = document.getElementById('playerWhite').value.trim();
  const blackName = document.getElementById('playerBlack').value.trim();

  if (!whiteName || !blackName) {
    alert('Entre deux noms de joueurs');
    return;
  }

  players.white = {
    name: whiteName
  };

  players.black = {
    name: blackName
  };

  startNewGame();
});
function startNewGame() {
  game.reset();
  board.position('start');

  document.getElementById('players').style.display = 'none';

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
