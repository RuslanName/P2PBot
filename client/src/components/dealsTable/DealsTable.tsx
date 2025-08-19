import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { Deal } from '../../types';
import DealsTableBody from './DealsTableBody';

const DealsTable: React.FC = () => {
  const { role, userId } = useStore();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;
  const observer = useRef<IntersectionObserver | null>(null);

  const fetchDeals = async (pageNum: number, append: boolean = false) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/deals', {
        params: { page: pageNum, pageSize }
      });
      const { data, total } = response.data;
      setDeals(prev => append ? [...prev, ...data] : data);
      setHasMore(pageNum * pageSize < total);
      setLoading(false);
    } catch (error) {
      console.error('Error loading deals:', error);
      setError('Ошибка при загрузке обменов');
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchDeals(1);
  }, [statusFilter]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage(prev => {
          const nextPage = prev + 1;
          fetchDeals(nextPage, true);
          return nextPage;
        });
      }
    });

    if (deals.length > 0) {
      const lastDealElement = document.querySelector(`.deal-item-${deals[deals.length - 1].id}`);
      if (lastDealElement) {
        observer.current.observe(lastDealElement);
      }
    }

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [hasMore, loading, deals]);

  const handleCompleteDeal = async (id: number) => {
    setError('');
    try {
      const response = await axios.put(`/api/deals/${id}`, { status: 'completed' });
      setDeals(deals.map((deal) => (deal.id === id ? response.data : deal)));
    } catch (error) {
      setError('Ошибка при завершении обмена');
      console.error('Error completing deal:', error);
    }
  };

  const filteredDeals = role === 'admin'
      ? deals.filter(deal => statusFilter === 'all' || deal.status === statusFilter)
      : deals.filter(deal => deal.offer?.warrantHolder?.id === userId);

  return (
      <div className="table-responsive">
        {role === 'admin' && (
            <div className="mb-4">
              <label className="block text-gray-700">Фильтр по статусу</label>
              <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setDeals([]);
                  }}
                  className="w-full p-2 border rounded"
              >
                <option value="all">Все</option>
                <option value="pending">В обработке</option>
                <option value="completed">Завершённые</option>
                <option value="blocked">Заблокированные</option>
                <option value="expired">Просроченные</option>
              </select>
            </div>
        )}
        {filteredDeals.length === 0 && !loading && (
            <p className="text-center text-gray-500 mt-4">На данный момент тут ничего нет</p>
        )}
        {isMobile ? (
            <div className="card-stack">
              <DealsTableBody
                  deals={filteredDeals}
                  role={role}
                  statusFilter={statusFilter}
                  onComplete={handleCompleteDeal}
                  isMobile={isMobile}
              />
            </div>
        ) : (
            <table className="w-full border-collapse">
              <thead>
              <tr className="bg-gray-200">
                <th className="border p-2">ID</th>
                <th className="border p-2">Клиент</th>
                <th className="border p-2">Оферта</th>
                <th className="border p-2">Ордеродержатель</th>
                {role === 'admin' && <th className="border p-2">Реферер</th>}
                <th className="border p-2">Сумма</th>
                <th className="border p-2">Фиатная валюта</th>
                <th className="border p-2">Наценка (%)</th>
                <th className="border p-2">Реквизиты клиента</th>
                <th className="border p-2">ID транзакции</th>
                <th className="border p-2">Подтверждено клиентом</th>
                <th className="border p-2">Создано</th>
                {role === 'admin' && statusFilter === 'all' && <th className="border p-2">Статус</th>}
                {role === 'admin' && (statusFilter === 'blocked' || statusFilter === 'all') && (
                    <th className="border p-2">Действия</th>
                )}
              </tr>
              </thead>
              <DealsTableBody
                  deals={filteredDeals}
                  role={role}
                  statusFilter={statusFilter}
                  onComplete={handleCompleteDeal}
                  isMobile={isMobile}
              />
            </table>
        )}
        {loading && <p className="text-center">Загрузка...</p>}
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
  );
};

export default DealsTable;