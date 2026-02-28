import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Settings, Skull, Cross, Send, Trash2, Heart, ArrowLeft, Users } from 'lucide-react';
import { User } from '../types';

// ================== 组件导入 ==================
import { PlayerInteractionUI } from './PlayerInteractionUI';
import { CharacterHUD } from './CharacterHUD';
import { RoleplayWindow } from './RoleplayWindow';

import { TowerOfLifeView } from './TowerOfLifeView';
import { LondonTowerView } from './LondonTowerView';
import { SanctuaryView } from './SanctuaryView';
import { GuildView } from './GuildView';
import { ArmyView } from './ArmyView';
import { SlumsView } from './SlumsView';
import { RichAreaView } from './RichAreaView';
import { DemonSocietyView } from './DemonSocietyView';
import { SpiritBureauView } from './SpiritBureauView';
import { ObserverView } from './ObserverView';

// ================== 资源映射配置 ==================
const LOCATION_BG_MAP: Record<string, string> = {
  tower_of_life: '/命之塔.jpg',
  london_tower: '/伦敦塔.jpg',
  sanctuary: '/圣所.jpg',
  guild: '/公会.jpg',
  army: '/军队.jpg',
  rich_area: '/东市.jpg',
  slums: '/西市.jpg',
  demon_society: '/恶魔会.jpg',
  paranormal_office: '/灵异管理所.jpg',
  observers: '/观察者.jpg'
};

// ================== 地图坐标配置 ==================
const LOCATIONS = [
  { id: 'tower_of_life', name: '命之塔', x: 50, y: 48, type: 'safe', description: '世界的绝对中心，神明降下神谕的圣地。' },
  { id: 'sanctuary', name: '圣所', x: 42, y: 42, type: 'safe', description: '未分化幼崽的摇篮，充满治愈与宁静的气息。' },
  { id: 'london_tower', name: '伦敦塔', x: 67, y: 35, type: 'safe', description: '哨兵与向导的最高学府与管理机构。' },
  { id: 'rich_area', name: '富人区', x: 70, y: 50, type: 'danger', description: '流光溢彩的销金窟，权贵们在此挥霍财富。' },
  { id: 'slums', name: '贫民区', x: 25, y: 48, type: 'danger', description: '混乱、肮脏，但充满生机。' },
  { id: 'demon_society', name: '恶魔会', x: 12, y: 20, type: 'danger', description: '混乱之王的狂欢所。(未知区域)' },
  { id: 'guild', name: '工会', x: 48, y: 78, type: 'danger', description: '鱼龙混杂的地下交易网与冒险者聚集地。' },
  { id: 'army', name: '军队', x: 50, y: 18, type: 'danger', description: '人类最坚实的物理防线。' },
  { id: 'observers', name: '观察者', x: 65, y: 15, type: 'danger', description: '记录世界历史与真相的隐秘结社。' },
  { id: 'paranormal_office', name: '灵异管理所', x: 88, y: 15, type: 'danger', description: '专门处理非自然精神波动的神秘机关。' }
];

const SAFE_ZONES = ['tower_of_life', 'sanctuary', 'london_tower'];

interface Props {
  user: User;
  onLogout: () => void;
  showToast: (msg: string) => void;
  fetchGlobalData: () => void;
}

