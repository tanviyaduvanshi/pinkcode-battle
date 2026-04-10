import { useState, useEffect } from 'react'
import { Sparkles, Swords, UserPlus, LogIn, KeyRound, Trophy, Activity } from 'lucide-react'
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

export default function Home({ socket, onCreateRoom, onJoinRoom, leaderboard, username, setUsername, onDashboardClick, apiUrl }) {
  const [roomId, setRoomId] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState(username ? 'select' : 'auth')
  const [authError, setAuthError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Auto login if token exists
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token && !username) {
      setIsLoading(true)
      fetch(`${apiUrl}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.username) {
          setUsername(data.username)
          setMode('select')
        }
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false))
    }
  }, [])

  useEffect(() => {
    socket.on('authError', (msg) => setAuthError(msg))
    return () => socket.off('authError')
  }, [socket])

  const handleAuth = async (action) => {
    setIsLoading(true)
    setAuthError('')
    try {
      const res = await fetch(`${apiUrl}/api/auth/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('token', data.token)
        setUsername(data.username)
        setMode('select')
        setPassword('')
      } else {
        setAuthError(data.error || 'Authentication failed')
      }
    } catch (e) {
      setAuthError('Network error. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUsername('')
    setPassword('')
    setMode('auth')
  }

  // Handle leaderboard: object-based from older versions or array-based from MongoDB
  let sortedLeaderboard = []
  if (Array.isArray(leaderboard)) {
    sortedLeaderboard = leaderboard.map(u => [u.username, u.xp])
  } else if (leaderboard) {
    sortedLeaderboard = Object.entries(leaderboard).sort((a, b) => b[1] - a[1])
  }

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
              value={username} onChange={(e) => setUsername(e.target.value)} className="input-field" disabled={isLoading}
            />
            <motion.input
              variants={item} type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" disabled={isLoading}
            />
            <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-primary" onClick={() => handleAuth('login')} disabled={!username || !password || isLoading}>
              <LogIn size={20} /> {isLoading ? 'Authenticating...' : 'Login'}
            </motion.button>
            <motion.button variants={item} className="btn-text" onClick={() => { setMode('register'); setAuthError('') }} disabled={isLoading}>
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
              value={username} onChange={(e) => setUsername(e.target.value)} className="input-field" disabled={isLoading}
            />
            <motion.input
              variants={item} type="password" placeholder="Choose Password"
              value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" disabled={isLoading}
            />
            <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-primary" onClick={() => handleAuth('register')} disabled={!username || !password || isLoading}>
              <KeyRound size={20} /> {isLoading ? 'Creating...' : 'Create Account'}
            </motion.button>
            <motion.button variants={item} className="btn-text" onClick={() => { setMode('auth'); setAuthError('') }} disabled={isLoading}>
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
            <div style={{ color: 'var(--pink-light)', marginBottom: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
              Welcome back, <strong>{username}</strong>!
            </div>
            
            <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-primary" onClick={() => setMode('create')}>
              <Swords size={20} /> Create Battle Room
            </motion.button>
            <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-secondary" onClick={() => setMode('join')}>
              <UserPlus size={20} /> Join Existing Room
            </motion.button>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-secondary" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} onClick={onDashboardClick}>
                <Activity size={20} /> Stats Dashboard
              </motion.button>
              <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-text" style={{ flex: 1, border: '1px solid rgba(255,100,150,0.3)' }} onClick={handleLogout}>
                Logout
              </motion.button>
            </div>
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
