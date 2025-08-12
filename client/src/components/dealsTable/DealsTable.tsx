import { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { Deal } from '../../types';
import DealsTableBody from './DealsTableBody';

const DealsTable: React.FC = () => {
  const { role, userId } = useStore();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const response = await axios.get('/api/deals');
        setDeals(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error loading dealsTable:', error);
        setError('Ошибка при загрузке сделок');
        setLoading(false);
      }
    };
    fetchDeals();
  }, []);

  const handleCompleteDeal = async (id: number) => {
    setError('');
    try {
      const response = await axios.put(`/api/deals/${id}`, { status: 'completed' });
      setDeals(deals.map((deal) => (deal.id === id ? response.data : deal)));
    } catch (error) {
      setError('Ошибка при завершении сделки');
      console.error('Error completing deal:', error);
    }
  };

  const filteredDeals = role === 'admin'
      ? deals.filter(deal => statusFilter === 'all' || deal.status === statusFilter)
      : deals.filter(deal => deal.offer?.warrantHolder?.id === userId);

  if (loading) return <p>Загрузка...</p>;

  return (
      <>
        <h2 className="text-xl font-bold mb-4">Сделки</h2>
        {role === 'admin' && (
            <div className="mb-4">
              <label className="block text-gray-700">Фильтр по статусу</label>
              <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border rounded"
              >
                <option value="all">Все</option>
                <option value="pending">В обработке</option>
                <option value="completed">Завершены</option>
                <option value="blocked">Заблокированы</option>
                <option value="expired">Просрочены</option>
              </select>
            </div>
        )}
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
          />
        </table>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </>
  );
};

export default DealsTable;