function hashNum(input: string | number) {
  const s = String(input);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function buildPairSessionId(a: number, b: number, locationId: string) {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return `rp-${locationId || 'unknown'}-${min}-${max}`;
}

export function GameView({ user, onLogout, showToast, fetchGlobalData }: Props) {
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [activeView, setActiveView] = useState<string | null>(null);

  const [localPlayers, setLocalPlayers] = useState<any[]>([]);
  const [showPlayersPanel, setShowPlayersPanel] = useState(true);

  const [interactTarget, setInteractTarget] = useState<any>(null);

  // ===== RP 状态 =====
  const [rpSessionId, setRPSessionId] = useState<string | null>(null);
  const [rpWindowOpen, setRPWindowOpen] = useState(false);
  const [rpPeerName, setRPPeerName] = useState<string>('');
  const [rpNearbyHint, setRPNearbyHint] = useState('');
  const [rpPing, setRPPing] = useState(false);
  const [isCreatingRP, setIsCreatingRP] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showDeathForm, setShowDeathForm] = useState<'death' | 'ghost' | null>(null);
  const [deathText, setDeathText] = useState('');

  const [isDying, setIsDying] = useState(false);
  const [rescueReqId, setRescueReqId] = useState<number | null>(null);

  const [showGraveyard, setShowGraveyard] = useState(false);
  const [tombstones, setTombstones] = useState<any[]>([]);
  const [expandedTombstone, setExpandedTombstone] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  const currentBackgroundImage = useMemo(() => {
    if (activeView && LOCATION_BG_MAP[activeView]) return LOCATION_BG_MAP[activeView];
    return '/map_background.jpg';
  }, [activeView]);

  const effectiveLocationId = activeView || user.currentLocation;

  useEffect(() => {
    if ((user.hp || 0) <= 0 && user.status === 'approved') setIsDying(true);
    else setIsDying(false);
  }, [user.hp, user.status]);

  useEffect(() => {
    if (!isDying || !rescueReqId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/rescue/check/${user.id}`);
        const data = await res.json();
        if (data.outgoing) {
          if (data.outgoing.status === 'accepted') {
            await fetch('/api/rescue/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ patientId: user.id })
            });
            showToast('一位医疗向导将你从死亡边缘拉了回来！');
            setIsDying(false);
            setRescueReqId(null);
            fetchGlobalData();
          } else if (data.outgoing.status === 'rejected') {
            showToast('你的求救被拒绝了，生机断绝...');
            setRescueReqId(null);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [isDying, rescueReqId, user.id, showToast, fetchGlobalData]);

  // ===== 同地图玩家轮询 =====
  useEffect(() => {
    if (!effectiveLocationId) {
      setLocalPlayers([]);
      return;
    }

    const fetchPlayers = async () => {
      try {
        const res = await fetch(`/api/locations/${effectiveLocationId}/players?excludeId=${user.id}`);
        const data = await res.json();
        if (data.success) {
          const unique = (data.players || []).filter(
            (p: any, idx: number, arr: any[]) => arr.findIndex((x) => x.id === p.id) === idx
          );
          setLocalPlayers(unique);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchPlayers();
    const timer = setInterval(fetchPlayers, 4000);
    return () => clearInterval(timer);
  }, [effectiveLocationId, user.id]);

  // ===== 被动接收/同步对戏会话（不自动弹窗）=====
  useEffect(() => {
    let alive = true;
    let lastSessionId = '';

    const pollIncoming = async () => {
      try {
        const res = await fetch(`/api/rp/session/active/${user.id}`);
        const data = await res.json();

        if (!alive || !res.ok || !data.success) return;

        if (data.sessionId) {
          const sid = String(data.sessionId);
          const s = data.session || {};
          const peer = Number(s.userAId) === Number(user.id) ? s.userBName || '' : s.userAName || '';

          setRPSessionId(sid);
          setRPPeerName(peer);

          // 只提示，不自动打开窗口
          if (sid !== lastSessionId && sid !== rpSessionId) {
            showToast(`${peer || '有玩家'} 向你发起了对戏，点击左下角“对戏聊天”查看`);
            if (!rpWindowOpen) setRPPing(true);
          }

          lastSessionId = sid;
        } else {
          setRPSessionId(null);
          setRPPeerName('');
          setRPWindowOpen(false);
          setRPPing(false);
          lastSessionId = '';
        }
      } catch {
        // ignore
      }
    };

    pollIncoming();
    const t = setInterval(pollIncoming, 1500);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user.id, showToast, rpSessionId, rpWindowOpen]);

  // ===== 对戏对象“在你身边”提示 =====
  useEffect(() => {
    if (!rpSessionId || !rpPeerName) {
      setRPNearbyHint('');
      return;
    }

    const nearby = localPlayers.some((p: any) => String(p.name || '').trim() === String(rpPeerName).trim());
    setRPNearbyHint(nearby ? `${rpPeerName} 玩家在你身边` : '');
  }, [rpSessionId, rpPeerName, localPlayers, effectiveLocationId]);

  const userAge = user?.age || 0;
  const isUndifferentiated = userAge < 16;
  const isStudentAge = userAge >= 16 && userAge <= 19;

  // ===== 主动发起对戏（稳态 + 不吞错）=====
  const startRoleplaySession = async (target: User): Promise<any> => {
    if (isCreatingRP) return { ok: false, message: '正在建立连接，请稍候' };
    if (!target?.id || target.id === user.id) return { ok: false, message: '目标玩家无效' };

    setIsCreatingRP(true);
    try {
      const sid = buildPairSessionId(user.id, target.id, effectiveLocationId || 'unknown');
      const locationName = LOCATIONS.find((l) => l.id === effectiveLocationId)?.name || '未知区域';

      // 主动发起：打开聊天窗（可手动关）
      setRPSessionId(sid);
      setRPPeerName(target.name || '');
      setRPWindowOpen(true);
      setRPPing(false);

      const payload = {
        sessionId: sid,
        userAId: user.id,
        userAName: user.name,
        userBId: target.id,
        userBName: target.name,
        locationId: effectiveLocationId || 'unknown',
        locationName
      };

      const res = await fetch('/api/rp/session/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        setRPWindowOpen(false);
        setRPSessionId(null);
        return { ok: false, message: data.message || '建立连接失败（会话创建失败）' };
      }

      showToast(`已向 ${target.name} 发起对戏连接`);
      return { ok: true, sessionId: sid };
    } catch (e: any) {
      setRPWindowOpen(false);
      setRPSessionId(null);
      return { ok: false, message: e?.message || '建立连接失败' };
    } finally {
      setIsCreatingRP(false);
    }
  };

  const handleExploreAction = async () => {
    if (Math.random() > 0.5) {
      try {
        const res = await fetch('/api/explore/combat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
        const data = await res.json();
        if (data.isWin) showToast(`⚔️ 战斗大捷：${data.message}`);
        else {
          alert(`❌ 探索失败：${data.message}`);
          setActiveView(null);
          fetchGlobalData();
        }
      } catch {
        showToast('战斗系统连接中断');
      }
    } else {
      handleExploreItem();
    }
  };

  const handleLocationAction = async (action: 'enter' | 'stay') => {
    if (!selectedLocation) return;

    if (isUndifferentiated && !SAFE_ZONES.includes(selectedLocation.id)) {
      showToast('【圣所保护协议】未分化幼崽禁止进入该区域，请前往圣所/命之塔/伦敦塔。');
      return;
    }

    if (isStudentAge && action === 'enter' && !SAFE_ZONES.includes(selectedLocation.id)) {
      if (!window.confirm('你还没有毕业，强行加入仅能获得最低职位。确定吗？')) {
        setActiveView('london_tower');
        return;
      }
    }

    if (action === 'stay') {
      await fetch(`/api/users/${user.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation.id })
      });
      showToast(`已在 ${selectedLocation.name} 驻足。`);
      fetchGlobalData();
      return;
    }

    if (action === 'enter') {
      await fetch(`/api/users/${user.id}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation.id })
      });

      setActiveView(selectedLocation.id);
      setSelectedLocation(null);
      fetchGlobalData();
    }
  };

  const handleExploreSkill = async () => {
    if (!selectedLocation) return;
    try {
      const res = await fetch('/api/explore/skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, locationId: selectedLocation.id })
      });
      const data = await res.json();
      showToast(data.success ? `🎉 ${data.message}` : `⚠️ ${data.message}`);
    } catch {
      showToast('错误！');
    }
  };

  const handleExploreItem = async () => {
    if (!selectedLocation && !activeView) return;
    const locId = activeView || selectedLocation?.id;
    try {
      const res = await fetch('/api/explore/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, locationId: locId })
      });
      const data = await res.json();
      showToast(data.success ? `🎉 ${data.message}` : `⚠️ ${data.message}`);
    } catch {
      showToast('错误！');
    }
  };

  const handleStruggle = async () => {
    try {
      const res = await fetch('/api/rescue/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: user.id, healerId: 0 })
      });
      if ((await res.json()).success) {
        setRescueReqId(Date.now());
        showToast('求救信号已发出...');
      }
    } catch {
      showToast('求救发送失败');
    }
  };

  const handleSubmitDeath = async () => {
    if (!deathText.trim()) return showToast('必须填写谢幕词');
    await fetch(`/api/users/${user.id}/submit-death`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: showDeathForm === 'death' ? 'pending_death' : 'pending_ghost', text: deathText })
    });
    showToast('申请已提交...');
    setShowDeathForm(null);
    fetchGlobalData();
  };

  const fetchGraveyard = async () => {
    const res = await fetch('/api/graveyard');
    const data = await res.json();
    if (data.success) {
      setTombstones(data.tombstones);
      setShowGraveyard(true);
    }
  };

  const loadComments = async (tombstoneId: number) => {
    if (expandedTombstone === tombstoneId) {
      setExpandedTombstone(null);
      return;
    }
    const res = await fetch(`/api/graveyard/${tombstoneId}/comments`);
    const data = await res.json();
    if (data.success) {
      setComments(data.comments);
      setExpandedTombstone(tombstoneId);
    }
  };

  const addComment = async (tombstoneId: number) => {
    if (!newComment.trim()) return;
    await fetch(`/api/graveyard/${tombstoneId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, userName: user.name, content: newComment })
    });
    setNewComment('');
    loadComments(tombstoneId);
  };

  const deleteComment = async (commentId: number, tombstoneId: number) => {
    await fetch(`/api/graveyard/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    loadComments(tombstoneId);
  };

  // ===== 气泡布局：防重叠 + 分层 =====
  const bubbleLayout = useMemo(() => {
    const result: Record<string, { left: number; top: number; scale: number; depth: number; delay: number; z: number }> = {};
    const placed: Array<{ x: number; y: number }> = [];

    localPlayers.forEach((p: any, idx: number) => {
      const h = hashNum(`${p.id}-${idx}`);

      let x = 12 + (h % 76);
      let y = 18 + ((h * 7) % 58);

      let found = false;
      for (let t = 0; t < 36; t++) {
        const ok = placed.every((pt) => {
          const dx = x - pt.x;
          const dy = y - pt.y;
          return dx * dx + dy * dy >= 65;
        });
        if (ok) {
          found = true;
          break;
        }

        const angle = (t * 37) * (Math.PI / 180);
        const r = 1.6 + t * 0.45;
        x = Math.min(90, Math.max(10, x + Math.cos(angle) * r));
        y = Math.min(80, Math.max(14, y + Math.sin(angle) * r));
      }

      if (!found) {
        x = 12 + ((h + idx * 13) % 76);
        y = 18 + (((h + idx * 29) * 3) % 58);
      }

      placed.push({ x, y });

      const depth = y / 100;
      const scale = 0.84 + depth * 0.42;
      const z = Math.floor(20 + depth * 40);
      const delay = (h % 9) * 0.12;

      result[String(p.id)] = { left: x, top: y, scale, depth, delay, z };
    });

    return result;
  }, [localPlayers]);

  const renderActiveView = () => {
    if (!activeView) return null;
    const commonProps = { user, onExit: () => setActiveView(null), showToast, fetchGlobalData };

    const Container = ({ children }: { children: React.ReactNode }) => (
      <div className="w-full h-full min-h-screen overflow-y-auto pt-20 pb-10 px-4 md:px-0 flex justify-center">
        <div className="w-full max-w-6xl relative z-10">
          <button
            onClick={() => setActiveView(null)}
            className="mb-4 flex items-center gap-2 px-4 py-2 bg-slate-900/60 backdrop-blur text-white rounded-xl hover:bg-slate-800 transition-colors border border-slate-700/50"
          >
            <ArrowLeft size={18} /> 返回世界地图
          </button>
          {children}
        </div>
      </div>
    );

    switch (activeView) {
      case 'tower_of_life':
        return (
          <Container>
            <TowerOfLifeView {...commonProps} />
          </Container>
        );
      case 'london_tower':
        return (
          <Container>
            <LondonTowerView {...commonProps} />
          </Container>
        );
      case 'sanctuary':
        return (
          <Container>
            <SanctuaryView {...commonProps} />
          </Container>
        );
      case 'guild':
        return (
          <Container>
            <GuildView {...commonProps} />
          </Container>
        );
      case 'army':
        return (
          <Container>
            <ArmyView {...commonProps} />
          </Container>
        );
      case 'slums':
        return (
          <Container>
            <SlumsView {...commonProps} />
          </Container>
        );
      case 'rich_area':
        return (
          <Container>
            <RichAreaView {...commonProps} />
          </Container>
        );
      case 'demon_society':
        return (
          <Container>
            <DemonSocietyView {...commonProps} />
          </Container>
        );
      case 'paranormal_office':
        return (
          <Container>
            <SpiritBureauView {...commonProps} />
          </Container>
        );
      case 'observers':
        return (
          <Container>
            <ObserverView {...commonProps} />
          </Container>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden font-sans select-none text-slate-100 bg-slate-950">
      {/* 背景 */}
      <div className="absolute inset-0 z-0">
        <motion.div
          key={activeView || 'world_map'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{
            backgroundImage: `url(${currentBackgroundImage})`,
            filter: activeView ? 'brightness(0.4) blur(4px)' : 'brightness(0.6)'
          }}
        />
      </div>

      {/* HUD */}
      <CharacterHUD user={user} onLogout={onLogout} onRefresh={fetchGlobalData} />

      {/* 对戏对象在附近提示 */}
      {rpNearbyHint && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[120] px-4 py-2 rounded-full bg-emerald-600/90 text-white text-xs font-black shadow-lg border border-emerald-300/40">
          {rpNearbyHint}
        </div>
      )}

      {/* 地图容器 */}
      <AnimatePresence mode="wait">
        {!activeView && (
          <motion.div className="relative w-full h-full flex items-center justify-center p-2 md:p-8 z-10">
            <div className="relative aspect-[16/9] w-full max-w-[1200px] bg-slate-900/50 rounded-2xl md:rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
              <img src="/map_background.jpg" className="w-full h-full object-cover opacity-80" />

              {LOCATIONS.map((loc) => (
                <div
                  key={loc.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer touch-manipulation"
                  style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                  onClick={() => setSelectedLocation(loc)}
                >
                  <div
                    className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center backdrop-blur-sm transition-all
                    ${user.currentLocation === loc.id ? 'bg-sky-500 border-white animate-pulse' : 'bg-slate-900/80 border-slate-400'}`}
                  >
                    <MapPin size={14} />
                  </div>
                  <div
                    className={`absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-lg text-[10px] md:text-xs font-bold text-slate-200 transition-all duration-300 shadow-xl
                    ${selectedLocation?.id === loc.id ? 'opacity-100 scale-110 z-20 border-sky-500/50 text-white' : 'opacity-0 hover:opacity-100 translate-y-2 hover:translate-y-0'}
                  `}
                  >
                    {loc.name}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeView && (
          <motion.div
            key="location-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-20 relative"
          >
            {renderActiveView()}

            {/* 地点内头像气泡 */}
            <div className="absolute inset-0 z-30 pointer-events-none">
              {localPlayers.map((p, idx) => {
                const b = bubbleLayout[String(p.id)];
                if (!b) return null;

                return (
                  <motion.div
                    key={`bubble-${p.id}-${idx}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                    style={{
                      left: `${b.left}%`,
                      top: `${b.top}%`,
                      zIndex: b.z
                    }}
                    initial={{ opacity: 0, scale: b.scale * 0.7, y: 10 }}
                    animate={{
                      opacity: 1,
                      scale: b.scale,
                      y: [0, -5, 0, 4, 0],
                      x: [0, 2, 0, -2, 0]
                    }}
                    transition={{
                      opacity: { duration: 0.35, delay: b.delay },
                      scale: { duration: 0.35, delay: b.delay },
                      y: { duration: 3.2 + (idx % 3) * 0.6, repeat: Infinity, ease: 'easeInOut' },
                      x: { duration: 4.0 + (idx % 4) * 0.5, repeat: Infinity, ease: 'easeInOut' }
                    }}
                  >
                    <button onClick={() => setInteractTarget(p)} className="group relative" title={`与 ${p.name} 互动`}>
                      <div
                        className="rounded-full overflow-hidden border-2 border-sky-300/70 bg-slate-800 shadow-[0_0_22px_rgba(56,189,248,0.38)] group-hover:scale-110 group-hover:border-sky-200 transition-all"
                        style={{
                          width: `${52 * b.scale}px`,
                          height: `${52 * b.scale}px`,
                          opacity: 0.78 + b.depth * 0.22
                        }}
                      >
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-black text-lg">
                            {(p.name || '?')[0]}
                          </div>
                        )}
                      </div>

                      <span
                        className="absolute bottom-0 right-0 rounded-full bg-emerald-400 border border-white animate-pulse"
                        style={{ width: `${10 * b.scale}px`, height: `${10 * b.scale}px` }}
                      />

                      <div
                        className="absolute left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap
                                      bg-slate-900/90 border border-slate-700 text-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {p.name}
                      </div>
                    </button>
                  </motion.div>
                );
              })}

              {localPlayers.length === 0 && (
                <div
                  className="absolute right-4 top-4 pointer-events-none px-3 py-1.5 rounded-lg text-[11px] font-bold
                                bg-slate-900/80 border border-slate-700 text-slate-400"
                >
                  当前地点暂无其他玩家
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 右侧玩家列表 */}
      <div className="fixed right-4 top-24 z-40">
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl w-56 overflow-hidden">
          <button
            onClick={() => setShowPlayersPanel((v) => !v)}
            className="w-full px-3 py-2 text-xs font-black text-slate-200 border-b border-slate-700 flex items-center justify-between hover:bg-slate-800/80"
          >
            <span className="flex items-center gap-2">
              <Users size={14} /> 同地图玩家
            </span>
            <span className="text-sky-400">{localPlayers.length}</span>
          </button>

          {showPlayersPanel && (
            <div className="max-h-64 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {localPlayers.length === 0 ? (
                <div className="text-[11px] text-slate-500 text-center py-3">当前区域暂无其他玩家</div>
              ) : (
                localPlayers.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => setInteractTarget(p)}
                    className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-sky-500 hover:bg-slate-800 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-600 bg-slate-700 shrink-0">
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-xs font-black">
                          {(p.name || '?')[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{p.job || p.role || '自由人'}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 地点详情弹窗 */}
      <AnimatePresence>
        {selectedLocation && !activeView && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 md:bottom-10 md:left-1/2 md:-translate-x-1/2 md:w-[450px] bg-slate-900/95 backdrop-blur-xl p-6 rounded-t-3xl md:rounded-3xl border-t md:border border-white/20 z-50 shadow-2xl"
          >
            <div className="absolute inset-0 rounded-[2rem] overflow-hidden -z-10 opacity-30">
              <img
                src={LOCATION_BG_MAP[selectedLocation.id] || '/map_background.jpg'}
                className="w-full h-full object-cover blur-md scale-110"
              />
            </div>

            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                  {selectedLocation.name}
                  <span
                    className={`text-[10px] px-2 py-1 rounded-lg border backdrop-blur-sm ${
                      selectedLocation.type === 'safe'
                        ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                        : 'text-rose-300 border-rose-500/30 bg-rose-500/10'
                    }`}
                  >
                    {selectedLocation.type === 'safe' ? '安全区' : '危险区'}
                  </span>
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-6 font-medium">
                  {isUndifferentiated && !SAFE_ZONES.includes(selectedLocation.id)
                    ? '⚠️ 前方区域对未分化幼崽开放受限。'
                    : selectedLocation.description}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleLocationAction('enter')}
                    className="flex-1 px-6 py-3.5 bg-white text-slate-950 font-black rounded-xl text-sm hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                  >
                    进入区域
                  </button>
                  <button
                    onClick={() => handleLocationAction('stay')}
                    className="flex-1 px-6 py-3.5 bg-slate-800/80 text-white font-black rounded-xl text-sm hover:bg-slate-700 transition-colors border border-slate-600"
                  >
                    在此驻足
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={handleExploreSkill}
                    className="w-full px-4 py-3 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold rounded-xl text-xs hover:bg-indigo-500 hover:text-white transition-all"
                  >
                    🧠 领悟派系技能
                  </button>
                  <button
                    onClick={handleExploreItem}
                    className="w-full px-4 py-3 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold rounded-xl text-xs hover:bg-amber-500 hover:text-white transition-all"
                  >
                    📦 搜索区域物资
                  </button>
                </div>

                {selectedLocation.type === 'danger' && (
                  <button
                    onClick={handleExploreAction}
                    className="w-full mt-2 px-4 py-3 bg-rose-600/20 text-rose-300 border border-rose-500/30 font-black rounded-xl text-xs hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Skull size={14} /> 探索遭遇战 (风险)
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="p-2 -mr-2 -mt-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors backdrop-blur-sm"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 玩家交互弹窗 */}
      <AnimatePresence>
        {interactTarget && (
          <PlayerInteractionUI
            currentUser={user}
            targetUser={interactTarget}
            onClose={() => setInteractTarget(null)}
            showToast={showToast}
            onStartRP={async (target) => {
              return await startRoleplaySession(target);
            }}
          />
        )}
      </AnimatePresence>

      {(user.status === 'pending_death' || user.status === 'pending_ghost') && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md">
          <Skull size={64} className="text-slate-600 mb-6 animate-pulse" />
          <h1 className="text-3xl font-black text-white mb-4 tracking-widest">命运审视中</h1>
          <p className="text-slate-400 font-bold max-w-md leading-relaxed">
            您的谢幕戏正在递交至「塔」的最高议会。
            <br />
            在获得批准前，您的灵魂被锁定于此。
          </p>
        </div>
      )}

      <AnimatePresence>
        {isDying && user.status === 'approved' && (
          <div className="fixed inset-0 z-[9999] bg-red-950/90 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-black border border-red-900 p-8 rounded-[32px] w-full max-w-md text-center shadow-[0_0_100px_rgba(220,38,38,0.3)]"
            >
              <Heart size={48} className="text-red-600 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-black text-red-500 mb-2">生命体征已消失</h2>
              <p className="text-slate-400 text-sm mb-8">黑暗正在吞噬你的意识...</p>

              <div className="space-y-3">
                <button
                  onClick={handleStruggle}
                  disabled={rescueReqId !== null}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {rescueReqId ? '正在等待向导回应...' : '挣扎 (向区域内治疗向导求救)'}
                </button>
                <button
                  onClick={() => {
                    setIsDying(false);
                    setShowDeathForm('death');
                  }}
                  className="w-full py-4 bg-slate-900 text-slate-400 rounded-2xl font-bold hover:bg-slate-800 transition-colors"
                >
                  拥抱死亡 (生成墓碑)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 右下功能按钮 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <button
          onClick={fetchGraveyard}
          className="p-3.5 bg-slate-900/80 backdrop-blur-md border border-slate-600 text-slate-300 rounded-full hover:text-white hover:bg-sky-600 hover:border-sky-400 hover:scale-110 transition-all shadow-lg group relative"
        >
          <Cross size={20} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
            世界公墓
          </span>
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-3.5 bg-slate-900/80 backdrop-blur-md border border-slate-600 text-slate-300 rounded-full hover:text-white hover:bg-slate-700 hover:scale-110 transition-all shadow-lg group relative"
        >
          <Settings size={20} />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
            设置/谢幕
          </span>
        </button>
      </div>

      {/* 左下 对戏聊天按钮（始终显示） */}
      <div className="fixed bottom-6 left-6 z-[160]">
        <button
          onClick={() => {
            if (!rpSessionId) {
              showToast('当前没有活跃对戏会话');
              return;
            }
            setRPWindowOpen((v) => !v);
            setRPPing(false);
          }}
          className={`relative px-4 py-3 rounded-2xl font-black text-xs shadow-xl transition-all ${
            rpSessionId ? 'bg-sky-600 text-white hover:bg-sky-500' : 'bg-slate-700 text-slate-300'
          }`}
        >
          对戏聊天{rpPeerName ? ` · ${rpPeerName}` : ''}
          {rpPing && !rpWindowOpen && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border border-white" />
          )}
        </button>
      </div>

      {/* 设置弹窗 */}
      <AnimatePresence>
        {showSettings && !showDeathForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl p-4 shadow-2xl z-50"
          >
            <h4 className="text-xs font-black text-slate-400 uppercase mb-3 px-2">命运抉择</h4>
            <div className="space-y-2">
              <button
                onClick={() => setShowDeathForm('death')}
                className="w-full flex items-center gap-3 p-3 text-sm font-bold text-rose-400 bg-rose-500/10 rounded-xl hover:bg-rose-500/20 transition-colors"
              >
                <Skull size={16} /> 申请谢幕 (死亡)
              </button>
              {user.role !== '鬼魂' && (
                <button
                  onClick={() => setShowDeathForm('ghost')}
                  className="w-full flex items-center gap-3 p-3 text-sm font-bold text-violet-400 bg-violet-500/10 rounded-xl hover:bg-violet-500/20 transition-colors"
                >
                  <Skull size={16} className="opacity-50" /> 转化鬼魂 (换皮)
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 公墓 */}
      <AnimatePresence>
        {showGraveyard && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-[32px] w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <Cross className="text-slate-500" /> 世界公墓
                </h2>
                <button onClick={() => setShowGraveyard(false)} className="text-slate-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950">
                {tombstones.length === 0 ? (
                  <div className="text-center py-20 text-slate-600 font-bold tracking-widest">目前无人长眠于此</div>
                ) : (
                  tombstones.map((t) => (
                    <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-black text-slate-200">{t.name} 的墓碑</h3>
                          <div className="text-[10px] uppercase font-bold text-slate-500 mt-1 space-x-2">
                            <span>生前: {t.role}</span>
                            <span>
                              {t.mentalRank}/{t.physicalRank}
                            </span>
                            {t.spiritName && <span>精神体: {t.spiritName}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => loadComments(t.id)}
                          className="text-xs font-bold text-sky-500 bg-sky-500/10 px-3 py-1.5 rounded-lg hover:bg-sky-500/20"
                        >
                          {expandedTombstone === t.id ? '收起留言' : '献花/留言'}
                        </button>
                      </div>

                      <p className="text-sm text-slate-400 bg-slate-950 p-4 rounded-xl border border-slate-800/50 italic">"{t.deathDescription}"</p>

                      <AnimatePresence>
                        {expandedTombstone === t.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-slate-800">
                              <div className="space-y-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                                {comments.length === 0 && <div className="text-xs text-slate-600">还没有人留下只言片语...</div>}
                                {comments.map((c) => (
                                  <div key={c.id} className="group flex justify-between items-start p-2 bg-slate-950/50 rounded-lg">
                                    <div className="text-xs">
                                      <span className="font-bold text-sky-400 mr-2">{c.userName}:</span>
                                      <span className="text-slate-300">{c.content}</span>
                                    </div>
                                    {c.userId === user.id && (
                                      <button
                                        onClick={() => deleteComment(c.id, t.id)}
                                        className="text-rose-500/50 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  placeholder="写下你的悼词..."
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                                />
                                <button
                                  onClick={() => addComment(t.id)}
                                  className="bg-sky-600 text-white p-2 rounded-lg hover:bg-sky-500 transition-colors"
                                >
                                  <Send size={14} />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 对戏窗口（可开关，不再强制弹） */}
      <AnimatePresence>
        {rpSessionId && rpWindowOpen && (
          <RoleplayWindow
            sessionId={rpSessionId}
            currentUser={user}
            onClose={() => setRPWindowOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* 死亡表单 */}
      {showDeathForm && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-slate-700 p-8 rounded-3xl w-full max-w-lg shadow-2xl"
          >
            <h2 className="text-2xl font-black text-white mb-2">
              {showDeathForm === 'death' ? '谢幕与墓志铭' : '化鬼契约'}
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              {showDeathForm === 'death'
                ? '写下你的死因与墓志铭，提交后将生成世界墓碑，数据将被剥夺。'
                : '放弃肉身与精神体，以灵体状态游荡于世。'}
            </p>
            <textarea
              value={deathText}
              onChange={(e) => setDeathText(e.target.value)}
              placeholder="在此书写你的落幕之辞..."
              className="w-full h-32 p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 outline-none focus:border-sky-500/50 mb-6 text-sm resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeathForm(null)}
                className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700"
              >
                取消
              </button>
              <button
                onClick={handleSubmitDeath}
                className="flex-[2] py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-500 shadow-lg"
              >
                提交审核
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
