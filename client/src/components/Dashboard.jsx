import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Activity, Target, X } from 'lucide-react'

export default function Dashboard({ onClose, apiUrl, username }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!apiUrl) return

    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token')

        if (!token) {
          setError('Please login again')
          setLoading(false)
          return
        }

        const res = await fetch(`${apiUrl}/api/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        const data = await res.json()

        if (res.ok) {
          setProfile(data)
        } else {
          setError(data.error || 'Failed to load profile')
        }

      } catch (e) {
        console.error(e)
        setError('Cannot connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [apiUrl])

  return (
    <motion.div
      className="round-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="glass-panel"
        style={{ width: '90%', maxWidth: '600px', padding: '2rem', position: 'relative' }}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
        >
          <X size={24} />
        </button>

        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity className="icon-pink" /> Player Dashboard
        </h2>

        {loading ? (
          <p>Loading stats...</p>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : profile ? (
          <div>
            {/* Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--pink-primary)' }}>
                  {profile.xp || 0}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>Total XP</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00d2ff' }}>
                  {profile.wins || 0}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>Wins</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff5555' }}>
                  {profile.losses || 0}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>Losses</div>
              </div>
            </div>

            {/* Match History */}
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
              Match History
            </h3>

            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {profile.matchHistory && profile.matchHistory.length > 0 ? (
                profile.matchHistory.slice().reverse().map((match, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.8rem',
                      background: 'rgba(0,0,0,0.3)',
                      marginBottom: '0.5rem',
                      borderRadius: '8px'
                    }}
                  >
                    <div>
                      <strong>{match.problem}</strong> vs {match.opponent || 'Unknown'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {match.cleanCoder && (
                        <span className="clean-coder-badge" style={{ fontSize: '0.7rem' }}>
                          Clean
                        </span>
                      )}

                      <span style={{
                        color: match.result === 'Win' ? '#00ffaa' : '#ff5555',
                        fontWeight: 'bold'
                      }}>
                        {match.result}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>
                  No matches played yet.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p>Failed to load profile.</p>
        )}
      </motion.div>
    </motion.div>
  )
}