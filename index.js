import { createServer } from "http";
import { Server } from "socket.io";

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const patients = {};
const patientTimeouts = {};

const INACTIVITY_TIMEOUT = 5000; // 5 seconds

function startInactivityTimer(socketId) {
  clearTimeout(patientTimeouts[socketId]);
  patientTimeouts[socketId] = setTimeout(() => {
    if (patients[socketId] && patients[socketId].status !== "submitted") {
      patients[socketId].status = "inactive";
      io.to("staff").emit("patient:update", {
        id: socketId,
        ...patients[socketId],
      });
    }
  }, INACTIVITY_TIMEOUT);
}

io.on("connection", (socket) => {
  console.log("New client connected", socket.id);

  socket.on("join", (role) => {
    socket.join(role);
    if (role === "staff") {
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
    if (
      patients[socket.id].status === "submitted" ||
      patients[socket.id].status === "inactive" ||
      !patients[socket.id].status
    ) {
      patients[socket.id].status = "active";
    }
    startInactivityTimer(socket.id);
    io.to("staff").emit("patient:update", {
      id: socket.id,
      ...patients[socket.id],
    });
  });

  socket.on("patient:submit", () => {
    if (patients[socket.id]) {
      clearTimeout(patientTimeouts[socket.id]);
      patients[socket.id].status = "submitted";
      const patientData = {
        ...patients[socket.id],
        id: socket.id,
      };
      io.to("staff").emit("patient:update", patientData);
    }
  });

  socket.on("patient:delete", (id) => {
    if (patients[id]) {
      delete patients[id];
      io.to("staff").emit("patient:remove", id);
    } else {
    }
  });

  socket.on("staff:update", ({ id, data }) => {
    if (!id || !patients[id]) return;
    patients[id] = { ...patients[id], ...data };
    io.to("staff").emit("patient:update", {
      id,
      ...patients[id],
    });
    io.to(id).emit("patient:sync", patients[id]);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
    clearTimeout(patientTimeouts[socket.id]);
    if (patients[socket.id]) {
      if (patients[socket.id].status !== "submitted") {
        patients[socket.id].status = "inactive";
      }
      const patientData = {
        ...patients[socket.id],
        id: socket.id,
      };
      io.to("staff").emit("patient:update", patientData);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () =>
  console.log(`Socket.IO server running at http://localhost:${PORT}`)
);
