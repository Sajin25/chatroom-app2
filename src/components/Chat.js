import React, { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  doc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase-config";
import { formatDistanceToNow, format } from "date-fns";
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { auth } from "../firebase-config";

import "../App.css";

const Chat = ({ room, user }) => {
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeTypers, setActiveTypers] = useState({});
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const messagesRef = collection(db, "chatRooms", room, "messages");
  const typingStatusRef = collection(db, "chatRooms", room, "typingStatus");
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    const queryMessages = query(messagesRef, orderBy("createdAt"));
    const unsubscribe = onSnapshot(queryMessages, (snapshot) => {
      const loadedMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(loadedMessages);
    });
    return () => unsubscribe();
  }, [room, messagesRef]);

  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribeTyping = onSnapshot(typingStatusRef, (snapshot) => {
      const typers = {};
      snapshot.docs.forEach((doc) => {
        const { user: typerName, lastTyped, uid } = doc.data();
        if (uid !== currentUserId && Date.now() - lastTyped < 2000) {
          typers[uid] = typerName;
        }
      });
      setActiveTypers(typers);
    });

    return () => {
      const cleanupTypingStatus = async () => {
        const userTypingDocRef = doc(typingStatusRef, currentUserId);
        await setDoc(userTypingDocRef, {
          user: user,
          lastTyped: 0,
          uid: currentUserId
        }, { merge: true });
      };
      cleanupTypingStatus();
      unsubscribeTyping();
    };
  }, [room, currentUserId, user, typingStatusRef]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTypers]);

  const handleNewMessageChange = async (e) => {
    setNewMessage(e.target.value);
    if (!currentUserId) return;

    const userTypingDocRef = doc(typingStatusRef, currentUserId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (e.target.value.trim().length > 0) {
      await setDoc(userTypingDocRef, {
        user: user,
        lastTyped: Date.now(),
        uid: currentUserId
      }, { merge: true });

      typingTimeoutRef.current = setTimeout(async () => {
        await setDoc(userTypingDocRef, {
          user: user,
          lastTyped: 0,
          uid: currentUserId
        }, { merge: true });
      }, 1500);
    } else {
      await setDoc(userTypingDocRef, {
        user: user,
        lastTyped: 0,
        uid: currentUserId
      }, { merge: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;

    await addDoc(messagesRef, {
      text: trimmedMessage,
      createdAt: serverTimestamp(),
      user,
      uid: currentUserId,
      room,
    });

    setNewMessage("");
    setShowEmojiPicker(false);

    if (currentUserId) {
      clearTimeout(typingTimeoutRef.current);
      const userTypingDocRef = doc(typingStatusRef, currentUserId);
      await setDoc(userTypingDocRef, {
        user: user,
        lastTyped: 0,
        uid: currentUserId
      }, { merge: true });
    }
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage((prev) => prev + emoji.native);
  };

  const getUserAvatarColor = (username) => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = "#";
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff;
      color += ("00" + value.toString(16)).substr(-2);
    }
    return color;
  };

  const handleDeleteMessage = async (messageId, messageCreatedAt, messageUserUid) => {
    if (!messageCreatedAt?.seconds) return;

    const fiveMinutesInMs = 5 * 60 * 1000;
    const messageTime = messageCreatedAt.seconds * 1000;
    const currentTime = Date.now();

    if (currentUserId === messageUserUid && (currentTime - messageTime) <= fiveMinutesInMs) {
      if (window.confirm("Are you sure you want to delete this message?")) {
        try {
          const messageDocRef = doc(messagesRef, messageId);
          await deleteDoc(messageDocRef);
        } catch (error) {
          console.error("Error deleting message:", error);
          alert("Failed to delete message. Please try again.");
        }
      }
    } else {
      alert("You can only delete your own messages within 5 minutes of sending them.");
    }
  };

  const otherTypers = Object.values(activeTypers).filter((typer) => typer !== user);

  return (
    <div className="chat-app">
      <div className="header">
        <h1>Welcome to: {room.toUpperCase()}</h1>
      </div>
      <div className="messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-bubble ${message.user === user ? "own-message" : "other-message"}`}
            title={message.createdAt?.seconds ? `Sent at: ${format(new Date(message.createdAt.seconds * 1000), "MMM dd, yyyy HH:mm")}` : ""}
          >
            <div className="message-meta">
              <span className="user-avatar" style={{ backgroundColor: getUserAvatarColor(message.user) }}>
                {message.user ? message.user[0].toUpperCase() : "U"}
              </span>
              <span className="user">{message.user}</span>
              {message.createdAt?.seconds && (
                <span className="timestamp">
                  {formatDistanceToNow(new Date(message.createdAt.seconds * 1000), { addSuffix: true })}
                </span>
              )}
              {message.user === user && message.createdAt?.seconds && (
                <button
                  className="delete-message-button"
                  onClick={() => handleDeleteMessage(message.id, message.createdAt, message.uid)}
                  disabled={Date.now() - message.createdAt.seconds * 1000 > 5 * 60 * 1000}
                >
                  ✖
                </button>
              )}
            </div>
            <div className="message-text">{message.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {otherTypers.length > 0 && (
        <div className="typing-indicator">
          {otherTypers.join(", ")} {otherTypers.length === 1 ? "is" : "are"} typing...
        </div>
      )}
      {otherTypers.length === 0 && newMessage.trim() && (
        <div className="typing-indicator typing-self">✍️ You are typing...</div>
      )}

      <form onSubmit={handleSubmit} className="new-message-form">
        <input
          className="new-message-input"
          placeholder="Type your message..."
          value={newMessage}
          onChange={handleNewMessageChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="button"
          className="emoji-button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
        >
          😀
        </button>
        <button type="submit" className="send-button">
          Send
        </button>
      </form>

      {showEmojiPicker && (
        <div className="emoji-picker-container">
          <Picker data={data} onEmojiSelect={handleEmojiSelect} />
        </div>
      )}
    </div>
  );
};

export default Chat;
