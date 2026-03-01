import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, MessageCircle, Swords, HandMetal, Users,
  BookOpen, Ghost, HeartHandshake, Eye, Coins, ShieldAlert
} from 'lucide-react';
import { User } from '../types';

export interface RPStartResult {
  ok: boolean;
  sessionId?: string;
  message?: string;
}

interface Props {
  currentUser: User;
  targetUser: User;
  onClose: () => void;
  onStartRP: (target: User) => Promise<RPStartResult>;
  showToast: (msg: string) => void;
}

export function PlayerInteractionUI({ currentUser, targetUser, onClose, onStartRP, showToast }: Props) {
  const [noteContent, setNoteContent] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [isStartingRP, setIsStartingRP] = useState(false);
  const [actionLock, setActionLock] = useState(false);

  useEffect(() => {
    fetch(`/api/notes/${currentUser.id}/${targetUser.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setNoteContent(d.content || '');
      })
      .catch(() => {});
  }, [currentUser.id, targetUser.id]);

  // 头像地址解析（兼容 avatarUrl/avatar/imageUrl + 失败兜底）
  const resolveAvatarSrc = (u: any) => {
    const raw = u?.avatarUrl ?? u?.avatar ?? u?.imageUrl ?? '';
    if (!raw || typeof raw !== 'string') return '';
    const s = raw.trim();
    if (!s) return '';

    // 合法可访问地址：data/base64、http(s)、站内绝对路径
    if (/^data:image\//.test(s) || /^https?:\/\//.test(s) || s.startsWith('/')) return s;

    // 明显是本地盘符路径（浏览器不可访问）直接判空，交给首字母兜底
    if (/^[a-zA-Z]:\\/.test(s)) return '';

    // 兜底：相对路径转站内路径
    return `/${s.replace(/^\.?\//, '')}`;
  };

  const targetAvatarSrc = useMemo(() => resolveAvatarSrc(targetUser), [targetUser]);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [targetAvatarSrc, targetUser?.id]);

  // ESC 关闭（可控，不依赖点背景）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveNote = async () => {
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: currentUser.id, targetId: targetUser.id, content: noteContent })
    });
    showToast('私人笔记已保存');
    setShowNotes(false);
  };

  const perspectiveText = useMemo(() => {
    const myRole = currentUser.role;
    const tRole = targetUser.role;

    if (myRole === '普通人' && tRole === '鬼魂') return '你什么都没看到，但感觉周围有一股令人毛骨悚然的冷意...';
    if (myRole === '普通人') {
      if (tRole === '哨兵') return '对方身上散发着无形的压迫感，让你觉得有些喘不过气。';
      if (tRole === '向导') return '对方的气场让你觉得莫名的安心和亲切。';
      return '这是一个看起来很普通的人。';
    }
    if (myRole === '鬼魂') {
      if (tRole === '哨兵') return '极度危险！对方的精神波动像针刺一样威胁着你的灵体。';
      if (tRole === '向导') return '对方的精神海很温暖，让你有种想靠近的亲和感。';
      if (tRole === '普通人') return '一个毫无灵力波动的普通躯壳。';
      return '你们对视了一眼，确认过眼神，都是同道中鬼。';
    }
    if (myRole === '向导') {
      if (tRole === '哨兵') {
        const fury = targetUser.fury || 0;
        if (fury >= 80) return '警报！对方的精神图景正在崩塌边缘，狂暴的能量极度危险！';
        if (fury >= 60) return '对方的精神状态有些紧绷，能感受到明显的压力。';
        return '对方的精神力波动平稳，一切正常。';
      }
      if (tRole === '鬼魂') return '捕捉到了异常的离散精神体波动。';
      if (tRole === '普通人') return '这个人身上没有精神力波动的痕迹。';
    }
    if (myRole === '哨兵') {
      if (tRole === '向导') return '对方的存在本身就像一剂良药，让你感到本能的亲近与放松。';
      if (tRole === '鬼魂') return '周围似乎有些烦人的、黏糊糊的波动存在。';
      if (tRole === '普通人') return '毫无威胁的普通人。';
      return '确认过了，是同类。精神屏障互相摩擦的感觉并不好受。';
    }
    return '你们相互打量着对方。';
  }, [currentUser, targetUser]);

  const startRPNow = async () => {
    try {
      setIsStartingRP(true);
      const result = await onStartRP(targetUser);
      if (result.ok) {
        onClose();
      } else {
        showToast(result.message || '建立连接失败：未拿到会话ID');
      }
    } catch (e) {
      console.error(e);
      showToast('建立连接失败，请稍后重试');
    } finally {
      setIsStartingRP(false);
    }
  };

  const handleAction = async (actionType: string) => {
    if (actionLock || isStartingRP) return;

    const wantsSkip = window.confirm(
      '是否向对方发送【免对戏跳过】请求？\n(若对方同意，直接结算；若不同意，此动作失效)'
    );
    if (wantsSkip) {
      setIsActionPending(true);
      showToast('已向对方发送跳过请求，等待回应...');
      setTimeout(() => {
        setIsActionPending(false);
        showToast('对方拒绝了你的跳过请求，动作取消。');
      }, 3000);
      return;
    }

    setActionLock(true);
    try {
      switch (actionType) {
        case 'combat': {
          const rankMap: Record<string, number> = {
            SSS: 7,
            SS: 6,
            S: 5,
            A: 4,
            B: 3,
            C: 2,
            D: 1,
            无: 0
          };
          const myScore =
            rankMap[currentUser.mentalRank || '无'] + rankMap[currentUser.physicalRank || '无'];
          const tScore =
            rankMap[targetUser.mentalRank || '无'] + rankMap[targetUser.physicalRank || '无'];

          const combatRes = await fetch('/api/interact/combat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attackerId: currentUser.id,
              defenderId: targetUser.id,
              attackerScore: myScore,
              defenderScore: tScore
            })
          });
          const combatData = await combatRes.json().catch(() => ({}));
          if (!combatRes.ok || combatData.success === false) {
            showToast(combatData.message || '战斗结算失败');
            return;
          }

          await fetch('/api/combat/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
          });

          showToast(combatData.isAttackerWin ? '你在这次交锋中占优' : '你在这次交锋中失利');
          break;
        }

        case 'steal': {
          const res = await fetch('/api/interact/steal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thiefId: currentUser.id, targetId: targetUser.id })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.success === false) {
            showToast(data.message || '偷窃失败');
            return;
          }
          showToast(data.message || '偷窃成功');
          break;
        }

        case 'soothe': {
          const res = await fetch('/api/guide/soothe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentinelId: targetUser.id, guideId: currentUser.id })
          });
          const data = await res.json().catch(() => ({}));
          showToast(data.message || (data.success ? '抚慰完成' : '抚慰失败'));
          break;
        }

        case 'prank': {
          const res = await fetch('/api/interact/prank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ghostId: currentUser.id,
              targetId: targetUser.id,
              targetRole: targetUser.role
            })
          });
          const data = await res.json().catch(() => ({}));
          showToast(data.message || (data.success ? '恶作剧成功' : '恶作剧失败'));
          break;
        }

        case 'probe': {
          const probeRes = await fetch('/api/interact/probe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetId: targetUser.id })
          });
          const data = await probeRes.json().catch(() => ({}));
          if (data.success) {
            alert(`【探查结果】你窥探到了对方的秘密数据：${data.probedStat.key} = ${data.probedStat.value}`);
          } else {
            showToast(data.message || '探查失败');
            return;
          }
          break;
        }

        default:
          break;
      }

      await startRPNow();
    } finally {
      setActionLock(false);
    }
  };

  // 普通人看鬼魂：也不给背景点击关闭，避免误触瞬关
  if (currentUser.role === '普通人' && targetUser.role === '鬼魂') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative bg-slate-900 border border-slate-700 p-8 rounded-3xl text-center max-w-sm"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 text-slate-500 hover:text-white bg-slate-800 rounded-full border border-slate-700"
          >
            <X size={16} />
          </button>
          <Ghost size={48} className="text-slate-700 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-300 italic">"{perspectiveText}"</p>
        </motion.div>
      </div>
    );
  }

  const disableAll = actionLock || isStartingRP;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex items-center justify-center w-[500px] h-[500px]"
      >
        <button
          onClick={onClose}
          className="absolute top-0 right-0 z-50 p-2 text-slate-500 hover:text-white bg-slate-900 rounded-full border border-slate-700"
        >
          <X size={20} />
        </button>

        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          <div className="w-48 h-64 bg-slate-900 rounded-2xl border-4 border-slate-700 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] pointer-events-auto flex items-center justify-center">
            {targetAvatarSrc && !avatarLoadFailed ? (
              <img
                src={targetAvatarSrc}
                className="w-full h-full object-contain"
                alt={`${targetUser.name} avatar`}
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl text-slate-600 font-black">
                {(targetUser?.name || '?')[0]}
              </div>
            )}
          </div>

          <div className="mt-4 bg-slate-900/90 border border-slate-700 p-4 rounded-xl w-80 text-center shadow-xl backdrop-blur">
            <h4 className="text-lg font-black text-white mb-1">{targetUser.name}</h4>
            <p className="text-sm text-slate-300 italic">"{perspectiveText}"</p>
            {isActionPending && <p className="text-[10px] text-amber-400 mt-2">等待对方处理跳过请求...</p>}
          </div>
        </div>

        <div className="absolute inset-0 z-20 pointer-events-none">
          <ActionButton
            onClick={startRPNow}
            icon={<MessageCircle />}
            label={isStartingRP ? '连接中...' : '发起对戏'}
            cls="top-0 left-1/2 -translate-x-1/2"
            color="bg-sky-600 hover:bg-sky-500"
            disabled={disableAll}
          />
          <ActionButton
            onClick={() => handleAction('combat')}
            icon={<Swords
