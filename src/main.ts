// Keep the established farming simulation available without mixing its save or controls
// with the survivor slice. The existing Vite/Pages entry point stays the same.
if (window.location.hash === '#farm') {
  void import('./farming');
} else {
  void import('./survival/GameScene');
}
