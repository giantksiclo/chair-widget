import React, { useState, useEffect, Component } from 'react';
import ChairModeWidget from './components/ChairModeWidget';

// 에러 바운더리
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#141414',
          color: '#fff',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>오류 발생</div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedSettings = await window.electronAPI.getSettings();
        console.log('Settings loaded:', savedSettings);
        setSettings(savedSettings);
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, []);

  if (isLoading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#141414',
        color: '#fff'
      }}>
        로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#141414',
        color: '#fff'
      }}>
        <div>설정 로드 실패: {error}</div>
        <button onClick={() => window.location.reload()}>새로고침</button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ChairModeWidget settings={settings} />
    </ErrorBoundary>
  );
}

export default App;
