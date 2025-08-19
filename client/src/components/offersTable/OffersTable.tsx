import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { Offer, CreateOfferDto } from '../../types';
import CreateOfferForm from './CreateOfferForm';
import OffersTableBody from './OffersTableBody';

const OffersTable: React.FC = () => {
  const { role, userId } = useStore();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 10;
  const observer = useRef<IntersectionObserver | null>(null);

  const fetchOffers = async (pageNum: number, append: boolean = false) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/offers', {
        params: { page: pageNum, pageSize }
      });
      const { data, total } = response.data;
      setOffers(prev => append ? [...prev, ...data] : data);
      setHasMore(pageNum * pageSize < total);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Ошибка при загрузке данных');
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchOffers(1);
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
          fetchOffers(nextPage, true);
          return nextPage;
        });
      }
    });

    // Наблюдаем за последним элементом в списке оферт
    if (offers.length > 0) {
      const lastOfferElement = document.querySelector(`.offer-item-${offers[offers.length - 1].id}`);
      if (lastOfferElement) {
        observer.current.observe(lastOfferElement);
      }
    }

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [hasMore, loading, offers]);

  const handleCreateOffer = async (newOffer: CreateOfferDto) => {
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

  return (
      <div className="table-responsive">
        {role === 'admin' && (
            <div className="mb-4">
              <label className="block text-gray-700">Фильтр по статусу</label>
              <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setOffers([]);
                  }}
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
        {filteredOffers.length === 0 && !loading && (
            <p className="text-center text-gray-500 mt-4">На данный момент тут ничего нет</p>
        )}
        {isMobile ? (
            <div className="card-stack">
              <OffersTableBody
                  offers={filteredOffers}
                  role={role}
                  onUpdate={handleUpdateOffer}
                  onClose={handleCloseOffer}
                  statusFilter={statusFilter}
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
                {role !== 'admin' || statusFilter === 'open' || statusFilter === 'all' ? (
                    <th className="border p-2">Действия</th>
                ) : null}
              </tr>
              </thead>
              <OffersTableBody
                  offers={filteredOffers}
                  role={role}
                  onUpdate={handleUpdateOffer}
                  onClose={handleCloseOffer}
                  statusFilter={statusFilter}
                  isMobile={isMobile}
              />
            </table>
        )}
        {loading && <p className="text-center">Загрузка...</p>}
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
  );
};

export default OffersTable;