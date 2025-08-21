import { useState } from 'react';
import Select from 'react-select';
import { Tooltip } from '../Tooltip';
import type { Offer, OffersTableBodyProps } from '../../types';

interface ExtendedOffersTableBodyProps extends OffersTableBodyProps {
    isMobile: boolean;
}

const OffersTableBody: React.FC<ExtendedOffersTableBodyProps> = ({ offers, role, onUpdate, onClose, statusFilter, isMobile }) => {
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

    const hasActions = (offer: { status: string }) => {
        return role !== 'admin' || statusFilter === 'open' || (statusFilter === 'all' && offer.status === 'open');
    };

    if (isMobile) {
        return (
            <>
                {offers.map((offer) => (
                    <div key={offer.id} className={`card-stack-item ${editingId === offer.id ? 'bg-yellow-100' : ''} offer-item-${offer.id}`}>
                        <table className="vertical-table">
                            <tbody>
                            <tr>
                                <td className="card-label">ID</td>
                                <td className="card-value">{offer.id}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Тип</td>
                                <td className="card-value">{getTypeName(offer.type)}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Криптовалюта</td>
                                <td className="card-value">{offer.coin}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Фиатная валюта</td>
                                <td className="card-value">
                                    {editingId === offer.id && editForm ? (
                                        <Select
                                            isMulti
                                            options={fiatCurrencies}
                                            value={fiatCurrencies.filter(currency => editForm.fiatCurrency.includes(currency.value))}
                                            onChange={(selected) => {
                                                const selectedCurrencies = selected ? selected.map(option => option.value) : [];
                                                const currentDetails = editForm?.warrantHolderPaymentDetails || [];
                                                const newDetails = selectedCurrencies.map((currency) => {
                                                    const prevIndex = editForm?.fiatCurrency.indexOf(currency);
                                                    return prevIndex !== -1 && prevIndex < currentDetails.length ? currentDetails[prevIndex] : '';
                                                });
                                                setEditForm({
                                                    ...editForm,
                                                    fiatCurrency: selectedCurrencies,
                                                    warrantHolderPaymentDetails: newDetails
                                                });
                                            }}
                                            className="w-full"
                                            placeholder="Выберите валюты..."
                                        />
                                    ) : (
                                        <span>{offer.fiatCurrency.join(', ')}</span>
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td className="card-label">Мин. сумма обмена</td>
                                <td className="card-value">
                                    {editingId === offer.id && editForm ? (
                                        <input
                                            type="number"
                                            value={editForm.minDealAmount}
                                            onChange={(e) => setEditForm({
                                                ...editForm,
                                                minDealAmount: parseFloat(e.target.value)
                                            })}
                                            className="w-full p-2 border rounded no-arrows"
                                            placeholder="Мин. сумма"
                                            min="0"
                                            step="any"
                                        />
                                    ) : (
                                        offer.minDealAmount
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td className="card-label">Макс. сумма обмена</td>
                                <td className="card-value">
                                    {editingId === offer.id && editForm ? (
                                        <input
                                            type="number"
                                            value={editForm.maxDealAmount}
                                            onChange={(e) => setEditForm({
                                                ...editForm,
                                                maxDealAmount: parseFloat(e.target.value)
                                            })}
                                            className="w-full p-2 border rounded no-arrows"
                                            placeholder="Макс. сумма"
                                            min="0"
                                            step="any"
                                        />
                                    ) : (
                                        offer.maxDealAmount
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td className="card-label">Наценка (%)</td>
                                <td className="card-value">
                                    {editingId === offer.id && editForm ? (
                                        <input
                                            type="number"
                                            value={editForm.markupPercent}
                                            onChange={(e) => setEditForm({
                                                ...editForm,
                                                markupPercent: parseFloat(e.target.value)
                                            })}
                                            className="w-full p-2 border rounded no-arrows"
                                            placeholder="Наценка"
                                            min="0"
                                            step="any"
                                        />
                                    ) : (
                                        offer.markupPercent
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td className="card-label">Реквизиты</td>
                                <td className="card-value">
                                    {editingId === offer.id && editForm ? (
                                        editForm.fiatCurrency.map((currency, index) => (
                                            <tr key={currency}>
                                                <td className="card-label">Реквизиты для {currency}</td>
                                                <td className="card-value">
                                                    <input
                                                        type="text"
                                                        value={editForm.warrantHolderPaymentDetails[index] || ''}
                                                        onChange={(e) => {
                                                            const updatedDetails = [...editForm.warrantHolderPaymentDetails];
                                                            updatedDetails[index] = e.target.value;
                                                            setEditForm({ ...editForm, warrantHolderPaymentDetails: updatedDetails });
                                                        }}
                                                        className="w-full p-2 border rounded"
                                                        placeholder={`Реквизиты для ${currency}`}
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <span>{offer.warrantHolderPaymentDetails.join(', ') || 'Не указаны'}</span>
                                    )}
                                </td>
                            </tr>
                            {role === 'admin' && statusFilter === 'all' && (
                                <tr>
                                    <td className="card-label">Статус</td>
                                    <td className="card-value">{getStatusName(offer.status)}</td>
                                </tr>
                            )}
                            {role === 'admin' && (
                                <tr>
                                    <td className="card-label">Ордеродержатель</td>
                                    <td className="card-value">
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
                                </tr>
                            )}
                            <tr>
                                <td className="card-label">Создано</td>
                                <td className="card-value">{formatCreatedAt(offer.createdAt)}</td>
                            </tr>
                            {hasActions(offer) && (
                                <tr>
                                    <td className="card-label">Действия</td>
                                    <td className="card-value">
                                        {editingId === offer.id ? (
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (editForm) {
                                                            onUpdate(offer.id, {
                                                                fiatCurrency: editForm.fiatCurrency,
                                                                minDealAmount: editForm.minDealAmount,
                                                                maxDealAmount: editForm.maxDealAmount,
                                                                markupPercent: editForm.markupPercent,
                                                                warrantHolderPaymentDetails: editForm.warrantHolderPaymentDetails,
                                                                status: editForm.status
                                                            });
                                                            handleCancelEdit();
                                                        }
                                                    }}
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
                                            <div className="flex flex-col gap-2">
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
                                        )}
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                ))}
            </>
        );
    }

    return (
        <tbody>
        {offers.map((offer) => (
            <tr
                key={offer.id}
                className={`offer-item-${offer.id} ${editingId === offer.id ? 'bg-yellow-100' : ''}`}
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
                            className="w-full p-2 border rounded no-arrows"
                            placeholder="Мин. сумма"
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
                            className="w-full p-2 border rounded no-arrows"
                            placeholder="Макс. сумма"
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
                            className="w-full p-2 border rounded no-arrows"
                            placeholder="Наценка"
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
                                    className="w-full p-2 border rounded"
                                    placeholder={`Реквизиты для ${currency}`}
                                />
                            </div>
                        ))
                    ) : (
                        <span>{offer.warrantHolderPaymentDetails.join(', ') || 'Не указаны'}</span>
                    )}
                </td>
                {role === 'admin' && statusFilter === 'all' && (
                    <td className="border p-2">{getStatusName(offer.status)}</td>
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
                {hasActions(offer) && (
                    <td className="border p-2">
                        {editingId === offer.id ? (
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => {
                                        if (editForm) {
                                            onUpdate(offer.id, {
                                                fiatCurrency: editForm.fiatCurrency,
                                                minDealAmount: editForm.minDealAmount,
                                                maxDealAmount: editForm.maxDealAmount,
                                                markupPercent: editForm.markupPercent,
                                                warrantHolderPaymentDetails: editForm.warrantHolderPaymentDetails,
                                                status: editForm.status
                                            });
                                            handleCancelEdit();
                                        }
                                    }}
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
                            <div className="flex justify-evenly gap-2 Nosotros">
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
                        )}
                    </td>
                )}
            </tr>
        ))}
        </tbody>
    );
};

export default OffersTableBody;