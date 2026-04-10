import { useState, useEffect } from 'react'
import io from 'socket.io-client'
import Home from './components/Home'
import BattleRoom from './components/BattleRoom'
import { AnimatePresence, motion } from 'framer-motion'

const socket = io('http://localhost:3001')

function App() {
  const [roomId, setRoomId] = useState(null)
  const [username, setUsername] = useState('')
  const [playerNum, setPlayerNum] = useState(null)
  const [leaderboard, setLeaderboard] = useState({})

  useEffect(() => {
    socket.on('roomJoined', (data) => {
      setRoomId(data.roomId)
      setPlayerNum(data.playerNum)
    })
    socket.on('leaderboardData', (data) => {
      setLeaderboard(data)
    })
    return () => { 
      socket.off('roomJoined') 
      socket.off('leaderboardData')
    }
  }, [])

  const handleCreateRoom = (name) => {
    setUsername(name)
    socket.emit('createRoom', { username: name })
  }

  const handleJoinRoom = (name, room) => {
    setUsername(name)
    socket.emit('joinRoom', { username: name, roomId: room })
  }

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {!roomId ? (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
          >
            <Home 
              socket={socket}
              onCreateRoom={handleCreateRoom} 
              onJoinRoom={handleJoinRoom} 
              leaderboard={leaderboard} 
              username={username}
              setUsername={setUsername}
            />
          </motion.div>
        ) : (
          <motion.div
            key="battle"
            style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <BattleRoom 
              socket={socket} 
              roomId={roomId} 
              username={username} 
              playerNum={playerNum} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
