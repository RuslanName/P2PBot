import { useState } from 'react';
import axios from 'axios';
import { Tooltip } from '../Tooltip';
import type {WarrantHoldersTableBodyProps} from "../../types";

const WarrantHoldersTableBody: React.FC<WarrantHoldersTableBodyProps> = ({ warrantHolders, role, setWarrantHolders }) => {
    const [error, setError] = useState<string | null>(null);

    const handleUpdatePassword = async (id: number) => {
        try {
            const response = await axios.put(`/api/warrant-holders/${id}`, { password: true });
            setWarrantHolders(warrantHolders.map(holder =>
                holder.id === id ? { ...holder, password: response.data.password } : holder
            ));
            setError(null);
        } catch (error: any) {
            console.error('Error updating password:', error);
            setError(error.response?.data?.error || 'Ошибка при обновлении пароля');
        }
    };

    const handleToggleBlock = async (id: number, isBlocked: boolean) => {
        try {
            const response = await axios.put(`/api/warrant-holders/${id}`, {
                isBlocked: !isBlocked,
            });
            setWarrantHolders(warrantHolders.map(holder =>
                holder.id === id ? { ...holder, isBlocked: response.data.isBlocked } : holder
            ));
            setError(null);
        } catch (error: any) {
            console.error('Error toggling block status:', error);
            setError(error.response?.data?.error || 'Ошибка при изменении статуса блокировки');
        }
    };

    const getOfferStatusName = (status: string) => {
        switch (status) {
            case 'open': return 'Открыт';
            case 'closed': return 'Закрыт';
            case 'blocked': return 'Заблокирован';
            default: return status;
        }
    };

    const getOfferTypeName = (type: string) => {
        switch (type) {
            case 'buy': return 'Покупка';
            case 'sell': return 'Продажа';
            default: return type;
        }
    };

    return (
        <>
            <tbody>
            {warrantHolders.map((holder) => {
                const offersContent = (holder.offers || []).map(
                    (offer) =>
                        `ID: ${offer.id}\nТип: ${getOfferTypeName(offer.type)}\nКриптовалюта: ${offer.coin}\nСтатус: ${getOfferStatusName(offer.status)}`
                ).join('\n\n') || 'Оферты отсутствуют';

                return (
                    <tr key={holder.id}>
                        <td className="border p-2">{holder.id}</td>
                        <td className="border p-2">
                            {holder.user ? (
                                <Tooltip content={`ID: ${holder.user.id}\nИмя: ${holder.user.username}\nЗаблокирован: ${holder.user.isBlocked ? 'Да' : 'Нет'}`}>
                                    <div className="bg-gray-100 px-2 py-1 rounded">
                                        {holder.user.username}
                                    </div>
                                </Tooltip>
                            ) : (
                                <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                                    Пользователь не найден
                                </div>
                            )}
                        </td>
                        <td className="border p-2">
                            <div className="flex flex-wrap justify-evenly gap-2">
                                {holder.wallets.map((wallet) => (
                                    <Tooltip
                                        key={wallet.id}
                                        content={`ID: ${wallet.id}\nКриптовалюта: ${wallet.coin}\nАдрес: ${wallet.address}\nБаланс: ${wallet.balance}\nНеподтвержденный баланс: ${wallet.unconfirmedBalance}\nНа удержании: ${wallet.heldAmount || 0}`}
                                    >
                                        <div className="bg-gray-100 px-2 py-1 rounded">
                                            {wallet.coin}
                                        </div>
                                    </Tooltip>
                                ))}
                            </div>
                        </td>
                        <td className="border p-2">
                            <Tooltip content={offersContent}>
                                <div className="bg-gray-100 px-2 py-1 rounded">
                                    {(holder.offers || []).length} оферты
                                </div>
                            </Tooltip>
                        </td>
                        {role === 'admin' && (
                            <td className="border p-2">
                                <span className="truncate max-w-[150px]">{holder.password}</span>
                            </td>
                        )}
                        <td className="border p-2">
                            {holder.isBlocked ? 'Да' : 'Нет'}
                        </td>
                        {role === 'admin' && (
                            <td className="border p-2">
                                <div className="flex justify-evenly gap-2">
                                    <button
                                        onClick={() => handleUpdatePassword(holder.id)}
                                        className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                        disabled={holder.isBlocked}
                                    >
                                        Обновить пароль
                                    </button>
                                    <button
                                        onClick={() => handleToggleBlock(holder.id, holder.isBlocked)}
                                        className={`px-2 py-1 rounded text-white ${
                                            holder.isBlocked
                                                ? 'bg-green-500 hover:bg-green-600'
                                                : 'bg-red-500 hover:bg-red-600'
                                        }`}
                                    >
                                        {holder.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                                    </button>
                                </div>
                            </td>
                        )}
                    </tr>
                );
            })}
            </tbody>
            {error && <p className="text-red-500 mt-2">{error}</p>}
        </>
    );
};

export default WarrantHoldersTableBody;