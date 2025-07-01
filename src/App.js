import React, { useEffect, useRef, useState } from "react";
import { Chat } from "./components/Chat";
import "./App.css";
import { formatDistanceToNow } from "date-fns";
import { auth, googleProvider, db } from "./firebase-config";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

const APP_ID = "chat-app-a86cb";

function App() {
  const [user, setUser] = useState(localStorage.getItem("chatUsername") || null);
  const [room, setRoom] = useState(localStorage.getItem("chatRoom") || null);
  const [joinTime, setJoinTime] = useState(localStorage.getItem("joinTime") || null);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [availableRooms, setAvailableRooms] = useState([]);

  const nameInputRef = useRef(null);
  const roomInputRef = useRef(null);

  const predefinedRooms = {
    general: { count: 5, description: "General discussions and announcements." },
    fun: { count: 2, description: "For lighthearted conversations and jokes." },
    devs: { count: 10, description: "Discussions for developers and coders." },
    random: { count: 3, description: "Anything goes here!" },
  };

  const roomsMetadataRef = collection(db, "artifacts", APP_ID, "public", "data", "chatRoomsMetadata");

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser.displayName || currentUser.email);
        localStorage.setItem("chatUsername", currentUser.displayName || currentUser.email);

        if (!localStorage.getItem("joinTime")) {
          const time = new Date().toISOString();
          setJoinTime(time);
          localStorage.setItem("joinTime", time);
          setShowWelcomeBack(false);
        } else {
          setJoinTime(localStorage.getItem("joinTime"));
          setShowWelcomeBack(true);
        }
      } else {
        setUser(null);
        setJoinTime(null);
        localStorage.removeItem("chatUsername");
        localStorage.removeItem("joinTime");
        setShowWelcomeBack(false);
      }
    });

    const unsubscribeRooms = onSnapshot(roomsMetadataRef, (snapshot) => {
      const roomsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAvailableRooms(roomsData);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRooms();
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out from Firebase:", error);
    }
    setRoom(null);
    localStorage.removeItem("chatRoom");
  };

  const clearAllData = () => {
    if (window.confirm("Are you sure you want to clear all chat data? This action cannot be undone.")) {
      localStorage.clear();
      signOut(auth).then(() => {
        window.location.reload();
      }).catch((error) => {
        console.error("Error signing out during clear all data:", error);
        window.location.reload();
      });
    }
  };

  const handleSetUser = () => {
    const name = nameInputRef.current.value.trim();
    if (name) {
      setUser(name);
      const time = new Date().toISOString();
      setJoinTime(time);
      localStorage.setItem("chatUsername", name);
      localStorage.setItem("joinTime", time);
      setShowWelcomeBack(false);
    }
  };

  const handleSetRoom = async () => {
    const roomName = roomInputRef.current.value.trim().toLowerCase();
    if (!roomName) return;

    const roomDocRef = doc(roomsMetadataRef, roomName);
    const roomSnap = await getDoc(roomDocRef);

    if (!roomSnap.exists()) {
      await setDoc(roomDocRef, {
        name: roomName,
        description: "A custom room.",
        createdAt: new Date(),
      });
    }

    setRoom(roomName);
    localStorage.setItem("chatRoom", roomName);
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      alert(`Error signing in with Google: ${error.message}`);
    }
  };

  useEffect(() => {
    if (!user && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [user]);

  useEffect(() => {
    if (user && room && joinTime) {
      const timer = setTimeout(() => {
        if (showWelcomeBack) {
          alert(`👋 Welcome back ${user}! You are in the "${room}" room.`);
        } else {
          alert(`👋 Welcome ${user}! You joined the "${room}" room.`);
        }
        setShowWelcomeBack(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, room, showWelcomeBack, joinTime]);

  const allAvailableRooms = { ...predefinedRooms };
  availableRooms.forEach(roomData => {
    if (!allAvailableRooms[roomData.id]) {
      allAvailableRooms[roomData.id] = {
        name: roomData.name || roomData.id,
        description: roomData.description || "Custom room",
        count: roomData.count || 0,
      };
    } else {
      allAvailableRooms[roomData.id] = {
        ...allAvailableRooms[roomData.id],
        ...roomData,
        id: roomData.id,
      };
    }
  });

  if (!user) {
    return (
      <div className="room-container">
        <div className="room-card">
          <label className="room-label">Choose Your Sign-In Method</label>
          <button className="room-button google-signin-button" onClick={signInWithGoogle}>
            Sign In with Google
          </button>
          <div className="divider">OR</div>
          <label className="room-label">Enter Your Name Manually</label>
          <input
            ref={nameInputRef}
            className="room-input"
            onKeyDown={(e) => e.key === "Enter" && handleSetUser()}
            placeholder="Your name..."
          />
          <button className="room-button" onClick={handleSetUser}>Join as Guest</button>
          <p className="room-note">Your name will be visible to others in chat.</p>
          <button className="theme-toggle-button" onClick={toggleTheme}>
            Switch to {theme === "light" ? "Dark" : "Light"} Mode
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="room-container">
        <div className="room-card">
          <label className="room-label">Enter Custom Room Name:</label>
          <input
            ref={roomInputRef}
            className="room-input"
            onKeyDown={(e) => e.key === "Enter" && handleSetRoom()}
            placeholder="Type a new or existing room name..."
          />
          <button className="room-button" onClick={handleSetRoom}>Enter Chat</button>

          <div className="room-options">
            <label className="room-label">Or choose an existing room:</label>
            <select
              className="room-select"
              onChange={(e) => {
                setRoom(e.target.value);
                localStorage.setItem("chatRoom", e.target.value);
              }}
              value=""
            >
              <option value="" disabled>Select a room</option>
              {Object.entries(allAvailableRooms)
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                .map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.name || key} ({value.count} users) - {value.description}
                  </option>
                ))}
            </select>
          </div>

          <div className="sign-out-buttons">
            <button className="action-button" onClick={logOut}>Back / Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="chat-header">
        <p>
          Logged in as <strong>{user}</strong> | Room: <strong>{room}</strong>{" "}
          ({allAvailableRooms[room] ? allAvailableRooms[room].count : 'N/A'} users)
          <br />
          Joined{" "}
          {joinTime && (
            <span style={{ color: "var(--text-color-secondary)" }}>
              {formatDistanceToNow(new Date(joinTime), { addSuffix: true })}
            </span>
          )}
        </p>
      </div>

      <Chat room={room} user={user} />

      <div className="chat-actions">
        <button className="action-button" onClick={logOut}>Leave Room / Sign Out</button>
        <button className="action-button clear-data-button" onClick={clearAllData}>
          Clear All Data
        </button>
      </div>
      <footer className="footer">
        Developed by Danish K · <span className="footer-url">dalsc2.web.app</span>
      </footer>

    </>
  );
}

export default App;
