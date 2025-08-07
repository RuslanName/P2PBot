import { useState } from 'react';
import Select from 'react-select';
import { Tooltip } from '../Tooltip';
import type {Offer, OffersTableBodyProps } from '../../types';

const OffersTableBody: React.FC<OffersTableBodyProps> = ({ offers, role, onUpdate, onClose, statusFilter }) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Offer | null>(null);

    const fiatCurrencies = [
        { value: 'RUB', label: 'RUB' },
        { value: 'UAH', label: 'UAH' },
        { value: 'KZT', label: 'KZT' },
        { value: 'BYN', label: 'BYN' },
        { value: 'USD', label: 'USD' },
        { value: 'EUR', label: 'EUR' },
    ];

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

    const getStatusName = (status: string) => {
        switch (status) {
            case 'open': return 'Открыта';
            case 'closed': return 'Закрыта';
            case 'blocked': return 'Заблокирована';
            default: return status;
        }
    };

    return (
        <tbody>
        {offers.map((offer) => (
            <tr
                key={offer.id}
                className={editingId === offer.id ? 'bg-yellow-100' : ''}
            >
                <td className="border p-2">{offer.id}</td>
                <td className="border p-2">{getTypeName(offer.type)}</td>
                <td className="border p-2">{offer.coin}</td>
                <td className="border p-2">
                    {editingId === offer.id && editForm ? (
                        <Select
                            isMulti
                            options={fiatCurrencies}
                            value={fiatCurrencies.filter(currency => editForm.fiatCurrency.includes(currency.value))}
                            onChange={(selected) => setEditForm({
                                ...editForm,
                                fiatCurrency: selected ? selected.map(option => option.value) : []
                            })}
                            className="w-full"
                            placeholder="Выберите валюты..."
                        />
                    ) : (
                        <span>{offer.fiatCurrency.join(', ')}</span>
                    )}
                </td>
                <td className="border p-2">
                    {editingId === offer.id && editForm ? (
                        <input
                            type="number"
                            value={editForm.minDealAmount}
                            onChange={(e) => setEditForm({
                                ...editForm,
                                minDealAmount: parseFloat(e.target.value)
                            })}
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
                            onChange={(e) => setEditForm({
                                ...editForm,
                                maxDealAmount: parseFloat(e.target.value)
                            })}
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
                            onChange={(e) => setEditForm({
                                ...editForm,
                                markupPercent: parseFloat(e.target.value)
                            })}
                            className="w-full p-1 border rounded no-arrows"
                            min="0"
                            step="any"
                        />
                    ) : (
                        offer.markupPercent
                    )}
                </td>
                <td className="border p-2">
                    {editingId === offer.id && editForm ? (
                        <input
                            type="text"
                            value={editForm.warrantHolderPaymentDetails}
                            onChange={(e) => setEditForm({
                                ...editForm,
                                warrantHolderPaymentDetails: e.target.value
                            })}
                            className="w-full p-1 border rounded"
                        />
                    ) : (
                        <span>{offer.warrantHolderPaymentDetails}</span>
                    )}
                </td>
                {role === 'admin' && statusFilter === 'all' && (
                    <td className="border p-2">
                        {editingId === offer.id && editForm ? (
                            <select
                                value={editForm.status}
                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                className="w-full p-1 border rounded"
                            >
                                <option value="open">Открыта</option>
                                <option value="closed">Закрыта</option>
                                <option value="blocked">Заблокирована</option>
                            </select>
                        ) : (
                            getStatusName(offer.status)
                        )}
                    </td>
                )}
                {role === 'admin' && (
                    <td className="border p-2">
                        {offer.warrantHolder ? (
                            <Tooltip content={`ID: ${offer.warrantHolder.id}\nЗаблокирован: ${offer.warrantHolder.isBlocked ? 'Да' : 'Нет'}`}>
                                <div className="bg-gray-100 px-2 py-1 rounded">
                                    {offer.warrantHolder.id}
                                </div>
                            </Tooltip>
                        ) : (
                            <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                                Гарант не найден
                            </div>
                        )}
                    </td>
                )}
                {(role !== 'admin' || statusFilter === 'open' || statusFilter === 'all') && (
                    <td className="border p-2">
                        {editingId === offer.id ? (
                            <div className="flex justify-evenly gap-2">
                                <button
                                    onClick={() => editForm && onUpdate(offer.id, {
                                        fiatCurrency: editForm.fiatCurrency,
                                        minDealAmount: editForm.minDealAmount,
                                        maxDealAmount: editForm.maxDealAmount,
                                        markupPercent: editForm.markupPercent,
                                        warrantHolderPaymentDetails: editForm.warrantHolderPaymentDetails,
                                        status: editForm.status
                                    })}
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
                            offer.status === 'open' && (
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
                                        onClick={() => onClose(offer.id)}
                                        className="px-2 py-1 rounded text-white bg-red-500 hover:bg-red-600"
                                    >
                                        Закрыть
                                    </button>
                                </div>
                            )
                        )}
                    </td>
                )}
            </tr>
        ))}
        </tbody>
    );
};

export default OffersTableBody;