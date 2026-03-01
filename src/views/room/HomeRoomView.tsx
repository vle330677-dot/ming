import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, DoorOpen, Save, BedDouble, Download, ShieldCheck
} from 'lucide-react';

type HomeLocation = 'sanctuary' | 'slums' | 'rich_area';

interface UserLite {
  id: number;
  name?: string;
  role?: string;
  age?: number;
  gold?: number;
}

export interface HomeRoomDetail {
  ownerId: number;
  ownerName: string;
  avatarUrl?: string;
  job?: string;
  role?: string;
  homeLocation?: HomeLocation | string;
  bgImage?: string;
  description?: string;
  visible?: boolean;      // 房间是否公开
  allowVisit?: boolean;   // 是否允许访客进入
}

interface Props {
  currentUser: UserLite;
  room: HomeRoomDetail;
  sourceMap: HomeLocation;
  onBack: () => void;
  showToast: (msg: string) => void;
  onSaved?: (next: HomeRoomDetail) => void;
  refreshGlobalData?: () => void;
}

/** 初始家园规则 */
export function deriveInitialHomeLocation(user: UserLite): HomeLocation {
  const role = user.role || '';
  const age = user.age || 0;
  const gold = user.gold || 0;

  // 未分化者固定圣所（或年龄 < 16）
  if (role === '未分化' || age < 16) return 'sanctuary';

  // >=16 且不是未分化者：按金币
  return gold > 9999 ? 'rich_area' : 'slums';
}

const THEME: Record<HomeLocation, {
  name: string;
  backText: string;
  defaultBg: string;
  chip: string;
  overlay: string;
  card: string;
}> = {
  sanctuary: {
    name: '圣所',
    backText: '返回圣所',
    defaultBg: '/room/圣所.png',
    chip: 'text-amber-200',
    overlay: 'bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-yellow-900/30',
    card: 'bg-amber-950/30 border-amber-700/40'
  },
  slums: {
    name: '西市',
    backText: '返回西市',
    defaultBg: '/room/西市.png',
    chip: 'text-orange-200',
    overlay: 'bg-gradient-to-br from-stone-950/50 via-orange-950/20 to-black/60',
    card: 'bg-stone-900/40 border-orange-700/40'
  },
  rich_area: {
    name: '东市',
    backText: '返回东市',
    defaultBg: '/room/东市.png',
    chip: 'text-cyan-100',
    overlay: 'bg-gradient-to-br from-sky-950/35 via-emerald-950/15 to-slate-950/45',
    card: 'bg-slate-900/35 border-sky-700/40'
  }
};

function normalizeHomeLocation(v: any): HomeLocation | null {
  if (v === 'sanctuary' || v === 'slums' || v === 'rich_area') return v;
  return null;
}

