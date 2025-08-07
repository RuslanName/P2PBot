import { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { Offer } from '../../types';
import CreateOfferForm from './CreateOfferForm';
import OffersTableBody from './OffersTableBody';

const OffersTable: React.FC = () => {
  const { role, userId } = useStore();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const offersResponse = await axios.get('/api/offers');
        setOffers(offersResponse.data);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Ошибка при загрузке данных');
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreateOffer = async (newOffer: Omit<Offer, 'id' | 'status' | 'warrantHolder' | 'userId'>) => {
    setError('');
    if (!newOffer.fiatCurrency.length) {
      setError('Выберите хотя бы одну фиатную валюту');
      return;
    }
    try {
      const response = await axios.post('/api/offers', {
        ...newOffer,
        status: 'open'
      });
      setOffers([...offers, response.data]);
    } catch (error) {
      setError('Ошибка при создании оферты');
      console.error('Error creating offer:', error);
    }
  };

  const handleUpdateOffer = async (id: number, updateData: Partial<Offer>) => {
    setError('');
    if (!updateData.fiatCurrency?.length) {
      setError('Выберите хотя бы одну фиатную валюту');
      return;
    }
    try {
      const response = await axios.put(`/api/offers/${id}`, updateData);
      setOffers(offers.map((offer) => (offer.id === id ? response.data : offer)));
    } catch (error) {
      setError('Ошибка при обновлении оферты');
      console.error('Error updating offer:', error);
    }
  };

  const handleCloseOffer = async (id: number) => {
    setError('');
    try {
      await axios.put(`/api/offers/${id}`, { status: 'closed' });
      setOffers(offers.map((offer) => (offer.id === id ? { ...offer, status: 'closed' } : offer)));
    } catch (error) {
      setError('Ошибка при закрытии оферты');
      console.error('Error closing offer:', error);
    }
  };

  const filteredOffers = role === 'admin'
      ? offers.filter(offer => statusFilter === 'all' || offer.status === statusFilter)
      : offers.filter(offer => offer.status === 'open' && offer.warrantHolder.id === userId);

  if (loading) return <p>Загрузка...</p>;

  return (
      <>
        <h2 className="text-xl font-bold mb-4">Оферты</h2>
        {role === 'admin' && (
            <div className="mb-4">
              <label className="block text-gray-700">Фильтр по статусу</label>
              <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border rounded"
              >
                <option value="all">Все</option>
                <option value="open">Открытые</option>
                <option value="closed">Закрытые</option>
                <option value="blocked">Заблокированные</option>
              </select>
            </div>
        )}
        {role !== 'admin' && (
            <CreateOfferForm onSubmit={handleCreateOffer} />
        )}
        <table className="w-full border-collapse">
          <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">ID</th>
            <th className="border p-2">Тип</th>
            <th className="border p-2">Криптовалюта</th>
            <th className="border p-2">Фиатная валюта</th>
            <th className="border p-2">Мин. сумма сделки</th>
            <th className="border p-2">Макс. сумма сделки</th>
            <th className="border p-2">Наценка (%)</th>
            <th className="border p-2">Реквизиты</th>
            {role === 'admin' && statusFilter === 'all' && <th className="border p-2">Статус</th>}
            {role === 'admin' && <th className="border p-2">Гарант</th>}
            {(role !== 'admin' || statusFilter === 'open' || statusFilter === 'all') && (
                <th className="border p-2">Действия</th>
            )}
          </tr>
          </thead>
          <OffersTableBody
              offers={filteredOffers}
              role={role}
              onUpdate={handleUpdateOffer}
              onClose={handleCloseOffer}
              statusFilter={statusFilter}
          />
        </table>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </>
  );
};

export default OffersTable;