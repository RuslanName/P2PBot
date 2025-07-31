import { useEffect, useState } from 'react';
import axios from 'axios';

interface Deal {
  id: number;
  userId: number;
  offerId: number;
  transactionId: number;
  amount: number;
  fiatAmount: number;
  clientFee: number;
  warrantHolderFee: number;
  minerFee: number;
  platformFee: number;
  status: string;
  clientConfirmed: boolean;
  transaction?: {
    type: string;
    coin: string;
    amount: number;
    txId: string;
    status: string;
  };
}

const DealsTable: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const response = await axios.get('/api/deals');
        const dealsWithTransactions = await Promise.all(
            response.data.map(async (deal: Deal) => {
              const transactionResponse = await axios.get(`/api/transactions/${deal.transactionId}`);
              return {
                ...deal,
                transaction: transactionResponse.data
              };
            })
        );
        setDeals(dealsWithTransactions);
        setLoading(false);
      } catch (error) {
        console.error('Error loading deals:', error);
        setLoading(false);
      }
    };
    fetchDeals();
  }, []);

  const getStatusName = (status: string) => {
    const statusMap: Record<string, string> = {
      'open': 'Открыта',
      'pending': 'В обработке',
      'completed': 'Завершена',
      'cancelled': 'Отменена'
    };
    return statusMap[status] || status;
  };

  if (loading) return <p>Загрузка...</p>;

  return (
      <>
        <table className="w-full border-collapse">
          <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">ID</th>
            <th className="border p-2">ID пользователя</th>
            <th className="border p-2">ID оферты</th>
            <th className="border p-2">Сумма</th>
            <th className="border p-2">Фиатная сумма</th>
            <th className="border p-2">Выручка клиента</th>
            <th className="border p-2">Выручка держателя</th>
            <th className="border p-2">Выручка майнера</th>
            <th className="border p-2">Выручка платформы</th>
            <th className="border p-2">Статус</th>
            <th className="border p-2">Подтверждено клиентом</th>
          </tr>
          </thead>
          <tbody>
          {deals.map((deal) => (
              <tr key={deal.id}>
                <td className="border p-2">{deal.id}</td>
                <td className="border p-2">{deal.userId}</td>
                <td className="border p-2">{deal.offerId}</td>
                <td className="border p-2">{deal.amount}</td>
                <td className="border p-2">{deal.fiatAmount}</td>
                <td className="border p-2">{deal.clientFee}</td>
                <td className="border p-2">{deal.warrantHolderFee}</td>
                <td className="border p-2">{deal.minerFee}</td>
                <td className="border p-2">{deal.platformFee}</td>
                <td className="border p-2">{getStatusName(deal.status)}</td>
                <td className="border p-2">{deal.clientConfirmed ? 'Да' : 'Нет'}</td>
              </tr>
          ))}
          </tbody>
        </table>
      </>
  );
};

export default DealsTable;