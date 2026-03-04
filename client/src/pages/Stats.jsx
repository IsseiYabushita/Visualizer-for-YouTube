import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#ff0000', '#ff6b6b', '#ffa500', '#ffff00', '#00ff00']

function Stats() {
  const { token } = useAuth()
  const [videos, setVideos] = useState([])

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await axios.get('http://localhost:3000/api/videos', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setVideos(res.data)
      } catch (err) {
        console.error(err)
      }
    }
    fetchVideos()
  }, [])

  // ステータス別集計
  const statusData = [
    { name: 'あとで見る', value: videos.filter(v => v.status === 'watch_later').length },
    { name: '視聴済み', value: videos.filter(v => v.status === 'watched').length },
    { name: 'お気に入り', value: videos.filter(v => v.status === 'favorite').length },
  ].filter(d => d.value > 0)

  // チャンネル別集計（上位5件）
  const channelMap = {}
  videos.forEach(v => {
    channelMap[v.channel_name] = (channelMap[v.channel_name] || 0) + 1
  })
  const channelData = Object.entries(channelMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ marginBottom: '2rem' }}>統計</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff0000' }}>{videos.length}</p>
          <p style={{ color: '#aaa' }}>保存済み動画</p>
        </div>
        <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff0000' }}>{videos.filter(v => v.status === 'watched').length}</p>
          <p style={{ color: '#aaa' }}>視聴済み</p>
        </div>
        <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff0000' }}>{videos.filter(v => v.status === 'favorite').length}</p>
          <p style={{ color: '#aaa' }}>お気に入り</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* ステータス別円グラフ */}
        <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '1rem' }}>ステータス別</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ color: '#aaa' }}>データがありません</p>}
        </div>

        {/* チャンネル別棒グラフ */}
        <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '1rem' }}>チャンネル別（上位5件）</h3>
          {channelData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={channelData}>
                <XAxis dataKey="name" tick={{ fill: '#aaa', fontSize: 10 }} />
                <YAxis tick={{ fill: '#aaa' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ff0000" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: '#aaa' }}>データがありません</p>}
        </div>
      </div>
    </div>
  )
}

export default Stats