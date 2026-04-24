'use strict';

// Daemon simplified — chokidar removed (was causing 100% CPU)
// All monitoring happens inside guardian shell itself
function startDaemon() {
  // No-op — intentionally empty
  // Previously used chokidar to watch ~/.env, ~/.ssh etc.
  // but recursive glob watch on HOME_DIR caused extreme CPU usage
}

module.exports = { startDaemon };