import { useState, useEffect, useRef, useCallback } from 'react';

import { motion, AnimatePresence } from 'motion/react';
import { WelcomeView } from './views/WelcomeView';
import { LoginView } from './views/LoginView';
import { AgeCheckView } from './views/AgeCheckView';
import { ExtractorView } from './views/ExtractorView';
import { PendingView } from './views/PendingView';
import { GameView } from './views/GameView';
import { TowerOfLifeView } from './views/TowerOfLifeView';
import { AdminView } from './views/AdminView';
import { User } from './types';
import { clearUserSession, clearAdminSession } from './utils/http';
import { APP_TOAST_EVENT } from './utils/appEvents';

export type ViewState =
  | 'WELCOME'
  | 'LOGIN'
  | 'AGE_CHECK'
  | 'EXTRACTOR'
  | 'PENDING'
  | 'GAME'
  | 'TOWER_OF_LIFE'
  | 'ADMIN';

type ToastType = 'info' | 'success' | 'warn';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('WELCOME');
  const [userName, setUserName] = useState('');
  const [user, setUser] = useState<User | null>(null);

  // 管理员视图重建 key（管理员会话失效时强制重挂载）
  const [adminViewKey, setAdminViewKey] = useState(0);

  // 全局 Toast
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (msg: string, type: ToastType = 'info', duration = 3000) => {
    setToast({ msg, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), duration);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // 全局 app:toast 事件监听（任何组件可触发，无需改 GameView props）
  useEffect(() => {
    const onAppToast = (e: Event) => {
      const ce = e as CustomEvent<{ msg: string; type?: ToastType; duration?: number }>;
      const msg = ce.detail?.msg;
      const type = ce.detail?.type || 'info';
      const duration = ce.detail?.duration ?? 3000;
      if (!msg) return;
      showToast(msg, type, duration);
    };

    window.addEventListener(APP_TOAST_EVENT, onAppToast as EventListener);
    return () => window.removeEventListener(APP_TOAST_EVENT, onAppToast as EventListener);
  }, []);

  // 全局认证事件监听（被顶号 / 管理员会话失效）
  useEffect(() => {
    const onKicked = (e: any) => {
      const msg = e?.detail?.message || '你已在其他设备登录，当前已下线';
      clearUserSession();
      setUser(null);
      setUserName('');
      setCurrentView('LOGIN');
      showToast(msg, 'warn');
    };

    const onAdminExpired = (e: any) => {
      const msg = e?.detail?.message || '管理员会话失效，请重新登录';
      clearAdminSession();
      setAdminViewKey((v) => v + 1);
      setCurrentView('ADMIN');
      showToast(msg, 'warn');
    };

    window.addEventListener('auth:kicked', onKicked as EventListener);
    window.addEventListener('auth:admin_expired', onAdminExpired as EventListener);

    return () => {
      window.removeEventListener('auth:kicked', onKicked as EventListener);
      window.removeEventListener('auth:admin_expired', onAdminExpired as EventListener);
    };
  }, []);

  // PENDING 审核轮询
  useEffect(() => {
    if (userName && currentView === 'PENDING') {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/users/${encodeURIComponent(userName)}`);
          const data = await res.json();
          if (data.success && data.user.status === 'approved') {
            setUser(data.user);

            // 标记“刚审核通过的新用户”，用于命之塔首次欢迎弹窗触发
            sessionStorage.setItem(`tower_newcomer_welcome_trigger_${data.user.id}`, '1');

            setCurrentView('TOWER_OF_LIFE');
            showToast('身份审核通过，欢迎来到哨向世界！', 'success');
          }
        } catch (error) {
          console.error('Failed to fetch user status', error);
        }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [userName, currentView]);

  // GAME / TOWER_OF_LIFE 内定时同步用户信息
  useEffect(() => {
    if (user && (currentView === 'GAME' || currentView === 'TOWER_OF_LIFE')) {
      const timer = setInterval(async () => {
        try {
          const res = await fetch(`/api/users/${encodeURIComponent((user as any).name)}`);
          const data = await res.json();
          if (data.success) setUser(data.user);
        } catch (e) {
          console.error('Sync failed', e);
        }
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [user, currentView]);

  const fetchGlobalData = useCallback(async () => {
    if (!user?.name) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.name)}`);
      const data = await res.json();
      if (data.success) setUser(data.user);
    } catch (e) {
      console.error('fetchGlobalData failed', e);
    }
  }, [user?.name]);

  const handleLogout = () => {
    clearUserSession();
    setUser(null);
    setUserName('');
    setCurrentView('LOGIN');
    showToast('已退出登录', 'info');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans relative overflow-hidden">
      {/* 全局 Toast 渲染层 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-0 left-1/2 z-[10000] px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-white/20 text-sm font-bold flex items-center gap-2
              ${
                toast.type === 'success'
                  ? 'bg-emerald-500/90 text-white'
                  : toast.type === 'warn'
                  ? 'bg-rose-500/90 text-white'
                  : 'bg-slate-900/90 text-white'
              }`}
          >
            {toast.type === 'success' && '🎉'}
            {toast.type === 'warn' && '⚠️'}
            {toast.type === 'info' && '💡'}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 视图渲染 */}
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
        <ExtractorView onNavigate={setCurrentView} userName={userName} />
      )}

      {currentView === 'PENDING' && <PendingView />}

      {currentView === 'TOWER_OF_LIFE' && user && (
        <TowerOfLifeView
          user={user}
          onExit={() => setCurrentView('GAME')}
          showToast={(msg) => showToast(msg)}
          fetchGlobalData={fetchGlobalData}
        />
      )}

      {currentView === 'GAME' && user && (
        <GameView
          user={user}
          onLogout={handleLogout}
          showToast={(msg) => showToast(msg)}
          fetchGlobalData={fetchGlobalData}
        />
      )}

      {currentView === 'ADMIN' && <AdminView key={adminViewKey} />}
    </div>
  );
}
