import { useState, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { Play, Trophy, Users, Clock, MessageSquare, Send, Shield, LogOut, Download, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import html2canvas from 'html2canvas'

const boilerplate = {
  javascript: '// Write your code here...\nfunction solve(n) {\n  \n}',
  python: '# Write your code here...\ndef solve(n):\n    pass',
  cpp: '// Write your code here...\nint solve(int n) {\n    \n}',
  java: '    // Write your code here...\n    public static int solve(int n) {\n        \n    }'
}

const monacoLang = {
  javascript: 'javascript',
  python: 'python',
  cpp: 'cpp',
  java: 'java'
}

export default function BattleRoom({ socket, roomId, username, playerNum }) {
  const [language, setLanguage] = useState('javascript')
  const [myCode, setMyCode] = useState(boilerplate.javascript)
  const [opponentName, setOpponentName] = useState('Waiting for opponent...')
  const [problem, setProblem] = useState(null)
  const [output, setOutput] = useState('')
  const [round, setRound] = useState(1)
  const [scores, setScores] = useState({})
  
  const [roundOverlay, setRoundOverlay] = useState(null)
  const [finalScore, setFinalScore] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const timerRef = useRef(null)
  
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef(null)
  
  const [testProgress, setTestProgress] = useState({})
  const [hint, setHint] = useState(null)
  const [isFrozen, setIsFrozen] = useState(false)
  const [freezeTime, setFreezeTime] = useState(0)
  const freezeIntervalRef = useRef(null)

  useEffect(() => {
    socket.emit('requestRoomState', { roomId })

    socket.on('roomState', (state) => {
      setProblem(state.problem)
      setRound(state.round)
      if (state.scores) setScores(state.scores)
      if (state.testProgress) setTestProgress(state.testProgress)
      if (playerNum === 1 && state.player2) setOpponentName(state.player2.username)
      else if (playerNum === 2 && state.player1) setOpponentName(state.player1.username)
      if (state.endTime) startTimer(state.endTime)
    })

    socket.on('testProgressUpdate', (progressObj) => {
      setTestProgress(progressObj)
    })

    socket.on('roundWon', (data) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setScores(data.scores)
      setRoundOverlay({ winner: data.winner, round: data.round, isDraw: data.isDraw || false, cleanCoder: data.cleanCoder })
      if (!data.isDraw) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#ff2e93', '#00d2ff', '#ffd700'] })
      }
    })

    socket.on('newRound', (state) => {
      setRoundOverlay(null)
      setHint(null)
      setIsFrozen(false)
      setProblem(state.problem)
      setRound(state.round)
      setScores(state.scores)
      if (state.testProgress) setTestProgress(state.testProgress)
      setMyCode(boilerplate[language])
      setOutput('')
      if (state.endTime) startTimer(state.endTime)
    })

    socket.on('hintDelivered', (data) => {
      setHint(data.hint)
    })

    socket.on('playerFrozen', (data) => {
      if (data.target === username) {
        setIsFrozen(true)
        setFreezeTime(data.duration / 1000)
        if (freezeIntervalRef.current) clearInterval(freezeIntervalRef.current)
        freezeIntervalRef.current = setInterval(() => {
          setFreezeTime(prev => {
            if (prev <= 1) {
              clearInterval(freezeIntervalRef.current)
              setIsFrozen(false)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    })

    socket.on('battleResult', (result) => {
      setOutput(`Execution Result:\n${result.output}\n\nPassed: ${result.passed}`)
    })

    socket.on('opponentJoined', (data) => setOpponentName(data.username))
    socket.on('chatMessage', (msg) => setMessages(prev => [...prev, msg]))
    socket.on('battleOver', (data) => {
      if (timerRef.current) clearInterval(timerRef.current)
      setFinalScore(data)
    })

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (freezeIntervalRef.current) clearInterval(freezeIntervalRef.current)
      socket.off('roomState'); socket.off('roundWon'); socket.off('newRound')
      socket.off('battleResult'); socket.off('opponentJoined')
      socket.off('chatMessage'); socket.off('battleOver'); socket.off('testProgressUpdate')
      socket.off('hintDelivered'); socket.off('playerFrozen')
    }
  }, [socket, playerNum, roomId])

  function startTimer(endTime) {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const remaining = Math.floor((endTime - Date.now()) / 1000)
      if (remaining <= 0) {
        setTimeLeft(0); clearInterval(timerRef.current)
        socket.emit('timeUp', { roomId })
      } else { setTimeLeft(remaining) }
    }, 1000)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleCodeChange = (value) => {
    setMyCode(value)
    socket.emit('codeChange', { roomId, code: value, playerNum })
  }
  const handleSubmit = () => {
    setOutput('Running code...')
    socket.emit('submitCode', { roomId, code: myCode, playerNum, language })
  }
  const sendChat = (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    socket.emit('chatMessage', { roomId, message: chatInput, username })
    setChatInput('')
  }
  const copyRoomId = () => { navigator.clipboard.writeText(roomId); alert('Room ID copied!') }
  const handleLeave = () => { socket.emit('leaveBattle', { roomId }) }
  const requestHint = () => { socket.emit('requestHint', { roomId, username }) }

  const downloadScoreboard = async () => {
    const el = document.getElementById('final-scoreboard-capture')
    if (!el) return
    const canvas = await html2canvas(el, { backgroundColor: '#0f0c1b' })
    const link = document.createElement('a')
    link.download = 'pink-code-battle-result.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
  const formatTime = (seconds) => {
    if (seconds === null) return "Waiting..."
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const scoreEntries = Object.entries(scores)
  const p1 = scoreEntries[0]
  const p2 = scoreEntries[1]

  // Final Scoreboard
  if (finalScore) {
    const entries = Object.entries(finalScore.scores)
    const sorted = entries.sort((a, b) => b[1] - a[1])
    const overallWinner = sorted[0][1] > sorted[1][1] ? sorted[0][0] : sorted[0][1] === sorted[1][1] ? null : sorted[0][0]

    return (
      <div className="app-container">
        <div>
          <motion.div 
            id="final-scoreboard-capture"
            className="scoreboard-modal glass-panel"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <motion.h1 
              className="scoreboard-title"
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Trophy size={36} className="icon-gold" /> Battle Over!
            </motion.h1>
            
            <motion.div 
              className={`overall-winner ${!overallWinner ? 'draw' : ''}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
            >
              {overallWinner ? `${overallWinner} is the Champion!` : "It's a Draw!"}
            </motion.div>

            <div className="score-cards">
              {sorted.map(([name, score], idx) => (
                <motion.div 
                  key={name} 
                  className={`score-card glass-panel ${name === overallWinner ? 'winner-card' : ''}`}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + idx * 0.2 }}
                >
                  <h2>{name}</h2>
                  <motion.span 
                    className="big-score"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8 + idx * 0.2, type: 'spring', stiffness: 300 }}
                  >
                    {score}
                  </motion.span>
                  <span className="score-label">rounds won</span>
                </motion.div>
              ))}
            </div>

            <motion.h3 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
              Round History
            </motion.h3>
            <motion.div 
              className="round-history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
            >
              {finalScore.roundHistory.map((rh, i) => (
                <motion.div 
                  key={i} 
                  className="history-row glass-panel"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 + i * 0.1 }}
                >
                  <span className="round-num">Round {rh.round}</span>
                  <span className="round-problem">{rh.problem}</span>
                  <span className="round-winner-tag">
                    {rh.winner === 'Draw' ? 'Draw' : `${rh.winner} won`}
                    {rh.cleanCoder && <span className="clean-coder-badge">Clean!</span>}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
          
          <motion.div 
            style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          >
            <button className="download-btn" onClick={downloadScoreboard}>
              <Download size={18} /> Download for LinkedIn
            </button>
            <button 
              className="btn-text" style={{ marginTop: '1rem', color: 'var(--text-main)' }}
              onClick={() => window.location.reload()}
            >
              Back to Lobby
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      className="battle-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.header 
        className="battle-header glass-panel"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 15 }}
      >
        <div className="header-info">
          <h2><Trophy className="icon-gold"/> Round {round}</h2>
          <span className="room-id" onClick={copyRoomId} title="Click to copy">
            Room: <strong>{roomId}</strong>
          </span>
        </div>
        
        <div className="score-display">
          {p1 && (
            <motion.span 
              className="score-pill me" 
              key={`p1-${p1[1]}`}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring' }}
            >
              {p1[0]}: {p1[1]}
            </motion.span>
          )}
          <span className="vs">vs</span>
          {p2 && (
            <motion.span 
              className="score-pill opp"
              key={`p2-${p2[1]}`}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring' }}
            >
              {p2[0]}: {p2[1]}
            </motion.span>
          )}
        </div>

        <motion.div 
          className="timer-display"
          animate={timeLeft !== null && timeLeft <= 30 ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <Clock size={20} /> {formatTime(timeLeft)}
        </motion.div>

        <motion.button 
          className="leave-btn" 
          onClick={handleLeave} 
          title="End Battle"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
        >
          <LogOut size={18} /> Leave
        </motion.button>
      </motion.header>

      {/* Round Won Overlay */}
      <AnimatePresence>
        {roundOverlay && (
          <motion.div 
            className="round-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="round-overlay-content glass-panel"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              {roundOverlay.isDraw ? (
                <>
                  <h1>Time's Up!</h1>
                  <p>This round is a Draw</p>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ rotate: -20, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                  >
                    <Trophy size={64} className="icon-gold" />
                  </motion.div>
                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    {roundOverlay.winner} wins Round {roundOverlay.round}!
                    {roundOverlay.cleanCoder && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span className="clean-coder-badge" style={{ fontSize: '1rem', padding: '0.3rem 0.8rem'}}>+ Clean Coder Bonus</span>
                      </div>
                    )}
                  </motion.h2>
                </>
              )}
              <motion.p 
                className="next-round-text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                Next round starting...
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="middle-layout">
        <motion.div 
          className="main-battle"
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <motion.div 
            className="problem-panel glass-panel"
            key={`problem-${round}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h3>Question: {problem?.title || 'Loading...'}</h3>
            <p>{problem?.description}</p>
            
            {problem?.hint && !hint && (
              <button className="hint-btn" onClick={requestHint}>
                Get Hint (Freeze your editor for 15s)
              </button>
            )}
            {hint && (
              <div className="hint-text"><strong>Hint:</strong> {hint}</div>
            )}
          </motion.div>

          <div className="editors-wrapper">
            <motion.div 
              className="editor-section glass-panel" 
              style={{flex: 2}}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="editor-header">
                <span className="player-badge">You ({username})</span>
                <select 
                  className="lang-select"
                  value={language} 
                  onChange={(e) => {
                    const newLang = e.target.value
                    setLanguage(newLang)
                    setMyCode(boilerplate[newLang])
                  }}
                  disabled={!!roundOverlay || timeLeft === 0}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                </select>
              </div>
              <Editor
                height="50vh"
                language={monacoLang[language]}
                theme="vs-dark"
                value={myCode}
                onChange={handleCodeChange}
                options={{ readOnly: !!roundOverlay || timeLeft === 0 || isFrozen, minimap: { enabled: false }, fontSize: 14 }}
              />
              {isFrozen && (
                <div className="freeze-overlay">
                  <Lock size={48} color="#ff5555" />
                  <div className="freeze-text">FROZEN</div>
                  <div className="freeze-sub">{freezeTime} seconds left</div>
                </div>
              )}
            </motion.div>

            <motion.div 
              className="opponent-status glass-panel"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>
                <Shield size={48} className="shield-icon" />
              </motion.div>
              <h3>{opponentName}</h3>
              <p className="status-text">Opponent's code is hidden</p>
              
              <div className="live-progress">
                <span className="progress-label">Test Cases Passed</span>
                <span className="progress-val">
                  {testProgress[opponentName] || '0/0'}
                </span>
              </div>

              <div className="coding-indicator">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                <span>Coding...</span>
              </div>
            </motion.div>
          </div>

          <motion.div 
            className="console-section glass-panel"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="console-header">
              <span>Terminal Output</span>
              <motion.button 
                className="glitter-button" 
                onClick={handleSubmit}
                disabled={!!roundOverlay || timeLeft === 0}
                whileHover={{ scale: 1.08, boxShadow: '0 0 25px rgba(255,46,147,0.7)' }}
                whileTap={{ scale: 0.92 }}
              >
                <Play fill="currentColor" size={16} /> SUBMIT CODE
                <div className="stars">
                  <div className="star"></div><div className="star"></div><div className="star"></div>
                </div>
              </motion.button>
            </div>
            <pre className="console-output">{output || 'Waiting for submission...'}</pre>
          </motion.div>
        </motion.div>
        
        {/* Chat */}
        <motion.div 
          className="chat-sidebar glass-panel"
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="chat-header">
            <MessageSquare size={18} /> Arena Chat
          </div>
          <div className="chat-messages">
            <AnimatePresence>
              {messages.map((m, i) => (
                <motion.div 
                  key={i} 
                  className={`chat-msg ${m.username === username ? 'self' : 'other'}`}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="chat-user">{m.username}</span>
                  <p className="chat-text">{m.message}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>
          <form className="chat-form" onSubmit={sendChat}>
            <input 
              type="text" 
              placeholder="Taunt..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <motion.button type="submit" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }}>
              <Send size={16} />
            </motion.button>
          </form>
        </motion.div>
      </div>
    </motion.div>
  )
}
