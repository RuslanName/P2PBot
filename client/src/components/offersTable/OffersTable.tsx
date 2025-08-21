import { useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { Offer, FilterField, SearchFilterParams } from '../../types';
import SearchFilter from '../SearchFilter';
import TableWrapper from '../TableWrapper';
import OffersTableBody from './OffersTableBody';
import CreateOfferForm from './CreateOfferForm';

const OffersTable: React.FC = () => {
  const { role, userId } = useStore();
  const [offers, setOffers] = useState<Offer[]>([]);
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
        { value: 'open', label: 'Открытые' },
        { value: 'closed', label: 'Закрытые' },
        { value: 'blocked', label: 'Заблокированные' },
      ],
    },
    {
      field: 'type',
      label: 'Тип',
      type: 'select',
      options: [
        { value: 'all', label: 'Все' },
        { value: 'buy', label: 'Покупка' },
        { value: 'sell', label: 'Продажа' },
      ],
    },
    {
      field: 'fiatCurrency',
      label: 'Фиатная валюта',
      type: 'select',
      options: [
        { value: 'all', label: 'Все' },
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
        { value: 'RUB', label: 'RUB' },
      ],
    },
    { field: 'createdAt', label: 'Дата создания', type: 'dateRange' },
  ];

  const fetchOffers = async (pageNum: number, append: boolean = false, params: SearchFilterParams = {}) => {
    if (!hasMore && append) return;
    setLoading(true);
    setError('');
    try {
      const queryParams = {
        page: pageNum,
        pageSize,
        ...params,
        status: params.status === 'all' ? undefined : params.status,
        type: params.type === 'all' ? undefined : params.type,
        fiatCurrency: params.fiatCurrency === 'all' ? undefined : params.fiatCurrency,
      };
      const response = await axios.get('/api/offers', { params: queryParams });
      const { data, total } = response.data;
      setOffers((prev) => (append ? [...prev, ...data] : data));
      setHasMore(pageNum * pageSize < total);
      setLoading(false);
    } catch (error: any) {
      console.error('Error loading offers:', error);
      setError('Ошибка при загрузке оферт');
      setLoading(false);
      if (error.response?.status === 400) {
        setHasMore(false);
      }
    }
  };

  const handleSearch = (params: SearchFilterParams) => {
    setStatusFilter(params.status || 'all');
    setSearchParams(params);
    fetchOffers(1, false, params);
  };

  const handleCreateOffer = async (offer: {
    type: string;
    coin: string;
    fiatCurrency: string[];
    minDealAmount: number;
    maxDealAmount: number;
    markupPercent: number;
    warrantHolderPaymentDetails: string[];
  }) => {
    setError('');
    try {
      const response = await axios.post('/api/offers', offer);
      setOffers([...offers, response.data]);
    } catch (error: any) {
      setError('Ошибка при создании оферты');
      console.error('Error creating offer:', error);
    }
  };

  const handleUpdateOffer = async (id: number, updateData: Partial<Offer>) => {
    setError('');
    try {
      const response = await axios.put(`/api/offers/${id}`, updateData);
      setOffers(offers.map((offer) => (offer.id === id ? response.data : offer)));
    } catch (error: any) {
      setError('Ошибка при обновлении оферты');
      console.error('Error updating offer:', error);
    }
  };

  const handleCloseOffer = async (id: number) => {
    setError('');
    try {
      const response = await axios.put(`/api/offers/${id}`, { status: 'closed' });
      setOffers(offers.map((offer) => (offer.id === id ? response.data : offer)));
    } catch (error: any) {
      setError('Ошибка при закрытии оферты');
      console.error('Error closing offer:', error);
    }
  };

  const filteredOffers = role === 'admin' ? offers : offers.filter((offer) => offer.warrantHolder?.id === userId);

  return (
      <div>
        {role !== 'admin' && <CreateOfferForm onSubmit={handleCreateOffer} />}
        <SearchFilter filterFields={filterFields} onSearch={handleSearch} />
        <TableWrapper
            items={filteredOffers}
            fetchItems={fetchOffers}
            searchParams={searchParams}
            renderTableBody={(items, isMobile) => (
                isMobile ? (
                    <div className="space-y-4">
                      <OffersTableBody
                          offers={items}
                          role={role}
                          statusFilter={statusFilter}
                          onUpdate={handleUpdateOffer}
                          onClose={handleCloseOffer}
                          isMobile={isMobile}
                      />
                    </div>
                ) : (
                    <table className="w-full border-collapse">
                      <thead>
                      <tr className="bg-gray-200">
                        <th className="border p-2">ID</th>
                        <th className="border p-2">Тип</th>
                        <th className="border p-2">Криптовалюта</th>
                        <th className="border p-2">Фиатная валюта</th>
                        <th className="border p-2">Мин. сумма обмена</th>
                        <th className="border p-2">Макс. сумма обмена</th>
                        <th className="border p-2">Наценка (%)</th>
                        <th className="border p-2">Реквизиты</th>
                        {role === 'admin' && statusFilter === 'all' && <th className="border p-2">Статус</th>}
                        {role === 'admin' && <th className="border p-2">Ордеродержатель</th>}
                        <th className="border p-2">Создано</th>
                        {(role !== 'admin' || statusFilter === 'open' || statusFilter === 'all') && (
                            <th className="border p-2">Действия</th>
                        )}
                      </tr>
                      </thead>
                      <OffersTableBody
                          offers={items}
                          role={role}
                          statusFilter={statusFilter}
                          onUpdate={handleUpdateOffer}
                          onClose={handleCloseOffer}
                          isMobile={isMobile}
                      />
                    </table>
                )
            )}
            loading={loading}
            error={error}
            hasMore={hasMore}
            pageSize={pageSize}
        />
      </div>
  );
};

export default OffersTable;