import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post('http://localhost:3000/api/auth/register', { username, email, password })
      login(res.data.token, res.data.user)
      navigate('/')
    } catch (err) {
      setError('登録に失敗しました。既に使われているメールアドレスかもしれません')
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ background: '#1a1a1a', padding: '2rem', borderRadius: '8px', width: '360px' }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>新規登録</h2>
        {error && <p style={{ color: '#ff4444', marginBottom: '1rem' }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="ユーザー名"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333', background: '#0f0f0f', color: '#fff' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333', background: '#0f0f0f', color: '#fff' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333', background: '#0f0f0f', color: '#fff' }}
            />
          </div>
          <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#ff0000', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem' }}>
            登録する
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          既にアカウントをお持ちの方は <Link to="/login" style={{ color: '#ff0000' }}>ログイン</Link>
        </p>
      </div>
    </div>
  )
}

export default Register