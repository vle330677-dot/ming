import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react'; // 确保已安装 motion/react 或 framer-motion
import { WelcomeView } from './views/WelcomeView';
import { LoginView } from './views/LoginView';
import { AgeCheckView } from './views/AgeCheckView';
import { ExtractorView } from './views/ExtractorView';
import { PendingView } from './views/PendingView';
import { GameView } from './views/GameView';
import { AdminView } from './views/AdminView';
import { User } from './types';

export type ViewState = 'WELCOME' | 'LOGIN' | 'AGE_CHECK' | 'EXTRACTOR' | 'PENDING' | 'GAME' | 'ADMIN';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('WELCOME');
  const [userName, setUserName] = useState('');
  const [user, setUser] = useState<User | null>(null);
  
  // ================== 新增：全局反馈系统状态 ==================
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'success' | 'warn' } | null>(null);

  const showToast = (msg: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ msg, type });
    // 3秒后自动关闭
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (userName && currentView === 'PENDING') {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/users/${userName}`);
          const data = await res.json();
          if (data.success && data.user.status === 'approved') {
            setUser(data.user);
            setCurrentView('GAME');
            showToast('身份审核通过，欢迎来到哨向世界！', 'success');
          }
        } catch (error) {
          console.error('Failed to fetch user status', error);
        }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [userName, currentView]);

  // ================== 定时刷新用户信息 (用于同步 HP/金币/位置等) ==================
  useEffect(() => {
    if (user && currentView === 'GAME') {
      const timer = setInterval(async () => {
        try {
          const res = await fetch(`/api/users/${user.name}`);
          const data = await res.json();
          if (data.success) {
            setUser(data.user);
          }
        } catch (e) {
          console.error("Sync failed", e);
        }
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [user?.name, currentView]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans relative overflow-hidden">
      
      {/* ================== 全局 Toast 渲染层 ================== */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-0 left-1/2 z-[10000] px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-white/20 text-sm font-bold flex items-center gap-2
              ${toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 
                toast.type === 'warn' ? 'bg-rose-500/90 text-white' : 
                'bg-slate-900/90 text-white'}`}
          >
            {toast.type === 'success' && '🎉'}
            {toast.type === 'warn' && '⚠️'}
            {toast.type === 'info' && '💡'}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================== 视图渲染逻辑 ================== */}
      {currentView === 'WELCOME' && <WelcomeView onNavigate={setCurrentView} />}
      
      {currentView === 'LOGIN' && (
        <LoginView 
          onNavigate={setCurrentView} 
          setUserName={setUserName} 
          setUser={setUser} 
        />
      )}
      
      {currentView === 'AGE_CHECK' && <AgeCheckView onNavigate={setCurrentView} />}
      
      {currentView === 'EXTRACTOR' && (
        <ExtractorView 
          onNavigate={setCurrentView} 
          userName={userName} 
        />
      )}
      
      {currentView === 'PENDING' && <PendingView />}
      
      {currentView === 'GAME' && user && (
        <GameView 
          user={user} 
          setUser={setUser} 
          onNavigate={setCurrentView}
          onLogout={() => {
            setUser(null);
            setCurrentView('WELCOME');
            showToast('已安全退出连接');
          }}
          showToast={showToast} // 将全局提示传给游戏主界面
          fetchGlobalData={async () => {
            // 提供给子组件手动刷新用户数据的回调
            const res = await fetch(`/api/users/${user.name}`);
            const data = await res.json();
            if (data.success) setUser(data.user);
          }}
        />
      )}
      
      {currentView === 'ADMIN' && <AdminView />}
    </div>
  );
}
