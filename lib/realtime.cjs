let io;

function setIO(instance) {
  io = instance;
}

function emitRealtime(event, payload) {
  if (io) {
    io.emit(event, payload);
  }
}

module.exports = { setIO, emitRealtime };