export default function HomeRoomView({
  currentUser,
  room,
  sourceMap,
  onBack,
  showToast,
  onSaved,
  refreshGlobalData
}: Props) {
  const isOwner = Number(currentUser.id) === Number(room.ownerId);
  const actualLoc = normalizeHomeLocation(room.homeLocation) || sourceMap;
  const theme = THEME[actualLoc];

  const [editDesc, setEditDesc] = useState(room.description || '');
  const [editBg, setEditBg] = useState(room.bgImage || '');
  const [editVisible, setEditVisible] = useState(room.visible !== false);
  const [editAllowVisit, setEditAllowVisit] = useState(room.allowVisit !== false);
  const [saving, setSaving] = useState(false);

  const canVisitorView = useMemo(() => {
    if (isOwner) return true;
    if (room.visible === false) return false;
    if (room.allowVisit === false) return false;
    return true;
  }, [isOwner, room.visible, room.allowVisit]);

  const bg = editBg?.trim() || room.bgImage || theme.defaultBg;

  const saveRoomSettings = async () => {
    if (!isOwner || saving) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/rooms/${room.ownerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}`
        },
        body: JSON.stringify({
          visible: editVisible,
          allowVisit: editAllowVisit,
          roomDescription: editDesc,
          roomBgImage: editBg
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        return showToast(data.message || '保存失败');
      }

      const next = {
        ...room,
        description: editDesc,
        bgImage: editBg,
        visible: editVisible,
        allowVisit: editAllowVisit
      };
      onSaved?.(next);
      showToast('家园设置已保存');
    } catch (e) {
      console.error(e);
      showToast('网络错误，保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRest = async () => {
    if (!isOwner) return showToast('只有房主可以在自己的家园休息。');
    try {
      const res = await fetch('/api/tower/rest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (res.ok) {
        showToast('休息完成，体力与 MP 已恢复。');
        refreshGlobalData?.();
      } else {
        showToast('休息失败，请稍后重试');
      }
    } catch {
      showToast('网络错误，休息失败');
    }
  };

  const exportReplayTxt = async () => {
    try {
      const res = await fetch(`/api/rooms/${room.ownerId}/replays/export?format=txt`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('USER_TOKEN') || ''}` }
      });
      if (!res.ok) return showToast('导出失败：暂无记录或接口未开启');

      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${room.ownerName}-家园回顾.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('TXT 已导出');
    } catch {
      showToast('导出失败');
    }
  };

  if (!canVisitorView) {
    return (
      <div className="fixed inset-0 z-[220] bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
          <p className="text-lg font-black mb-2">该家园暂不开放访问</p>
          <p className="text-sm text-slate-400 mb-4">房主已关闭对外访问权限。</p>
          <button onClick={onBack} className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600">
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[220] bg-slate-950 text-white">
      <div className="absolute inset-0">
        <img src={bg} className="w-full h-full object-cover opacity-45" alt="home-bg" />
      </div>
      <div className={`absolute inset-0 ${theme.overlay}`} />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 p-6 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-600 font-bold flex items-center gap-2"
          >
            <ArrowLeft size={16} /> {theme.backText}
          </button>

          <div className={`text-sm font-bold flex items-center gap-2 ${theme.chip}`}>
            <DoorOpen size={16} />
            {room.ownerName} 的家园（{theme.name}）
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
          <div className={`lg:col-span-2 rounded-2xl border p-5 backdrop-blur ${theme.card}`}>
            <h3 className="text-xl font-black mb-3">家园信息</h3>
            <p className="text-slate-100 whitespace-pre-wrap leading-relaxed">
              {room.description || '房主还没有写家园介绍。'}
            </p>
          </div>

          <div className={`rounded-2xl border p-4 backdrop-blur ${theme.card}`}>
            <h4 className="font-black mb-3">家园面板</h4>
            <p className="text-xs text-slate-200 mb-1">职位：{room.job || '无'}</p>
            <p className="text-xs text-slate-300 mb-3">身份：{room.role || '未知'}</p>

            {isOwner ? (
              <div className="space-y-2">
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full h-24 p-2 rounded bg-slate-950 border border-slate-700 text-xs"
                  placeholder="设置访客看到的家园介绍..."
                />
                <input
                  value={editBg}
                  onChange={(e) => setEditBg(e.target.value)}
                  className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-xs"
                  placeholder={`背景图 URL（留空使用默认：${theme.defaultBg}）`}
                />
                <label className="text-xs flex items-center gap-2">
                  <input type="checkbox" checked={editVisible} onChange={(e) => setEditVisible(e.target.checked)} />
                  房间公开可见
                </label>
                <label className="text-xs flex items-center gap-2">
                  <input type="checkbox" checked={editAllowVisit} onChange={(e) => setEditAllowVisit(e.target.checked)} />
                  允许访客进入
                </label>

                <button
                  onClick={saveRoomSettings}
                  disabled={saving}
                  className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Save size={14} /> {saving ? '保存中...' : '保存设置'}
                </button>

                <button
                  onClick={handleRest}
                  className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2"
                >
                  <BedDouble size={14} /> 休息（回满体力/MP）
                </button>

                <button
                  onClick={exportReplayTxt}
                  className="w-full py-2 rounded bg-slate-700 hover:bg-slate-600 font-bold flex items-center justify-center gap-2"
                >
                  <Download size={14} /> 回顾导出 TXT
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <ShieldCheck size={14} />
                访客模式：仅可查看家园展示与介绍
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
