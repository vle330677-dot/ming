import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewState } from '../App';
import { User } from '../types';

interface Props {
  onNavigate: (view: ViewState) => void;
  setUserName: (name: string) => void;
  setUser: (user: User | null) => void;
}

const USER_TOKEN_KEY = 'USER_TOKEN';
const USER_NAME_KEY = 'USER_NAME';

export function LoginView({ onNavigate, setUserName, setUser }: Props) {
  const [step, setStep] = useState<'name' | 'password'>('name');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [tempUser, setTempUser] = useState<User | null>(null);

  const processUserEntry = async (user: User) => {
    setUserName((user as any).name);
    setUser(user);

    if ((user as any).status === 'approved') {
      onNavigate('GAME');
    } else if ((user as any).status === 'pending') {
      setError('您的人设还未通过审核，请前往审核群：740196067联系管理员');
    } else if ((user as any).status === 'rejected') {
      setError('您的身份档案不被塔认可，请回到审核群重新提交');
      fetch(`/api/users/${(user as any).id}`, { method: 'DELETE' }).catch(() => void 0);
    } else if ((user as any).status === 'dead') {
      setError('该身份已死亡，请使用新的名字。');
    } else if ((user as any).status === 'ghost') {
      onNavigate('GAME');
    } else {
      // 未知状态兜底
      onNavigate('GAME');
    }
  };

  const fetchUserByName = async (rawName: string) => {
    const res = await fetch(`/api/users/${encodeURIComponent(rawName)}`);
    return res.json();
  };

  // 第一步：输入名字
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const data = await fetchUserByName(name.trim());

      if (data.success && data.user) {
        // 老逻辑：存在用户则进入密码输入（无论是否设置密码，统一走后端登录更安全）
        setTempUser(data.user as User);
        setStep('password');
      } else {
        // 新建角色流程
        await fetch('/api/users/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        });

        setUserName(name.trim());
        localStorage.setItem(USER_NAME_KEY, name.trim());

        setError('未查询到你的资料，现在获取您的身份');
        setTimeout(() => onNavigate('AGE_CHECK'), 1200);
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 第二步：输入密码
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      // 1) 优先走新后端认证
      let loginData: any = null;
      try {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), password })
        });
        loginData = await loginRes.json();
      } catch {
        // ignore, 走兼容逻辑
      }

      if (loginData?.success && loginData?.token) {
        localStorage.setItem(USER_TOKEN_KEY, loginData.token);
        localStorage.setItem(USER_NAME_KEY, name.trim());

        // 登录成功后，拉取完整 user 档案用于进入流程
        const profileData = await fetchUserByName(name.trim());
        if (profileData?.success && profileData?.user) {
          await processUserEntry(profileData.user as User);
          return;
        }
        setError('登录成功，但读取角色资料失败');
        return;
      }

      // 2) 兼容旧后端：前端比对 tempUser.password
      if (tempUser && (tempUser as any).password != null) {
        if (password === (tempUser as any).password) {
          localStorage.setItem(USER_NAME_KEY, (tempUser as any).name || name.trim());
          await processUserEntry(tempUser);
        } else {
          setError('安全锁密码错误！');
        }
        return;
      }

      // 3) 若老数据无密码，直接放行（兼容历史）
      if (tempUser && !(tempUser as any).password) {
        localStorage.setItem(USER_NAME_KEY, (tempUser as any).name || name.trim());
        await processUserEntry(tempUser);
        return;
      }

      // 4) 都没命中
      setError(loginData?.message || '登录失败，请检查账号密码');
    } catch (err: any) {
      if (err?.message?.includes('SESSION_KICKED')) {
        setError('你已在其他设备登录，当前会话失效。');
      } else {
        setError('网络错误，请稍后再试');
      }
    } finally {
      setLoading(false);
    }
  };

  const goAdmin = () => {
    onNavigate('ADMIN' as ViewState);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <AnimatePresence mode="wait">
        {step === 'name' ? (
          <motion.div
            key="nameStep"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md text-center"
          >
            <h2 className="text-2xl font-serif text-gray-800 mb-6">你是谁</h2>
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入你的名字"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 text-center text-lg"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? '查询中...' : '确认'}
              </button>
            </form>

            <button
              type="button"
              onClick={goAdmin}
              className="mt-3 w-full py-2 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors"
            >
              管理员入口
            </button>

            {error && <p className="mt-4 text-sm text-red-500 font-bold">{error}</p>}
          </motion.div>
        ) : (
          <motion.div
            key="pwdStep"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md text-center"
          >
            <h2 className="text-xl font-bold text-gray-800 mb-2">安全验证</h2>
            <p className="text-xs text-gray-500 mb-6">
              账号 <b>{tempUser ? (tempUser as any).name : name}</b> 登录验证
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 text-center"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('name');
                    setPassword('');
                    setError('');
                  }}
                  className="w-1/3 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200"
                >
                  返回
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {loading ? '登录中...' : '进入世界'}
                </button>
              </div>
            </form>

            {error && <p className="mt-4 text-sm text-red-500 font-bold">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
