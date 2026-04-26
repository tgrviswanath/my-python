/**
 * Real-Time Chat Frontend — React + Socket.io
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const API = 'http://localhost:4001';

// ── API helpers ───────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('chat_token');
const apiFetch = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...opts.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app:      { display: 'flex', height: '100vh', fontFamily: 'system-ui,sans-serif', background: '#f1f5f9' },
  sidebar:  { width: 280, background: '#1e293b', color: '#f1f5f9', display: 'flex', flexDirection: 'column' },
  sideHead: { padding: '1.5rem 1rem', borderBottom: '1px solid #334155', fontWeight: 800, fontSize: '1.125rem' },
  roomList: { flex: 1, overflowY: 'auto', padding: '0.5rem' },
  roomItem: { padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chat:     { flex: 1, display: 'flex', flexDirection: 'column' },
  chatHead: { background: '#fff', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  messages: { flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  msgRow:   { display: 'flex', gap: '0.75rem', alignItems: 'flex-start' },
  avatar:   { width: 36, height: 36, borderRadius: '50%', flexShrink: 0 },
  bubble:   { background: '#fff', borderRadius: '0 12px 12px 12px', padding: '8px 12px', maxWidth: '70%', boxShadow: '0 1px 2px rgba(0,0,0,.08)' },
  myBubble: { background: '#2563eb', color: '#fff', borderRadius: '12px 0 12px 12px', marginLeft: 'auto' },
  inputRow: { background: '#fff', padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem' },
  input:    { flex: 1, padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 24, fontSize: '0.9rem', outline: 'none' },
  sendBtn:  { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 24, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' },
  authCard: { background: '#fff', borderRadius: 16, padding: '2rem', width: 360, boxShadow: '0 4px 24px rgba(0,0,0,.1)' },
  authInput:{ width: '100%', padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '1rem', marginBottom: '1rem', boxSizing: 'border-box' },
  authBtn:  { width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' },
  onlineDot:{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', marginRight: 6 },
};

// ── Auth Screen ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await apiFetch(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('chat_token', data.token);
      onAuth(data.user, data.token);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1f5f9' }}>
      <div style={S.authCard}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>💬 Chat App</h2>
        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input style={S.authInput} placeholder="Username" required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          <input style={S.authInput} type="password" placeholder="Password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <button type="submit" style={S.authBtn} disabled={loading}>{loading ? '...' : mode === 'login' ? 'Sign In' : 'Register'}</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
          {mode === 'login' ? "No account? " : "Have account? "}
          <button style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }} onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Chat App ──────────────────────────────────────────────────────────────────
function ChatApp({ user, token, onLogout }) {
  const [socket, setSocket] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typing, setTyping] = useState({});
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Connect socket
  useEffect(() => {
    const s = io(API, { auth: { token }, transports: ['websocket'] });
    s.on('connect',    () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('users:online',  users => setOnlineUsers(users));
    s.on('user:online',   u => setOnlineUsers(prev => [...prev.filter(x => x.id !== u.userId), { id: u.userId, username: u.username, online: true }]));
    s.on('user:offline',  u => setOnlineUsers(prev => prev.map(x => x.id === u.userId ? { ...x, online: false } : x)));
    s.on('room:history',  ({ roomId, messages: msgs }) => setMessages(prev => ({ ...prev, [roomId]: msgs })));
    s.on('message:new',   msg => setMessages(prev => ({ ...prev, [msg.roomId]: [...(prev[msg.roomId] || []), msg] })));
    s.on('typing:start',  ({ roomId, username }) => setTyping(prev => ({ ...prev, [roomId]: [...new Set([...(prev[roomId]||[]), username])] })));
    s.on('typing:stop',   ({ roomId, userId }) => setTyping(prev => ({ ...prev, [roomId]: (prev[roomId]||[]).filter(u => u !== userId) })));
    setSocket(s);
    return () => s.disconnect();
  }, [token]);

  // Load rooms
  useEffect(() => {
    apiFetch('/rooms').then(setRooms);
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeRoom]);

  const joinRoom = useCallback(room => {
    if (activeRoom?.id === room.id) return;
    if (activeRoom) socket?.emit('room:leave', activeRoom.id);
    setActiveRoom(room);
    socket?.emit('room:join', room.id);
  }, [socket, activeRoom]);

  const sendMessage = useCallback(e => {
    e.preventDefault();
    if (!input.trim() || !activeRoom || !socket) return;
    socket.emit('message:send', { roomId: activeRoom.id, content: input.trim() });
    socket.emit('typing:stop', activeRoom.id);
    setInput('');
  }, [input, activeRoom, socket]);

  const handleTyping = useCallback(e => {
    setInput(e.target.value);
    if (!activeRoom || !socket) return;
    socket.emit('typing:start', activeRoom.id);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socket.emit('typing:stop', activeRoom.id), 1500);
  }, [activeRoom, socket]);

  const roomMessages = activeRoom ? (messages[activeRoom.id] || []) : [];
  const roomTyping   = activeRoom ? (typing[activeRoom.id] || []) : [];

  return (
    <div style={S.app}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sideHead}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>💬 Chat</span>
            <span style={{ fontSize: '0.75rem', color: connected ? '#22c55e' : '#ef4444' }}>{connected ? '● Online' : '○ Offline'}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>Hi, {user.username}</div>
        </div>

        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #334155', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rooms</div>
        <div style={S.roomList}>
          {rooms.map(room => (
            <div key={room.id} style={{ ...S.roomItem, background: activeRoom?.id === room.id ? '#2563eb' : 'transparent' }}
              onClick={() => joinRoom(room)}>
              <span># {room.name}</span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{room.memberCount}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #334155', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Online ({onlineUsers.filter(u => u.online).length})</div>
        <div style={{ padding: '0 0.5rem 0.5rem', maxHeight: 150, overflowY: 'auto' }}>
          {onlineUsers.filter(u => u.online).map(u => (
            <div key={u.id} style={{ padding: '6px 12px', fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
              <span style={S.onlineDot} />{u.username}
            </div>
          ))}
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid #334155' }}>
          <button style={{ width: '100%', padding: '8px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }} onClick={onLogout}>Sign Out</button>
        </div>
      </div>

      {/* Chat area */}
      <div style={S.chat}>
        {!activeRoom ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '3rem' }}>💬</div>
            <p>Select a room to start chatting</p>
          </div>
        ) : (
          <>
            <div style={S.chatHead}>
              <span style={{ color: '#6b7280' }}>#</span> {activeRoom.name}
            </div>
            <div style={S.messages}>
              {roomMessages.map(msg => {
                const isMe = msg.userId === user.id;
                return (
                  <div key={msg.id} style={{ ...S.msgRow, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.username}`} alt={msg.username} style={S.avatar} />
                    <div style={{ maxWidth: '70%' }}>
                      {!isMe && <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>{msg.username}</div>}
                      <div style={{ ...S.bubble, ...(isMe ? S.myBubble : {}) }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{msg.content}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '0.7rem', opacity: 0.6, textAlign: 'right' }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {roomTyping.length > 0 && (
                <div style={{ color: '#6b7280', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  {roomTyping.join(', ')} {roomTyping.length === 1 ? 'is' : 'are'} typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <form style={S.inputRow} onSubmit={sendMessage}>
              <input style={S.input} placeholder={`Message #${activeRoom.name}`} value={input} onChange={handleTyping} />
              <button type="submit" style={S.sendBtn} disabled={!input.trim()}>Send</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('chat_token');
    return token ? { token, user: null } : null;
  });

  const handleAuth = (user, token) => setAuth({ user, token });
  const handleLogout = () => { localStorage.removeItem('chat_token'); setAuth(null); };

  if (!auth) return <AuthScreen onAuth={handleAuth} />;
  return <ChatApp user={auth.user || { username: 'User' }} token={auth.token} onLogout={handleLogout} />;
}
