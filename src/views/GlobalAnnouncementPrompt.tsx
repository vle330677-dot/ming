import React, { useEffect, useRef, useState } from 'react';
import { User } from '../types';

interface Props {
  user: User;
  showToast: (msg: string) => void;
  onEnterRun: (runId: string) => void;
}

function parseExtra(extraJson: string | null) {
  try {
    return extraJson ? JSON.parse(extraJson) : {};
  } catch {
    return {};
  }
}

export function GlobalAnnouncementPrompt({ user, showToast, onEnterRun }: Props) {
  const [latest, setLatest] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [voteStat, setVoteStat] = useState<any>(null);
  const seenRef = useRef<string>('');

  // 在线心跳（投票在线人数统计）
  useEffect(() => {
    const hb = setInterval(() => {
      fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(hb);
  }, [user.id]);

  // 拉公告（只关心 vote_open / game_start）
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/announcements');
        const data = await res.json();
        if (!data.success) return;

        const target = (data.announcements || []).find((x: any) =>
          x.type === 'vote_open' || x.type === 'game_start'
        );
        if (!target) return;

        if (seenRef.current !== target.id) {
          seenRef.current = target.id;
          setLatest(target);
          setVisible(true);
          setVoteStat(null);
        }
      } catch {
        // ignore
      }
    };

    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  // 如果是投票公告，轮询票数
  useEffect(() => {
    if (!latest || latest.type !== 'vote_open') return;
    const extra = parseExtra(latest.extraJson);
    const gameId = extra.gameId;
    if (!gameId) return;

    const pollVote = async () => {
      const res = await fetch(`/api/custom-games/${gameId}/start-vote/status`);
      const data = await res.json();
      if (data.success) setVoteStat(data);
    };

    pollVote();
    const t = setInterval(pollVote, 3000);
    return () => clearInterval(t);
  }, [latest]);

  if (!visible || !latest) return null;

  const extra = parseExtra(latest.extraJson);

  const renderVoteOpen = () => {
    const gameId = extra.gameId;
    if (!gameId) return <p className="text-sm text-rose-500">公告缺少 gameId</p>;

    const castVote = async (vote: 'yes' | 'no') => {
      const res = await fetch(`/api/custom-games/${gameId}/start-vote/cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: user.id, vote })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        showToast(data.message || '投票失败');
        return;
      }
      showToast(vote === 'yes' ? '你已投票：同意' : '你已投票：反对');
    };

    return (
      <>
        <h3 className="text-xl font-black mb-2">{latest.title}</h3>
        <p className="text-sm text-slate-600 mb-3">{latest.content}</p>

        <div className="text-xs rounded bg-slate-50 p-3 mb-4">
          <div>YES：{voteStat?.yesCount ?? '-'}</div>
          <div>NO：{voteStat?.noCount ?? '-'}</div>
          <div>在线：{voteStat?.onlineCount ?? '-'}</div>
          <div>通过门槛：{voteStat?.threshold ?? '-'}</div>
        </div>

        <div className="flex gap-2">
          <button className="flex-1 py-2 rounded bg-emerald-600 text-white font-bold" onClick={() => castVote('yes')}>
            同意进入
          </button>
          <button className="flex-1 py-2 rounded bg-rose-600 text-white font-bold" onClick={() => castVote('no')}>
            反对
          </button>
        </div>

        <button className="w-full mt-2 py-2 rounded bg-slate-200 font-bold" onClick={() => setVisible(false)}>
          关闭
        </button>
      </>
    );
  };

  const renderGameStart = () => {
    const runId = extra.runId;
    return (
      <>
        <h3 className="text-xl font-black mb-2">{latest.title}</h3>
        <p className="text-sm text-slate-600 mb-4">{latest.content}</p>
        <div className="flex gap-2">
          <button className="flex-1 py-2 rounded bg-slate-200 font-bold" onClick={() => setVisible(false)}>
            暂不进入
          </button>
          <button
            className="flex-1 py-2 rounded bg-rose-600 text-white font-bold"
            onClick={async () => {
              if (!runId) return showToast('runId 缺失');
              await fetch(`/api/custom-runs/${runId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
              });
              setVisible(false);
              onEnterRun(runId);
            }}
          >
            进入副本
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        {latest.type === 'vote_open' ? renderVoteOpen() : renderGameStart()}
      </div>
    </div>
  );
}
