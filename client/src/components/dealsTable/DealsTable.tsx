import { useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { Deal, FilterField, SearchFilterParams } from '../../types';
import SearchFilter from '../SearchFilter';
import TableWrapper from '../TableWrapper';
import DealsTableBody from './DealsTableBody';

const DealsTable: React.FC = () => {
  const { role, userId } = useStore();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hasMore, setHasMore] = useState(true);
  const [searchParams, setSearchParams] = useState<SearchFilterParams>({});
  const pageSize = 10;

  const filterFields: FilterField[] = [
    {
      field: 'status',
      label: 'Статус',
      type: 'select',
      options: [
        { value: 'all', label: 'Все' },
        { value: 'pending', label: 'В обработке' },
        { value: 'completed', label: 'Завершённые' },
        { value: 'blocked', label: 'Заблокированные' },
        { value: 'expired', label: 'Просроченные' },
      ],
    },
    { field: 'createdAt', label: 'Дата создания', type: 'dateRange' },
  ];

  const fetchDeals = async (pageNum: number, append: boolean = false, params: SearchFilterParams = {}) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/deals', {
        params: { page: pageNum, pageSize, ...params, status: params.status === 'all' ? undefined : params.status },
      });
      const { data, total } = response.data;
      setDeals((prev) => (append ? [...prev, ...data] : data));
      setHasMore(pageNum * pageSize < total);
      setLoading(false);
    } catch (error) {
      console.error('Error loading deals:', error);
      setError('Ошибка при загрузке обменов');
      setLoading(false);
    }
  };

  const handleSearch = (params: SearchFilterParams) => {
    setStatusFilter(params.status || 'all');
    setSearchParams(params);
    fetchDeals(1, false, params);
  };

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

  const filteredDeals = role === 'admin' ? deals : deals.filter((deal) => deal.offer?.warrantHolder?.id === userId);

  return (
      <div>
        <SearchFilter filterFields={filterFields} onSearch={handleSearch} />
        <TableWrapper
            items={filteredDeals}
            fetchItems={fetchDeals}
            searchParams={searchParams}
            renderTableBody={(items, isMobile) => (
                <table className="w-full border-collapse">
                  {!isMobile && (
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
                  )}
                  <DealsTableBody
                      deals={items}
                      role={role}
                      statusFilter={statusFilter}
                      onComplete={handleCompleteDeal}
                      isMobile={isMobile}
                  />
                </table>
            )}
            loading={loading}
            error={error}
            hasMore={hasMore}
            pageSize={pageSize}
        />
      </div>
  );
};

export default DealsTable;