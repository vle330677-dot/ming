import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewState } from '../App';
import { User } from '../types';

interface Props {
  onNavigate: (view: ViewState) => void;
  setUserName: (name: string) => void;
  setUser: (user: User | null) => void;
}

export function LoginView({ onNavigate, setUserName, setUser }: Props) {
  const [step, setStep] = useState<'name' | 'password'>('name');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [tempUser, setTempUser] = useState<any>(null);

  const processUserEntry = async (user: any) => {
    setUserName(user.name);
    setUser(user);
    if (user.status === 'approved') {
      onNavigate('GAME');
    } else if (user.status === 'pending') {
      setError('您的人设还未通过审核，请前往审核群：740196067联系管理员');
    } else if (user.status === 'rejected') {
      setError('您的身份档案不被塔认可，请回到审核群重新提交');
      fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    } else if (user.status === 'dead') {
      setError('该身份已死亡，请使用新的名字。');
    } else if (user.status === 'ghost') {
      onNavigate('GAME');
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${name.trim()}`);
      const data = await res.json();

      if (data.success && data.user) {
        if (data.user.password) {
          // 账号锁定了，进入密码输入阶段
          setTempUser(data.user);
          setStep('password');
        } else {
          // 无锁，直接登入
          processUserEntry(data.user);
        }
      } else {
        // 新建角色流程
        await fetch('/api/users/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim() })
        });
        setUserName(name.trim());
        setError('未查询到你的资料，现在获取您的身份');
        setTimeout(() => onNavigate('AGE_CHECK'), 1500);
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === tempUser.password) {
      processUserEntry(tempUser);
    } else {
      setError('安全锁密码错误！');
    }
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
            <p className="text-xs text-gray-500 mb-6">您已为账号 <b>{tempUser?.name}</b> 设置了密码锁</p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码解锁"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 text-center"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => {setStep('name'); setPassword(''); setError('');}} className="w-1/3 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200">
                  返回
                </button>
                <button type="submit" className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800">
                  进入世界
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