import { useState, useEffect } from 'react'
import { Sparkles, Swords, UserPlus, LogIn, KeyRound } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export default function Home({ socket, onCreateRoom, onJoinRoom, leaderboard, username, setUsername }) {
  const [roomId, setRoomId] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState(username ? 'select' : 'auth')
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    socket.on('authSuccess', (data) => {
      setUsername(data.username)
      setMode('select')
      setAuthError('')
    })
    socket.on('authError', (msg) => {
      setAuthError(msg)
    })
    return () => {
      socket.off('authSuccess')
      socket.off('authError')
    }
  }, [socket, setUsername])

  const handleLogin = () => { socket.emit('login', { username, password }) }
  const handleRegister = () => { socket.emit('register', { username, password }) }

  // Sort leaderboard by XP
  const sortedLeaderboard = leaderboard 
    ? Object.entries(leaderboard).sort((a, b) => b[1] - a[1]) 
    : []

  return (
    <motion.div 
      className="lobby-container glass-panel"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="lobby-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <h1>
          <Sparkles className="icon-pink" /> CuddleCode <Sparkles className="icon-pink" />
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Real-time coding showdowns
        </motion.p>
      </motion.div>

      <AnimatePresence mode="wait">
        {mode === 'auth' && (
          <motion.div 
            key="auth"
            className="form-group"
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
          >
            {authError && <div style={{ color: '#ff5555', fontSize: '0.9rem' }}>{authError}</div>}
            <motion.input
              variants={item} type="text" placeholder="Username"
              value={username} onChange={(e) => setUsername(e.target.value)} className="input-field"
            />
            <motion.input
              variants={item} type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} className="input-field"
            />
            <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-primary" onClick={handleLogin} disabled={!username || !password}>
              <LogIn size={20} /> Login
            </motion.button>
            <motion.button variants={item} className="btn-text" onClick={() => { setMode('register'); setAuthError('') }}>
              Don't have an account? Register
            </motion.button>
          </motion.div>
        )}

        {mode === 'register' && (
          <motion.div 
            key="register"
            className="form-group"
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
          >
            {authError && <div style={{ color: '#ff5555', fontSize: '0.9rem' }}>{authError}</div>}
            <motion.input
              variants={item} type="text" placeholder="Choose Username"
              value={username} onChange={(e) => setUsername(e.target.value)} className="input-field"
            />
            <motion.input
              variants={item} type="password" placeholder="Choose Password"
              value={password} onChange={(e) => setPassword(e.target.value)} className="input-field"
            />
            <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-primary" onClick={handleRegister} disabled={!username || !password}>
              <KeyRound size={20} /> Create Account
            </motion.button>
            <motion.button variants={item} className="btn-text" onClick={() => { setMode('auth'); setAuthError('') }}>
              Already have an account? Login
            </motion.button>
          </motion.div>
        )}

        {mode === 'select' && (
          <motion.div 
            key="select"
            className="action-buttons"
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
          >
            <div style={{ color: 'var(--pink-light)', marginBottom: '1rem' }}>Welcome back, <strong>{username}</strong>!</div>
            <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-primary" onClick={() => setMode('create')}>
              <Swords size={20} /> Create Battle Room
            </motion.button>
            <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-secondary" onClick={() => setMode('join')}>
              <UserPlus size={20} /> Join Existing Room
            </motion.button>
            <motion.button variants={item} className="btn-text" onClick={() => { setUsername(''); setPassword(''); setMode('auth') }}>
              Logout
            </motion.button>
          </motion.div>
        )}

        {mode === 'create' && (
          <motion.div 
            key="create"
            className="form-group"
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
          >
            <motion.input
              variants={item}
              type="text"
              value={username}
              disabled
              className="input-field"
              style={{ opacity: 0.5 }}
            />
            <motion.button
              variants={item}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary"
              onClick={() => username && onCreateRoom(username)}
              disabled={!username}
            >
              Start Battle!
            </motion.button>
            <motion.button variants={item} className="btn-text" onClick={() => setMode('select')}>Back</motion.button>
          </motion.div>
        )}

        {mode === 'join' && (
          <motion.div 
            key="join"
            className="form-group"
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
          >
            <motion.input
              variants={item}
              type="text"
              value={username}
              disabled
              className="input-field"
              style={{ opacity: 0.5 }}
            />
            <motion.input
              variants={item}
              type="text"
              placeholder="Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="input-field"
            />
            <motion.button
              variants={item}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn-secondary"
              onClick={() => username && roomId && onJoinRoom(username, roomId)}
              disabled={!username || !roomId}
            >
              Enter Arena
            </motion.button>
            <motion.button variants={item} className="btn-text" onClick={() => setMode('select')}>Back</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {sortedLeaderboard.length > 0 && mode === 'select' && (
        <motion.div 
          className="leaderboard-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h3><Trophy size={18} className="icon-gold"/> Hall of Fame</h3>
          {sortedLeaderboard.slice(0, 5).map(([user, xp], i) => (
            <div key={user} className="leaderboard-row">
              <span className="lb-user">#{i + 1} {user}</span>
              <span className="lb-xp">{xp} XP</span>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
