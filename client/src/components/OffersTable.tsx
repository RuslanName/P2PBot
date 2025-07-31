import { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../store/store';

interface Offer {
  id: number;
  type: string;
  coin: string;
  amount: number;
  minDealAmount: number;
  maxDealAmount: number;
  markupPercent: number;
  userId: number;
  username?: string;
}

const OffersTable: React.FC = () => {
  const { role, userId } = useStore();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Offer | null>(null);
  const [newOffer, setNewOffer] = useState({
    type: 'buy',
    coin: '',
    amount: 0,
    minDealAmount: 0,
    maxDealAmount: 0,
    markupPercent: 0,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const offersResponse = await axios.get('/api/offers');
        setOffers(offersResponse.data);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await axios.post('/api/offers', newOffer);
      setOffers([...offers, response.data]);
      setNewOffer({ type: 'buy', coin: '', amount: 0, minDealAmount: 0, maxDealAmount: 0, markupPercent: 0 });
    } catch (error) {
      setError('Ошибка при создании оферты');
      console.error('Error creating offer:', error);
    }
  };

  const handleUpdateOffer = async (id: number) => {
    if (!editForm) return;
    setError('');
    try {
      const response = await axios.put(`/api/offers/${id}`, editForm);
      setOffers(offers.map((offer) => (offer.id === id ? response.data : offer)));
      setEditingId(null);
      setEditForm(null);
    } catch (error) {
      setError('Ошибка при обновлении оферты');
      console.error('Error updating offer:', error);
    }
  };

  const handleDeleteOffer = async (id: number) => {
    setError('');
    try {
      await axios.delete(`/api/offers/${id}`);
      setOffers(offers.filter((offer) => offer.id !== id));
    } catch (error) {
      setError('Ошибка при удалении оферты');
      console.error('Error deleting offer:', error);
    }
  };

  const handleEditClick = (offer: Offer) => {
    setEditingId(offer.id);
    setEditForm({ ...offer });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const getTypeName = (type: string) => {
    return type === 'buy' ? 'Покупка' : 'Продажа';
  };

  if (loading) return <p>Загрузка...</p>;

  return (
      <>
        <h2 className="text-xl font-bold mb-4">Оферты</h2>
        {role !== 'admin' && (
            <form onSubmit={handleCreateOffer} className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-700">Тип</label>
                  <select
                      value={newOffer.type}
                      onChange={(e) => setNewOffer({ ...newOffer, type: e.target.value })}
                      className="w-full p-2 border rounded"
                  >
                    <option value="buy">Покупка</option>
                    <option value="sell">Продажа</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700">Валюта</label>
                  <select
                      value={newOffer.coin}
                      onChange={(e) => setNewOffer({ ...newOffer, coin: e.target.value })}
                      className="w-full p-2 border rounded"
                  >
                    <option value="">Выберите валюту</option>
                    <option value="BTC">BTC</option>
                    <option value="LTC">LTC</option>
                    <option value="USDT">USDT</option>
                    <option value="XMR">XMR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700">Сумма</label>
                  <input
                      type="number"
                      value={newOffer.amount}
                      onChange={(e) => setNewOffer({ ...newOffer, amount: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded no-arrows"
                      placeholder="Сумма"
                      min="0"
                      step="any"
                  />
                </div>
                <div>
                  <label className="block text-gray-700">Мин. сумма сделки</label>
                  <input
                      type="number"
                      value={newOffer.minDealAmount}
                      onChange={(e) => setNewOffer({ ...newOffer, minDealAmount: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded no-arrows"
                      placeholder="Мин. сумма"
                      min="0"
                      step="any"
                  />
                </div>
                <div>
                  <label className="block text-gray-700">Макс. сумма сделки</label>
                  <input
                      type="number"
                      value={newOffer.maxDealAmount}
                      onChange={(e) => setNewOffer({ ...newOffer, maxDealAmount: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded no-arrows"
                      placeholder="Макс. сумма"
                      min="0"
                      step="any"
                  />
                </div>
                <div>
                  <label className="block text-gray-700">Наценка (%)</label>
                  <input
                      type="number"
                      value={newOffer.markupPercent}
                      onChange={(e) => setNewOffer({ ...newOffer, markupPercent: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded no-arrows"
                      placeholder="Наценка"
                      min="0"
                      step="any"
                  />
                </div>
              </div>
              <button
                  type="submit"
                  className="mt-4 bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
              >
                Добавить оферту
              </button>
              {error && <p className="text-red-500 mt-2">{error}</p>}
            </form>
        )}
        <table className="w-full border-collapse">
          <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">ID</th>
            <th className="border p-2">Тип</th>
            <th className="border p-2">Валюта</th>
            <th className="border p-2">Сумма</th>
            <th className="border p-2">Мин. сумма сделки</th>
            <th className="border p-2">Макс. сумма сделки</th>
            <th className="border p-2">Наценка (%)</th>
            <th className="border p-2">ID пользователя</th>
            {role === 'admin' && <th className="border p-2">Ордеродержатель</th>}
            <th className="border p-2">Действия</th>
          </tr>
          </thead>
          <tbody>
          {offers
              .filter((offer) => role === 'admin' || offer.userId === userId)
              .map((offer) => (
                  <tr
                      key={offer.id}
                      className={editingId === offer.id ? 'bg-yellow-100' : ''}
                  >
                    <td className="border p-2">{offer.id}</td>
                    <td className="border p-2">
                      {editingId === offer.id && editForm ? (
                          <select
                              value={editForm.type}
                              onChange={(e) =>
                                  setEditForm({ ...editForm, type: e.target.value })
                              }
                              className="w-full p-1 border rounded"
                          >
                            <option value="buy">Покупка</option>
                            <option value="sell">Продажа</option>
                          </select>
                      ) : (
                          getTypeName(offer.type)
                      )}
                    </td>
                    <td className="border p-2">
                      {editingId === offer.id && editForm ? (
                          <select
                              value={editForm.coin}
                              onChange={(e) =>
                                  setEditForm({ ...editForm, coin: e.target.value })
                              }
                              className="w-full p-1 border rounded"
                          >
                            <option value="">Выберите валюту</option>
                            <option value="BTC">BTC</option>
                            <option value="LTC">LTC</option>
                            <option value="USDT">USDT</option>
                            <option value="XMR">XMR</option>
                          </select>
                      ) : (
                          offer.coin
                      )}
                    </td>
                    <td className="border p-2">
                      {editingId === offer.id && editForm ? (
                          <input
                              type="number"
                              value={editForm.amount}
                              onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    amount: parseFloat(e.target.value),
                                  })
                              }
                              className="w-full p-1 border rounded no-arrows"
                              min="0"
                              step="any"
                          />
                      ) : (
                          offer.amount
                      )}
                    </td>
                    <td className="border p-2">
                      {editingId === offer.id && editForm ? (
                          <input
                              type="number"
                              value={editForm.minDealAmount}
                              onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    minDealAmount: parseFloat(e.target.value),
                                  })
                              }
                              className="w-full p-1 border rounded no-arrows"
                              min="0"
                              step="any"
                          />
                      ) : (
                          offer.minDealAmount
                      )}
                    </td>
                    <td className="border p-2">
                      {editingId === offer.id && editForm ? (
                          <input
                              type="number"
                              value={editForm.maxDealAmount}
                              onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    maxDealAmount: parseFloat(e.target.value),
                                  })
                              }
                              className="w-full p-1 border rounded no-arrows"
                              min="0"
                              step="any"
                          />
                      ) : (
                          offer.maxDealAmount
                      )}
                    </td>
                    <td className="border p-2">
                      {editingId === offer.id && editForm ? (
                          <input
                              type="number"
                              value={editForm.markupPercent}
                              onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    markupPercent: parseFloat(e.target.value),
                                  })
                              }
                              className="w-full p-1 border rounded no-arrows"
                              min="0"
                              step="any"
                          />
                      ) : (
                          offer.markupPercent
                      )}
                    </td>
                    <td className="border p-2">{offer.userId}</td>
                    {role === 'admin' && (
                        <td className="border p-2">{offer.username}</td>
                    )}
                    <td className="border p-2">
                      {editingId === offer.id ? (
                          <div className="flex justify-evenly gap-2">
                            <button
                                onClick={() => handleUpdateOffer(offer.id)}
                                className="text-green-500 hover:underline"
                            >
                              Сохранить
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                className="text-gray-500 hover:underline"
                            >
                              Отмена
                            </button>
                          </div>
                      ) : (
                          <div className="flex justify-evenly gap-2">
                            {role !== 'admin' && (
                                <button
                                    onClick={() => handleEditClick(offer)}
                                    className="text-blue-500 hover:underline"
                                >
                                  Редактировать
                                </button>
                            )}
                            <button
                                onClick={() => handleDeleteOffer(offer.id)}
                                className="text-red-500 hover:underline"
                            >
                              Удалить
                            </button>
                          </div>
                      )}
                    </td>
                  </tr>
              ))}
          </tbody>
        </table>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </>
  );
};

export default OffersTable;