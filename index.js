import { createServer } from "http";
import { Server } from "socket.io";

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const patients = {};

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("join", (role) => {
    socket.join(role);
    console.log(`Socket ${socket.id} joined ${role}`);
    if (role === "staff") {
      console.log("1");
      const allPatients = Object.entries(patients).map(
        ([socketId, patientData]) => ({
          ...patientData,
          id: socketId,
        })
      );
      socket.emit("patient:all", allPatients);
    }
  });

  socket.on("patient:update", (data) => {
    patients[socket.id] = { ...patients[socket.id], ...data };
    io.to("staff").emit("patient:update", {
      id: socket.id,
      ...patients[socket.id],
    });
  });

  socket.on("patient:submit", () => {
    if (patients[socket.id]) {
      patients[socket.id].status = "submitted";
      const patientData = {
        ...patients[socket.id],
        id: socket.id,
      };
      io.to("staff").emit("patient:update", patientData);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
    if (patients[socket.id]) {
      io.to("staff").emit("patient:remove", socket.id);
      delete patients[socket.id];
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () =>
  console.log(`Socket.IO server running at http://localhost:${PORT}`)
);
