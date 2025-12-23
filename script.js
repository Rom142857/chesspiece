window.onload = function() {
// Création de la partie
const game = new Chess();
let board = null;

function onDragStart(source, piece) {
  // Empêche de déplacer si la partie est finie
  if (game.isGameOver()) return false;

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

  if (game.isCheckmate()) {
    status = 'Échec et mat !';
  } else if (game.isDraw()) {
    status = 'Partie nulle';
  } else {
    status = `Au tour des ${game.turn() === 'w' ? 'Blancs' : 'Noirs'}`;
    if (game.isCheck()) {
      status += ' — Échec !';
    }
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
