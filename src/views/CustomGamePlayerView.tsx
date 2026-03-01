import React, { useEffect, useMemo, useState } from 'react';
import { User } from '../types';
import {
  CreatorMapEditor,
  CreatorMapJson,
  CreatorDropJson
} from './CreatorMapEditor';

interface Props {
  user: User;
  showToast: (msg: string) => void;
  onEnterRun?: (runId: string) => void;
}

const defaultMap: CreatorMapJson = {
  nodes: [],
  items: [],
  npcs: [],
  meta: {
    mapName: '',
    announcementText: '',
    layoutRuleText: '',
    currencyName: '灾厄币',
    winRule: '结束时货币最高者胜'
  }
};

const defaultDrop: CreatorDropJson = {
  defaultNodeId: undefined,
  points: []
};

export function CustomGamePlayerView({ user, showToast, onEnterRun }: Props) {
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [ruleText, setRuleText] = useState('');

  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');

  const [mapJson, setMapJson] = useState<CreatorMapJson>(defaultMap);
  const [dropPointJson, setDropPointJson] = useState<CreatorDropJson>(defaultDrop);

  const [voteStatus, setVoteStatus] = useState<any>(null);

  const selectedGame = useMemo(
    () => games.find((g) => g.id === selectedGameId) || null,
    [games, selectedGameId]
  );

  const loadMine = async () => {
    const res = await fetch(`/api/custom-games/my/${user.id}`);
    const data = await res.json();
    if (data.success) setGames(data.games || []);
  };

  const loadLatestMap = async (gameId: string) => {
    const res = await fetch(`/api/custom-games/${gameId}/map/latest`);
    const data = await res.json();
    if (data.success && data.map) {
      setMapJson(data.map.mapJson || defaultMap);
      setDropPointJson(data.map.dropPointJson || defaultDrop);
    } else {
      setMapJson(defaultMap);
      setDropPointJson(defaultDrop);
    }
  };

  const loadVoteStatus = async (gameId: string) => {
    const res = await fetch(`/api/custom-games/${gameId}/start-vote/status`);
    const data = await res.json();
    if (data.success) setVoteStatus(data);
  };

  useEffect(() => {
    loadMine();
  }, []);

  useEffect(() => {
    if (!selectedGameId) return;
    loadLatestMap(selectedGameId);
  }, [selectedGameId]);

  useEffect(() => {
    if (selectedGame?.status === 'START_VOTING') {
      loadVoteStatus(selectedGame.id);
      const t = setInterval(() => loadVoteStatus(selectedGame.id), 3000);
      return () => clearInterval(t);
    } else {
      setVoteStatus(null);
    }
  }, [selectedGame?.id, selectedGame?.status]);

  const submitIdea = async () => {
    if (!title.trim()) return showToast('游戏名称必填');

    const res = await fetch('/api/custom-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        theme,
        ruleText,
        creatorId: user.id,
        creatorName: user.name,
        creatorType: 'player'
      })
    });
    const data = await res.json();
    if (!res.ok || data.success === false) return showToast(data.message || '提交失败');

    showToast('创意已提交，等待审核');
    setTitle('');
    setTheme('');
    setRuleText('');
    loadMine();
  };

  const submitMap = async () => {
    if (!selectedGameId) return showToast('请选择游戏');
    if (!mapJson.nodes?.length) return showToast('请先绘制至少一个地图点位');

    const res = await fetch(`/api/custom-games/${selectedGameId}/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        editorId: user.id,
        mapJson,
        dropPointJson,
        announcementText: mapJson.meta?.announcementText || '',
        layoutRuleText: mapJson.meta?.layoutRuleText || ruleText
      })
    });
    const data = await res.json();
    if (!res.ok || data.success === false) return showToast(data.message || '地图提交失败');

    showToast(`地图 v${data.version} 已提交审核`);
    loadMine();
  };

  const requestStart = async () => {
    if (!selectedGameId) return showToast('请选择游戏');
    const res = await fetch(`/api/custom-games/${selectedGameId}/request-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId: user.id, requesterName: user.name })
    });
    const data = await res.json();
    if (!res.ok || data.success === false) return showToast(data.message || '开局申请失败');
    showToast('已提交开局申请，等待管理员开启全服投票');
    loadMine();
  };

  const castVote = async (vote: 'yes' | 'no') => {
    if (!selectedGameId) return showToast('请选择游戏');
    const res = await fetch(`/api/custom-games/${selectedGameId}/start-vote/cast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId: user.id, vote })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) return showToast(data.message || '投票失败');
    showToast(vote === 'yes' ? '已投票同意' : '已投票反对');
    loadVoteStatus(selectedGameId);
  };

  const enterRunning = async () => {
    if (!selectedGameId) return showToast('请选择游戏');
    const res = await fetch(`/api/custom-games/${selectedGameId}/run/active`);
    const data = await res.json();
    if (!data.success || !data.run?.id) return showToast('当前没有运行中的副本');

    const runId = data.run.id;
    await fetch(`/api/custom-runs/${runId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });

    showToast('已进入副本');
    onEnterRun?.(runId);
  };

  return (
    <div className="space-y-4">
      {/* 创意提交 */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
        <h3 className="font-black text-white mb-2">我想开游戏</h3>
        <input
          className="w-full mb-2 p-2 rounded bg-slate-950 border border-slate-700 text-white"
          placeholder="游戏名称"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="w-full mb-2 p-2 rounded bg-slate-950 border border-slate-700 text-white"
          placeholder="游戏主题"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        />
        <textarea
          className="w-full h-24 mb-2 p-2 rounded bg-slate-950 border border-slate-700 text-white"
          placeholder="规则设定"
          value={ruleText}
          onChange={(e) => setRuleText(e.target.value)}
        />
        <button onClick={submitIdea} className="px-4 py-2 rounded bg-sky-600 text-white font-bold">
          提交创意审核
        </button>
      </div>

      {/* 我的项目 */}
      <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4">
        <h3 className="font-black text-white mb-2">我的项目</h3>

        <select
          className="w-full mb-2 p-2 rounded bg-slate-950 border border-slate-700 text-white"
          value={selectedGameId}
          onChange={(e) => setSelectedGameId(e.target.value)}
        >
          <option value="">请选择项目</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}（{g.status}）
            </option>
          ))}
        </select>

        {selectedGame && (
          <div className="text-xs text-slate-300 mb-3">
            当前状态：<span className="font-black">{selectedGame.status}</span> / 版本 v{selectedGame.currentVersion}
          </div>
        )}

        {/* 地图编辑器 */}
        {selectedGameId ? (
          <CreatorMapEditor
            value={mapJson}
            dropValue={dropPointJson}
            onChange={(m, d) => {
              setMapJson(m);
              setDropPointJson(d);
            }}
          />
        ) : (
          <div className="text-slate-400 text-sm">请选择一个项目后开始编辑地图</div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={submitMap} className="px-4 py-2 rounded bg-indigo-600 text-white font-bold">
            提交地图审核
          </button>
          <button onClick={requestStart} className="px-4 py-2 rounded bg-emerald-600 text-white font-bold">
            申请开启游戏
          </button>
          <button onClick={loadMine} className="px-4 py-2 rounded bg-slate-700 text-white font-bold">
            刷新
          </button>
        </div>

        {/* 投票区 */}
        {selectedGame?.status === 'START_VOTING' && (
          <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-amber-600/40">
            <div className="text-amber-300 font-black mb-2">全服投票进行中</div>
            <div className="text-xs text-slate-300 mb-2">
              YES: {voteStatus?.yesCount ?? '-'} / NO: {voteStatus?.noCount ?? '-'} / 在线: {voteStatus?.onlineCount ?? '-'} / 门槛: {voteStatus?.threshold ?? '-'}
            </div>
            <div className="flex gap-2">
              <button onClick={() => castVote('yes')} className="flex-1 py-2 rounded bg-emerald-600 text-white font-bold">
                投同意票
              </button>
              <button onClick={() => castVote('no')} className="flex-1 py-2 rounded bg-rose-600 text-white font-bold">
                投反对票
              </button>
            </div>
          </div>
        )}

        {/* 运行中可进入 */}
        {selectedGame?.status === 'RUNNING' && (
          <button onClick={enterRunning} className="mt-4 w-full py-2 rounded bg-rose-600 text-white font-black">
            进入运行中的副本
          </button>
        )}
      </div>
    </div>
  );
}
