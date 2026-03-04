import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Stats from './Stats'

function Home() {
  const { token, user, logout } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [savedVideos, setSavedVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('search')

  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchSavedVideos()
  }, [])

  const fetchSavedVideos = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/videos', { headers })
      setSavedVideos(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query) return
    setLoading(true)
    try {
      const res = await axios.get(`http://localhost:3000/api/youtube/search?q=${query}`, { headers })
      setSearchResults(res.data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const handleSave = async (video, status) => {
    try {
      await axios.post('http://localhost:3000/api/videos', { ...video, status }, { headers })
      fetchSavedVideos()
      alert('保存しました！')
    } catch (err) {
      alert('保存に失敗しました')
    }
  }

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:3000/api/videos/${id}`, { headers })
      fetchSavedVideos()
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateStatus = async (id, status) => {
    try {
      await axios.put(`http://localhost:3000/api/videos/${id}`, { status }, { headers })
      fetchSavedVideos()
    } catch (err) {
      console.error(err)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
        <h1 style={{ color: '#ff0000' }}>YouTube Manager</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>{user?.username}</span>
          <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>ログアウト</button>
        </div>
      </div>

      {/* タブ */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {['search', 'saved', 'stats'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '0.5rem 1.5rem', background: activeTab === tab ? '#ff0000' : '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>
            {tab === 'search' ? '検索' : tab === 'saved' ? '保存済み' : '統計'}
          </button>
        ))}
      </div>

      {/* 検索タブ */}
      {activeTab === 'search' && (
        <div>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            <input
              type="text"
              placeholder="動画を検索..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '4px', border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '1rem' }}
            />
            <button type="submit" style={{ padding: '0.75rem 1.5rem', background: '#ff0000', color: '#fff', border: 'none', borderRadius: '4px' }}>
              検索
            </button>
          </form>
          {loading && <p>検索中...</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {searchResults.map(video => (
              <div key={video.youtube_id} style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={video.thumbnail} alt={video.title} style={{ width: '100%' }} />
                <div style={{ padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{video.title}</p>
                  <p style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.75rem' }}>{video.channel_name}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleSave(video, 'watch_later')} style={{ flex: 1, padding: '0.4rem', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.8rem' }}>あとで見る</button>
                    <button onClick={() => handleSave(video, 'favorite')} style={{ flex: 1, padding: '0.4rem', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.8rem' }}>お気に入り</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 保存済みタブ */}
      {activeTab === 'saved' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {savedVideos.map(video => (
              <div key={video.id} style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={video.thumbnail} alt={video.title} style={{ width: '100%' }} />
                <div style={{ padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{video.title}</p>
                  <p style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.75rem' }}>{video.channel_name}</p>
                  <select value={video.status} onChange={e => handleUpdateStatus(video.id, e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', marginBottom: '0.5rem' }}>
                    <option value="watch_later">あとで見る</option>
                    <option value="watched">視聴済み</option>
                    <option value="favorite">お気に入り</option>
                  </select>
                  <button onClick={() => handleDelete(video.id)} style={{ width: '100%', padding: '0.4rem', background: '#ff4444', color: '#fff', border: 'none', borderRadius: '4px' }}>削除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 統計タブ（後で実装） */}
      {activeTab === 'stats' && <Stats />}
    </div>
  )
}

export default Home