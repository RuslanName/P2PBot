import { useState } from 'react';
import Select from 'react-select';
import { Tooltip } from '../Tooltip';
import type { Offer, OffersTableBodyProps } from '../../types';

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

    const formatCreatedAt = (date: string) => {
        const createdDate = new Date(date);
        createdDate.setHours(createdDate.getHours() + 3);
        return createdDate.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(',', '');
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
                            onChange={(selected) => {
                                const selectedCurrencies = selected ? selected.map(option => option.value) : [];
                                setEditForm({
                                    ...editForm,
                                    fiatCurrency: selectedCurrencies,
                                    warrantHolderPaymentDetails: selectedCurrencies.map((_, index) =>
                                        editForm.warrantHolderPaymentDetails[index] || ''
                                    )
                                });
                            }}
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
                        editForm.fiatCurrency.map((currency, index) => (
                            <div key={currency} className="mb-2">
                                <label className="block text-gray-700">Реквизиты для {currency}</label>
                                <input
                                    type="text"
                                    value={editForm.warrantHolderPaymentDetails[index] || ''}
                                    onChange={(e) => {
                                        const updatedDetails = [...editForm.warrantHolderPaymentDetails];
                                        updatedDetails[index] = e.target.value;
                                        setEditForm({ ...editForm, warrantHolderPaymentDetails: updatedDetails });
                                    }}
                                    className="w-full p-1 border rounded"
                                    placeholder={`Реквизиты для ${currency}`}
                                />
                            </div>
                        ))
                    ) : (
                        <span>{offer.warrantHolderPaymentDetails.join(', ')}</span>
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
                                Ордеродержатель не найден
                            </div>
                        )}
                    </td>
                )}
                <td className="border p-2">{formatCreatedAt(offer.createdAt)}</td>
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
                                    className="px-3 py-1 rounded text-white bg-green-500 hover:bg-green-600 transition-colors"
                                >
                                    Сохранить
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1 rounded text-white bg-gray-500 hover:bg-gray-600 transition-colors"
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
                                            className="px-3 py-1 rounded text-white bg-blue-500 hover:bg-blue-600 transition-colors"
                                        >
                                            Редактировать
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onClose(offer.id)}
                                        className="px-3 py-1 rounded text-white bg-red-500 hover:bg-red-600 transition-colors"
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