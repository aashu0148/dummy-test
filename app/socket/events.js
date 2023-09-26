const SocketEvents = (io, stockData) => {
  const sendSocketError = (socket, message) => {
    socket.emit("error", message);
  };

  io.on("connection", (socket) => {
    socket.on("join", async (obj) => {
      if (!obj?.userId) return sendSocketError(socket, "userId required");

      socket.join("trades");

      socket.emit("joined");
      socket.emit("stock-data", stockData);
    });

    socket.on("leave", (socket) => {
      socket.leave("trades");

      socket.emit("left");
    });
  });
};

export default SocketEvents;
