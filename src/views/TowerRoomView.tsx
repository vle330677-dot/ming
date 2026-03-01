import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

// ====== 你项目里请替换成真实 API ======
import {
  getTowerRoomList, // (towerId: string) => Promise<TowerRoom[]>
  removeTowerRoom,  // (roomId: string) => Promise<void>
} from '@/services/towerRoomService';

const { Text } = Typography;
const { confirm } = Modal;

type RoomStatus = 'vacant' | 'occupied' | 'reserved' | 'maintenance';

export interface TowerRoom {
  id: string;
  code: string;          // 房号/编码
  name?: string;         // 房间名（可选）
  floor: number;         // 楼层
  area?: number;         // 面积
  roomType?: string;     // 户型/用途
  status: RoomStatus;
  tenantName?: string;   // 租户
  updatedAt?: string;
}

interface TowerRoomViewProps {
  towerId: string;
  loading?: boolean; // 外部可选 loading（会和内部 loading 合并）
  onCreateRoom?: () => void;
  onEditRoom?: (room: TowerRoom) => void;
  onViewRoom?: (room: TowerRoom) => void;
  /** 删除成功后的回调（可选） */
  onDeleted?: (roomId: string) => void;
}

const STATUS_META: Record<RoomStatus, { text: string; color: string }> = {
  vacant: { text: '空置', color: 'default' },
  occupied: { text: '已入住', color: 'success' },
  reserved: { text: '预留', color: 'processing' },
  maintenance: { text: '维修中', color: 'warning' },
};

const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

const TowerRoomView: React.FC<TowerRoomViewProps> = ({
  towerId,
  loading: outerLoading = false,
  onCreateRoom,
  onEditRoom,
  onViewRoom,
  onDeleted,
}) => {
  const [listLoading, setListLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<TowerRoom[]>([]);

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string | 'all'>('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const mergedLoading = outerLoading || listLoading;

  const loadData = useCallback(async () => {
    if (!towerId) return;
    setListLoading(true);
    try {
      const data = await getTowerRoomList(towerId);
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      message.error('房间数据加载失败');
      setRooms([]);
    } finally {
      setListLoading(false);
    }
  }, [towerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const roomTypeOptions = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => r.roomType && set.add(r.roomType));
    return Array.from(set).sort();
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    const kw = keyword.trim().toLowerCase();

    return rooms.filter((room) => {
      const hitKeyword =
        !kw ||
        room.code?.toLowerCase().includes(kw) ||
        room.name?.toLowerCase().includes(kw) ||
        room.tenantName?.toLowerCase().includes(kw) ||
        String(room.floor).includes(kw);

      const hitStatus = statusFilter === 'all' || room.status === statusFilter;
      const hitType = typeFilter === 'all' || room.roomType === typeFilter;

      return hitKeyword && hitStatus && hitType;
    });
  }, [rooms, keyword, statusFilter, typeFilter]);

  // 过滤变化后，自动回到第一页
  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter, typeFilter]);

  const handleDelete = useCallback(
    (room: TowerRoom) => {
      confirm({
        title: `确认删除房间「${room.code}」吗？`,
        icon: <ExclamationCircleOutlined />,
        content: '删除后不可恢复，请谨慎操作。',
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            setDeleteLoadingId(room.id);
            await removeTowerRoom(room.id);
            message.success('删除成功');
            setRooms((prev) => prev.filter((x) => x.id !== room.id));
            onDeleted?.(room.id);
          } catch (err) {
            console.error(err);
            message.error('删除失败，请稍后重试');
          } finally {
            setDeleteLoadingId(null);
          }
        },
      });
    },
    [onDeleted],
  );

  const columns: ColumnsType<TowerRoom> = useMemo(
    () => [
      {
        title: '房号',
        dataIndex: 'code',
        key: 'code',
        width: 120,
        fixed: 'left',
        render: (_, r) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => onViewRoom?.(r)}>
            {r.code}
          </Button>
        ),
      },
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: 160,
        render: (v: string | undefined) => v || '-',
      },
      {
        title: '楼层',
        dataIndex: 'floor',
        key: 'floor',
        width: 90,
        sorter: (a, b) => a.floor - b.floor,
      },
      {
        title: '类型',
        dataIndex: 'roomType',
        key: 'roomType',
        width: 120,
        render: (v: string | undefined) => v || '-',
      },
      {
        title: '面积(㎡)',
        dataIndex: 'area',
        key: 'area',
        width: 110,
        sorter: (a, b) => (a.area || 0) - (b.area || 0),
        render: (v: number | undefined) => (v ? v.toFixed(2) : '-'),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status: RoomStatus) => {
          const meta = STATUS_META[status] || { text: status, color: 'default' };
          return <Tag color={meta.color}>{meta.text}</Tag>;
        },
      },
      {
        title: '租户',
        dataIndex: 'tenantName',
        key: 'tenantName',
        width: 180,
        render: (v: string | undefined) => v || '-',
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (v: string | undefined) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 170,
        render: (_, room) => (
          <Space size={4}>
            <Button size="small" onClick={() => onViewRoom?.(room)}>
              查看
            </Button>
            <Button size="small" onClick={() => onEditRoom?.(room)}>
              编辑
            </Button>
            <Button
              size="small"
              danger
              loading={deleteLoadingId === room.id}
              onClick={() => handleDelete(room)}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [deleteLoadingId, handleDelete, onEditRoom, onViewRoom],
  );

  return (
    <Card
      title="房间列表"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={mergedLoading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreateRoom}>
            新建房间
          </Button>
        </Space>
      }
    >
      {/* 筛选区 */}
      <Space wrap style={{ marginBottom: 12 }}>
        <Input
          allowClear
          placeholder="搜索房号/名称/租户/楼层"
          prefix={<SearchOutlined />}
          style={{ width: 280 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <Select<RoomStatus | 'all'>
          style={{ width: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: '全部状态', value: 'all' },
            { label: '空置', value: 'vacant' },
            { label: '已入住', value: 'occupied' },
            { label: '预留', value: 'reserved' },
            { label: '维修中', value: 'maintenance' },
          ]}
        />

        <Select<string | 'all'>
          style={{ width: 160 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { label: '全部类型', value: 'all' },
            ...roomTypeOptions.map((t) => ({ label: t, value: t })),
          ]}
        />

        <Text type="secondary">共 {filteredRooms.length} 条</Text>
      </Space>

      <Table<TowerRoom>
        rowKey="id"
        loading={mergedLoading}
        columns={columns}
        dataSource={filteredRooms}
        scroll={{ x: 1200 }}
        locale={{
          emptyText: <Empty description="暂无房间数据" />,
        }}
        pagination={{
          current: page,
          pageSize,
          total: filteredRooms.length,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </Card>
  );
};

export default TowerRoomView;
