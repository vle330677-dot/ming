import React, { useEffect, useState } from 'react';

export function AdminCustomGamesView() {
  const [ideaList, setIdeaList] = useState<any[]>([]);
  const [mapList, setMapList] = useState<any[]>([]);
  const [startList, setStartList] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [voteStats, setVoteStats] = useState<Record<string, any>>({});

  const loadAll = async () => {
    const [a, b, c] = await Promise.all([
      fetch('/api/admin/custom-games/review?stage=idea').then((r) => r.json()),
      fetch('/api/admin/custom-games/review?stage=map').then((r) => r.json()),
      fetch('/api/admin/custom-games/review?stage=start').then((r) => r.json())
    ]);
    setIdeaList(a.games || []);
    setMapList(b.games || []);
    setStartList(c.games || []);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const reviewIdea = async (id: string, decision: 'approved' | 'rejected') => {
    await fetch(`/api/admin/custom-games/${id}/review-idea`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerId: 0, decision, comment })
    });
    loadAll();
  };

  const reviewMap = async (id: string, decision: 'approved' | 'rejected') => {
    await fetch(`/api/admin/custom-games/${id}/review-map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerId: 0, decision, comment })
    });
    loadAll();
  };

  const openVote = async (id: string) => {
    const res = await fetch(`/api/custom-games/${id}/start-vote/open`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      alert(data.message || '开启投票失败');
      return;
    }
    alert(`投票已开启：在线 ${data.onlineCountAtVote}，门槛 ${data.threshold}`);
    loadAll();
  };

  const fetchVoteStatus = async (id: string) => {
    const res = await fetch(`/api/custom-games/${id}/start-vote/status`);
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      setVoteStats((prev) => ({ ...prev, [id]: data }));
    }
  };

  const closeAndJudge = async (id: string) => {
    const ok = window.confirm('确认关票并判定开局结果？');
    if (!ok) return;
    const res = await fetch(`/api/custom-games/${id}/start-vote/close-and-judge`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      alert(data.message || '判定失败');
      return;
    }
    alert(data.passed ? '投票通过，副本已开启' : '投票未通过');
    loadAll();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-4">
        <h3 className="font-black mb-2">审核备注</h3>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="驳回原因（可选）"
        />
      </div>

      <Block title="创意待审" list={ideaList} onApprove={(id) => reviewIdea(id, 'approved')} onReject={(id) => reviewIdea(id, 'rejected')} />
      <Block title="地图待审" list={mapList} onApprove={(id) => reviewMap(id, 'approved')} onReject={(id) => reviewMap(id, 'rejected')} />

      <div className="bg-white border rounded-2xl p-4">
        <h3 className="font-black mb-3">开局待审</h3>
        {startList.length === 0 ? (
          <div className="text-slate-400 text-sm">暂无</div>
        ) : (
          <div className="space-y-2">
            {startList.map((g) => (
              <div key={g.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{g.title}</div>
                    <div className="text-xs text-slate-500">{g.creatorName}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openVote(g.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded font-bold">
                      开启全服投票
                    </button>
                    <button onClick={() => closeAndJudge(g.id)} className="px-3 py-1.5 bg-rose-600 text-white rounded font-bold">
                      关票并判定
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => fetchVoteStatus(g.id)} className="px-3 py-1.5 bg-slate-700 text-white rounded font-bold">
                    查看票数
                  </button>
                  {voteStats[g.id] && (
                    <div className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                      YES:{voteStats[g.id].yesCount} / NO:{voteStats[g.id].noCount} / 在线:{voteStats[g.id].onlineCount} / 门槛:{voteStats[g.id].threshold}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={loadAll} className="px-4 py-2 bg-slate-900 text-white rounded font-bold">
        刷新
      </button>
    </div>
  );
}

function Block({
  title,
  list,
  onApprove,
  onReject
}: {
  title: string;
  list: any[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="bg-white border rounded-2xl p-4">
      <h3 className="font-black mb-3">{title}</h3>
      {list.length === 0 ? (
        <div className="text-slate-400 text-sm">暂无</div>
      ) : (
        <div className="space-y-2">
          {list.map((g) => (
            <div key={g.id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-bold">{g.title}</div>
                <div className="text-xs text-slate-500">{g.creatorName} / {g.status}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onApprove(g.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded font-bold">
                  通过
                </button>
                <button onClick={() => onReject(g.id)} className="px-3 py-1.5 bg-rose-600 text-white rounded font-bold">
                  驳回
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
