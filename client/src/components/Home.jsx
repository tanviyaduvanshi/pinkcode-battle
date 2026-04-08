import { useState } from 'react'
import { Sparkles, Swords, UserPlus } from 'lucide-react'
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

export default function Home({ onCreateRoom, onJoinRoom }) {
  const [username, setUsername] = useState('')
  const [roomId, setRoomId] = useState('')
  const [mode, setMode] = useState('select')

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
          <Sparkles className="icon-pink" /> Pink Code Battle <Sparkles className="icon-pink" />
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
        {mode === 'select' && (
          <motion.div 
            key="select"
            className="action-buttons"
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
          >
            <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-primary" onClick={() => setMode('create')}>
              <Swords size={20} /> Create Battle Room
            </motion.button>
            <motion.button variants={item} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-secondary" onClick={() => setMode('join')}>
              <UserPlus size={20} /> Join Existing Room
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
              placeholder="Your Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
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
              placeholder="Your Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
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
    </motion.div>
  )
}
